// Consome ou devolve um uso de assinatura de forma atômica e idempotente.
// - action="consume": valida saldo, decrementa uses_remaining, cria SubscriptionUsage, vincula ao Appointment
// - action="revert": marca usage como reverted=true e devolve uso (somente se ainda no mesmo ciclo)
//
// Usado pela agenda interna quando o atendente escolhe "Usar plano" ou cancela um agendamento
// que estava cobrindo por assinatura.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, subscription_id, appointment_id, service_id, service_name } = body;

    if (!action || !['consume', 'revert'].includes(action)) {
      return Response.json({ error: 'action inválida' }, { status: 400 });
    }
    if (!subscription_id || !appointment_id) {
      return Response.json({ error: 'parâmetros obrigatórios faltando' }, { status: 400 });
    }

    const sub = await base44.asServiceRole.entities.CustomerSubscription.get(subscription_id);
    if (!sub) return Response.json({ error: 'Assinatura não encontrada' }, { status: 404 });

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
        const appt = await base44.asServiceRole.entities.Appointment.get(appointment_id).catch(() => null);
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