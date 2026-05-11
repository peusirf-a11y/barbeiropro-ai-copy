// BFF — Mutations operadas pela barbearia sobre CustomerSubscription.
// Cobre apenas o lado "barbearia" (painel admin/recepção/financeiro). NÃO confundir com:
//   - customerSubscriptionAction → ações iniciadas pelo cliente final (assinar via link,
//     cancelar pelo painel cliente). Continua existindo e é o ponto de entrada do cliente.
//   - consumeSubscriptionUse → consumo/reversão de usos vinculado a appointment.
//   - reconcileCustomerSubscription / syncCustomerPlanToStripe → cron/integração Stripe.
//
// Por que existe (BFF Fase 5b):
//   Antes: `CustomerSubscriptionPanel` chamava CustomerSubscription.create/update direto.
//   Frontend decidia company_id (do prop, podia ser falsificado) e os snapshots do plano.
//   Vetor: payload com plan_price_snapshot=0.01 → "assinatura ativa" sem cobrança.
//
//   Agora: o servidor resolve company_id pelo caller, busca o Plan no banco e
//   monta o snapshot. Frontend só manda o plan_id.
//
// Actions (semânticas — NÃO generic create/update/delete, para evitar vazamento
// de campos como uses_remaining, stripe_customer_id, snapshots):
//
//   subscribe       { plan_id }                    → cria assinatura active no ciclo atual
//   cancel          { subscription_id }            → marca canceled + canceled_at
//   pause           { subscription_id }            → pausa (paused_at)
//   resume          { subscription_id }            → volta para active
//   mark_payment    { subscription_id, status }    → status ∈ {pago, pendente, atrasado}
//
// Restrições:
//   - barbeiro bloqueado (operações financeiras)
//   - cross-tenant retorna 404 genérico
//   - super_admin: USE_MASTER_PANEL
//   - Stripe-managed subscriptions (com stripe_subscription_id) NÃO podem ser canceladas
//     diretamente daqui — devem passar por customerSubscriptionAction ou portal Stripe
//     (evita desync com a Stripe).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  const sdk = base44.asServiceRole;

  if (user.is_super_admin) {
    return { role: 'super_admin', is_super_admin: true, email: user.email };
  }

  const ownerHits = await sdk.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (ownerHits?.length) {
    return {
      role: 'admin',
      company_id: ownerHits[0].id,
      company: ownerHits[0],
      email: user.email,
      is_owner: true,
    };
  }

  const tmHits = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  const tm = tmHits?.[0];
  if (!tm) throw new AuthzError('NO_TEAM_MEMBER', 403);
  if (tm.active === false) throw new AuthzError('USER_INACTIVE', 403);

  const company = await sdk.entities.Company.get(tm.company_id).catch(() => null);
  if (!company) throw new AuthzError('COMPANY_NOT_FOUND', 404);

  return {
    role: tm.role,
    company_id: tm.company_id,
    company,
    email: user.email,
  };
}

// Apenas roles operacionais podem mutar assinaturas. barbeiro NÃO (operação financeira).
const ALLOWED_ROLES = new Set(['admin', 'recepcao', 'financeiro']);

function notFound() { return Response.json({ error: 'NOT_FOUND' }, { status: 404 }); }

// Porta direta de `buildInitialSubscription` do lib/subscriptions.js — mantemos
// a regra de negócio aqui no servidor para garantir snapshots corretos.
function buildSnapshot(plan) {
  const now = new Date();
  const cycleEnd = new Date(now);
  cycleEnd.setMonth(cycleEnd.getMonth() + 1);
  const isUnlimited = plan.type === 'unlimited';
  const usageLimit = isUnlimited ? 9999 : (Number(plan.usage_limit) || 0);
  return {
    plan_id: plan.id,
    plan_name_snapshot: plan.name,
    plan_price_snapshot: Number(plan.price_monthly) || 0,
    plan_type_snapshot: plan.type,
    plan_usage_limit_snapshot: usageLimit,
    status: 'active',
    started_at: now.toISOString(),
    current_cycle_start: now.toISOString(),
    current_cycle_end: cycleEnd.toISOString(),
    uses_remaining: usageLimit,
    uses_consumed_total: 0,
    last_payment_status: 'pendente',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);
    if (caller.is_super_admin) {
      return Response.json({ error: 'USE_MASTER_PANEL' }, { status: 403 });
    }
    if (!ALLOWED_ROLES.has(caller.role)) {
      return Response.json({ error: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body || {};

    if (!['subscribe', 'cancel', 'pause', 'resume', 'mark_payment'].includes(action)) {
      return Response.json({ error: 'INVALID_ACTION' }, { status: 400 });
    }

    const sdk = base44.asServiceRole;

    // ─── SUBSCRIBE ─────────────────────────────────────────────────────
    if (action === 'subscribe') {
      const { customer_id, plan_id } = body;
      if (!customer_id || !plan_id) {
        return Response.json({ error: 'CUSTOMER_AND_PLAN_REQUIRED' }, { status: 400 });
      }

      // Customer DEVE pertencer ao tenant do caller (404 genérico se não).
      let customer;
      try { customer = await sdk.entities.Customer.get(customer_id); }
      catch { return notFound(); }
      if (!customer || customer.company_id !== caller.company_id) return notFound();

      // Plano também — não pode "tomar emprestado" plano de outra barbearia.
      let plan;
      try { plan = await sdk.entities.CustomerPlan.get(plan_id); }
      catch { return notFound(); }
      if (!plan || plan.company_id !== caller.company_id) return notFound();
      if (plan.active === false) {
        return Response.json({ error: 'PLAN_INACTIVE' }, { status: 400 });
      }

      // Bloqueia subscrição duplicada ativa (uma por cliente).
      const existing = await sdk.entities.CustomerSubscription.filter(
        { company_id: caller.company_id, customer_id, status: 'active' }, '-started_at', 1
      );
      if (existing?.length) {
        return Response.json({ error: 'ALREADY_SUBSCRIBED', subscription_id: existing[0].id }, { status: 409 });
      }

      const subscription = await sdk.entities.CustomerSubscription.create({
        ...buildSnapshot(plan),
        company_id: caller.company_id,
        customer_id,
        self_service_signup: false, // assinou pela barbearia, não pelo link público
      });

      return Response.json({ subscription });
    }

    // Actions abaixo precisam do subscription_id.
    const { subscription_id } = body;
    if (!subscription_id) {
      return Response.json({ error: 'SUBSCRIPTION_ID_REQUIRED' }, { status: 400 });
    }

    let sub;
    try { sub = await sdk.entities.CustomerSubscription.get(subscription_id); }
    catch { return notFound(); }
    if (!sub || sub.company_id !== caller.company_id) return notFound();

    // Stripe-managed: bloqueia ações que precisam ser feitas pela Stripe (cancel/pause/resume).
    // Marcar pagamento manual em sub com Stripe é OK (ex.: barbearia confirmou recebimento
    // por fora antes do webhook chegar — é só hint visual). Cancel/pause não podem.
    const isStripeManaged = !!sub.stripe_subscription_id;

    // ─── CANCEL ────────────────────────────────────────────────────────
    if (action === 'cancel') {
      if (isStripeManaged) {
        return Response.json({ error: 'STRIPE_MANAGED_USE_PORTAL' }, { status: 409 });
      }
      if (sub.status === 'canceled') {
        return Response.json({ subscription: sub }); // idempotente
      }
      const subscription = await sdk.entities.CustomerSubscription.update(subscription_id, {
        status: 'canceled',
        canceled_at: new Date().toISOString(),
      });
      return Response.json({ subscription });
    }

    // ─── PAUSE ─────────────────────────────────────────────────────────
    if (action === 'pause') {
      if (isStripeManaged) {
        return Response.json({ error: 'STRIPE_MANAGED_USE_PORTAL' }, { status: 409 });
      }
      if (sub.status !== 'active') {
        return Response.json({ error: 'NOT_ACTIVE' }, { status: 400 });
      }
      const subscription = await sdk.entities.CustomerSubscription.update(subscription_id, {
        status: 'paused',
        paused_at: new Date().toISOString(),
      });
      return Response.json({ subscription });
    }

    // ─── RESUME ────────────────────────────────────────────────────────
    if (action === 'resume') {
      if (isStripeManaged) {
        return Response.json({ error: 'STRIPE_MANAGED_USE_PORTAL' }, { status: 409 });
      }
      if (sub.status !== 'paused') {
        return Response.json({ error: 'NOT_PAUSED' }, { status: 400 });
      }
      const subscription = await sdk.entities.CustomerSubscription.update(subscription_id, {
        status: 'active',
        paused_at: null,
      });
      return Response.json({ subscription });
    }

    // ─── MARK PAYMENT ──────────────────────────────────────────────────
    if (action === 'mark_payment') {
      const { status } = body;
      if (!['pago', 'pendente', 'atrasado'].includes(status)) {
        return Response.json({ error: 'INVALID_PAYMENT_STATUS' }, { status: 400 });
      }
      const update = { last_payment_status: status };
      if (status === 'pago') update.last_payment_at = new Date().toISOString();
      const subscription = await sdk.entities.CustomerSubscription.update(subscription_id, update);
      return Response.json({ subscription });
    }

    return Response.json({ error: 'INVALID_ACTION' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    console.error('[mutateSubscription] error:', error.message, error.stack);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});