// Consome ou devolve um uso de assinatura de forma atômica e idempotente.
// - action="consume": valida saldo, decrementa uses_remaining, cria SubscriptionUsage, vincula ao Appointment
// - action="revert": marca usage como reverted=true e devolve uso (somente se ainda no mesmo ciclo)
//
// Usado pela agenda interna quando o atendente escolhe "Usar plano" ou cancela um agendamento
// que estava cobrindo por assinatura.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// P0.6 — RBAC sweep: resolve o tenant do caller (TeamMember ou Owner).
// Retorna null se for super-admin ou se autenticado apenas como customer público.
async function resolveCallerCompanyId(base44, user) {
  if (!user?.email) return null;
  if (user.is_super_admin) return '__SUPER__';
  const tm = await base44.asServiceRole.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  if (tm?.length) {
    if (tm[0].active === false) return null;
    return tm[0].company_id;
  }
  const co = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (co?.length) return co[0].id;
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, subscription_id, appointment_id, service_id, service_name, customer_token, company_id } = body;

    // Aceita autenticação via:
    //  (a) usuário Base44 logado (atendente da barbearia), OU
    //  (b) customer_token válido (cliente final agendando pelo link público).
    let authed = false;
    let callerCompanyId = null;     // P0.6: tenant do atendente (a)
    let customerCompanyId = null;   // P0.6: tenant do cliente público (b)
    let customerId = null;

    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* sem sessão Base44 */ }
    if (user) {
      authed = true;
      callerCompanyId = await resolveCallerCompanyId(base44, user);
      if (!callerCompanyId) {
        // Usuário logado mas sem vínculo a empresa nenhuma — recusa.
        return Response.json({ error: 'NO_TEAM_MEMBER' }, { status: 403 });
      }
    }

    if (!authed && customer_token && company_id) {
      const matches = await base44.asServiceRole.entities.Customer.filter({
        company_id, auth_token: customer_token,
      }, '-updated_date', 1);
      const customer = matches?.[0];
      if (customer && customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) > new Date()) {
        authed = true;
        customerCompanyId = company_id;
        customerId = customer.id;
      }
    }

    if (!authed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!action || !['consume', 'revert'].includes(action)) {
      return Response.json({ error: 'action inválida' }, { status: 400 });
    }
    if (!subscription_id || !appointment_id) {
      return Response.json({ error: 'parâmetros obrigatórios faltando' }, { status: 400 });
    }

    const sub = await base44.asServiceRole.entities.CustomerSubscription.get(subscription_id);
    if (!sub) return Response.json({ error: 'Assinatura não encontrada' }, { status: 404 });

    // ── P0.6: ensureSameCompany — bloqueia cross-tenant ─────────────────
    // Cenário antigo: admin@barbA logado conseguia consumir uma sub de barbB
    // passando subscription_id de barbB no payload. Agora validamos que a sub
    // pertence ao tenant do caller (ou ao customer logado).
    if (callerCompanyId && callerCompanyId !== '__SUPER__' && sub.company_id !== callerCompanyId) {
      console.warn('[consumeSubscriptionUse] cross-tenant attempt', {
        user: user?.email, caller_company: callerCompanyId, sub_company: sub.company_id,
      });
      return Response.json({ error: 'FORBIDDEN_TENANT' }, { status: 403 });
    }
    if (customerCompanyId && sub.company_id !== customerCompanyId) {
      console.warn('[consumeSubscriptionUse] customer cross-tenant attempt', {
        customer_company: customerCompanyId, sub_company: sub.company_id,
      });
      return Response.json({ error: 'FORBIDDEN_TENANT' }, { status: 403 });
    }
    // Para cliente público: a sub também deve pertencer ao próprio cliente.
    if (customerId && sub.customer_id !== customerId) {
      console.warn('[consumeSubscriptionUse] customer ownership mismatch', {
        customer_id: customerId, sub_customer_id: sub.customer_id,
      });
      return Response.json({ error: 'FORBIDDEN_OWNERSHIP' }, { status: 403 });
    }

    // Validação do appointment: precisa pertencer ao mesmo tenant da sub.
    const appt = await base44.asServiceRole.entities.Appointment.get(appointment_id).catch(() => null);
    if (!appt) return Response.json({ error: 'Agendamento não encontrado' }, { status: 404 });
    if (appt.company_id !== sub.company_id) {
      console.warn('[consumeSubscriptionUse] appointment/sub tenant mismatch', {
        appt_company: appt.company_id, sub_company: sub.company_id,
      });
      return Response.json({ error: 'TENANT_MISMATCH_APPOINTMENT' }, { status: 403 });
    }

    // ─── CONSUMIR ───
    if (action === 'consume') {
      // Idempotência: já existe usage ativo para esse appointment? não consome de novo
      const existing = await base44.asServiceRole.entities.SubscriptionUsage.filter({
        appointment_id,
        reverted: false,
      });
      if (existing.length > 0) {
        return Response.json({ success: true, already_consumed: true, usage_id: existing[0].id });
      }

      if (sub.status !== 'active') {
        return Response.json({ error: 'Assinatura não está ativa' }, { status: 400 });
      }
      if (new Date(sub.current_cycle_end) <= new Date()) {
        return Response.json({ error: 'Ciclo da assinatura expirou' }, { status: 400 });
      }
      const isUnlimited = sub.plan_type_snapshot === 'unlimited';
      if (!isUnlimited && (sub.uses_remaining ?? 0) <= 0) {
        return Response.json({ error: 'Sem usos disponíveis no ciclo atual' }, { status: 400 });
      }

      // Valida janela off-peak (se o plano tiver restrição)
      const plan = sub.plan_id
        ? await base44.asServiceRole.entities.CustomerPlan.get(sub.plan_id).catch(() => null)
        : null;
      if (plan?.off_peak_enabled) {
        if (appt?.scheduled_at) {
          const when = new Date(appt.scheduled_at);
          const start = plan.off_peak_start || '00:00';
          const end = plan.off_peak_end || '23:59';
          const weekdays = plan.off_peak_weekdays || [];
          const hhmm = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
          const dayOk = weekdays.length === 0 || weekdays.includes(when.getDay());
          if (!dayOk || hhmm < start || hhmm > end) {
            return Response.json({
              error: `Fora da janela do plano Off-Peak (${start}–${end}). Cobre como avulso.`,
            }, { status: 400 });
          }
        }
      }

      // Decrementa saldo
      const newRemaining = isUnlimited ? sub.uses_remaining : (sub.uses_remaining - 1);
      await base44.asServiceRole.entities.CustomerSubscription.update(subscription_id, {
        uses_remaining: newRemaining,
        uses_consumed_total: (sub.uses_consumed_total || 0) + 1,
      });

      // Cria registro de uso
      const usage = await base44.asServiceRole.entities.SubscriptionUsage.create({
        company_id: sub.company_id,
        subscription_id,
        customer_id: sub.customer_id,
        appointment_id,
        service_id,
        service_name,
        cycle_start: sub.current_cycle_start,
        consumed_at: new Date().toISOString(),
        reverted: false,
      });

      // Vincula ao appointment
      await base44.asServiceRole.entities.Appointment.update(appointment_id, {
        payment_method: 'subscription',
        subscription_id,
        price: 0,
      });

      return Response.json({ success: true, usage_id: usage.id, uses_remaining: newRemaining });
    }

    // ─── DEVOLVER ───
    if (action === 'revert') {
      const usages = await base44.asServiceRole.entities.SubscriptionUsage.filter({
        appointment_id,
        reverted: false,
      });
      if (usages.length === 0) {
        return Response.json({ success: true, nothing_to_revert: true });
      }
      const usage = usages[0];

      // M3 — defesa em profundidade: o filter usa só appointment_id (sem company_id),
      // então em teoria 2 tenants poderiam compartilhar um appointment_id colidente.
      // Já validamos appt.company_id == sub.company_id acima, mas reforçamos aqui:
      // o usage TEM de pertencer ao MESMO tenant da sub que o caller já provou ser dele.
      if (usage.company_id && usage.company_id !== sub.company_id) {
        console.warn('[consumeSubscriptionUse] usage/sub tenant mismatch', {
          usage_company: usage.company_id, sub_company: sub.company_id,
        });
        return Response.json({ error: 'TENANT_MISMATCH_USAGE' }, { status: 403 });
      }
      if (usage.subscription_id !== subscription_id) {
        console.warn('[consumeSubscriptionUse] usage/sub mismatch', {
          usage_subscription: usage.subscription_id, requested: subscription_id,
        });
        return Response.json({ error: 'SUBSCRIPTION_MISMATCH' }, { status: 403 });
      }

      // Só devolve saldo se ainda estamos no mesmo ciclo
      const sameCycle = new Date(usage.cycle_start).getTime() === new Date(sub.current_cycle_start).getTime();
      if (sameCycle && sub.plan_type_snapshot !== 'unlimited') {
        await base44.asServiceRole.entities.CustomerSubscription.update(subscription_id, {
          uses_remaining: (sub.uses_remaining || 0) + 1,
          uses_consumed_total: Math.max(0, (sub.uses_consumed_total || 1) - 1),
        });
      }

      await base44.asServiceRole.entities.SubscriptionUsage.update(usage.id, {
        reverted: true,
        reverted_at: new Date().toISOString(),
      });

      await base44.asServiceRole.entities.Appointment.update(appointment_id, {
        payment_method: 'avulso',
        subscription_id: null,
      });

      return Response.json({ success: true, refunded: sameCycle });
    }
  } catch (error) {
    console.error('[consumeSubscriptionUse] erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});