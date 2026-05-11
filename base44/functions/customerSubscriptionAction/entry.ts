// Ações de assinatura disparadas pelo cliente final (área pública /cliente/:slug).
// Endpoint sem autenticação Base44 — autentica via token salvo em Customer.auth_token.
//
// Ações suportadas:
//  - subscribe: cria CustomerSubscription como pending_payment (barbearia confirma o pagamento depois)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { addMonths } from 'npm:date-fns@3.6.0';

async function authenticateCustomer(base44, { company_id, token }) {
  if (!token) return null;
  const list = await base44.asServiceRole.entities.Customer.filter({
    company_id, auth_token: token,
  });
  const customer = list[0];
  if (!customer) return null;
  if (customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) < new Date()) {
    return null;
  }
  return customer;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, company_id, token, plan_id, subscription_id } = body;

    if (!company_id || !action) {
      return Response.json({ error: 'Parâmetros incompletos' }, { status: 400 });
    }

    const customer = await authenticateCustomer(base44, { company_id, token });
    if (!customer) {
      return Response.json({ error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    // ─── ACTION: SUBSCRIBE — cria assinatura pending_payment ────────────────
    if (action === 'subscribe') {
      if (!plan_id) return Response.json({ error: 'plan_id obrigatório' }, { status: 400 });

      // Já tem assinatura ativa/pendente? Bloqueia duplicidade.
      const existing = await base44.asServiceRole.entities.CustomerSubscription.filter({
        company_id, customer_id: customer.id,
      });
      const blocking = existing.find(s => ['active', 'pending_payment', 'paused'].includes(s.status));
      if (blocking) {
        return Response.json({ error: 'Você já possui uma assinatura ativa ou pendente.' }, { status: 409 });
      }

      // Carrega o plano e valida (P0.6: double-check explícito do tenant)
      const plans = await base44.asServiceRole.entities.CustomerPlan.filter({ id: plan_id, company_id });
      const plan = plans[0];
      if (!plan || !plan.active) {
        return Response.json({ error: 'Plano não disponível' }, { status: 404 });
      }
      if (plan.company_id !== company_id) {
        console.warn('[customerSubscriptionAction] cross-tenant plan attempt', {
          customer_id: customer.id, plan_company: plan.company_id, requested_company: company_id,
        });
        return Response.json({ error: 'FORBIDDEN_TENANT' }, { status: 403 });
      }

      const now = new Date();
      const cycleEnd = addMonths(now, 1);
      const isUnlimited = plan.type === 'unlimited';

      const sub = await base44.asServiceRole.entities.CustomerSubscription.create({
        company_id,
        customer_id: customer.id,
        plan_id: plan.id,
        plan_name_snapshot: plan.name,
        plan_price_snapshot: plan.price_monthly,
        plan_type_snapshot: plan.type,
        plan_usage_limit_snapshot: isUnlimited ? 9999 : (plan.usage_limit || 0),
        status: 'pending_payment',
        started_at: now.toISOString(),
        current_cycle_start: now.toISOString(),
        current_cycle_end: cycleEnd.toISOString(),
        uses_remaining: isUnlimited ? 9999 : (plan.usage_limit || 0),
        uses_consumed_total: 0,
        last_payment_status: 'pendente',
        self_service_signup: true,
      });

      return Response.json({ success: true, subscription_id: sub.id });
    }

    // ─── ACTIONS: PAUSE / RESUME / CANCEL ─────────────────────────────────
    if (['pause', 'resume', 'cancel'].includes(action)) {
      if (!subscription_id) {
        return Response.json({ error: 'subscription_id obrigatório' }, { status: 400 });
      }

      // Carrega a assinatura e valida ownership
      const sub = await base44.asServiceRole.entities.CustomerSubscription.get(subscription_id).catch(() => null);
      if (!sub || sub.company_id !== company_id || sub.customer_id !== customer.id) {
        return Response.json({ error: 'Assinatura não encontrada' }, { status: 404 });
      }

      const nowISO = new Date().toISOString();

      if (action === 'pause') {
        if (sub.status !== 'active') {
          return Response.json({ error: 'Apenas assinaturas ativas podem ser pausadas.' }, { status: 400 });
        }
        await base44.asServiceRole.entities.CustomerSubscription.update(subscription_id, {
          status: 'paused', paused_at: nowISO,
        });
        return Response.json({ success: true });
      }

      if (action === 'resume') {
        if (sub.status !== 'paused') {
          return Response.json({ error: 'Apenas assinaturas pausadas podem ser retomadas.' }, { status: 400 });
        }
        await base44.asServiceRole.entities.CustomerSubscription.update(subscription_id, {
          status: 'active', paused_at: null,
        });
        return Response.json({ success: true });
      }

      if (action === 'cancel') {
        if (!['active', 'paused', 'pending_payment'].includes(sub.status)) {
          return Response.json({ error: 'Esta assinatura não pode ser cancelada.' }, { status: 400 });
        }
        await base44.asServiceRole.entities.CustomerSubscription.update(subscription_id, {
          status: 'canceled', canceled_at: nowISO,
        });
        return Response.json({ success: true });
      }
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('[customerSubscriptionAction] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});