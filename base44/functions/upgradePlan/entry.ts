// upgradePlan — Atualiza o plano de uma Company no Stripe + sincroniza local.
// Fluxo:
//   1) RBAC: caller deve ser admin do tenant (ou super_admin)
//   2) Busca a Subscription no Stripe e troca o item para o novo price
//   3) Atualiza Company.plan_id / plan_name (status real virá do webhook)
//   4) AuditLog
//
// Payload: { plan_id }
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}
async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  if (user.is_super_admin) return { role: 'super_admin', is_super_admin: true, email: user.email };
  const tm = await base44.asServiceRole.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  if (tm?.length) {
    if (tm[0].active === false) throw new AuthzError('USER_INACTIVE', 403);
    return { role: tm[0].role, company_id: tm[0].company_id, email: user.email };
  }
  const co = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (co?.length) return { role: 'admin', company_id: co[0].id, email: user.email, is_owner: true };
  throw new AuthzError('NO_TEAM_MEMBER', 403);
}
function ensureRole(caller, allowed) {
  if (caller.is_super_admin) return;
  if (!allowed.includes(caller.role)) throw new AuthzError('FORBIDDEN_ROLE', 403);
}
function authzErrorResponse(error) {
  if (error instanceof AuthzError) return Response.json({ success: false, error: error.code }, { status: error.status });
  return null;
}

Deno.serve(async (req) => {
  console.log('[upgradePlan] start');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);
    ensureRole(caller, ['admin']); // somente admin/owner pode mudar plano

    const { plan_id } = await req.json().catch(() => ({}));
    if (!plan_id) return Response.json({ success: false, error: 'plan_id required' }, { status: 400 });

    // Resolve a company do caller
    const company_id = caller.is_super_admin ? null : caller.company_id;
    if (!company_id) return Response.json({ success: false, error: 'NO_COMPANY' }, { status: 400 });

    let company;
    try {
      company = await base44.asServiceRole.entities.Company.get(company_id);
    } catch (_e) {
      return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
    }
    if (!company) return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });

    let plan;
    try {
      plan = await base44.asServiceRole.entities.Plan.get(plan_id);
    } catch (_e) {
      return Response.json({ success: false, error: 'PLAN_NOT_FOUND' }, { status: 404 });
    }
    if (!plan?.stripe_price_id) {
      return Response.json({ success: false, error: 'PLAN_HAS_NO_STRIPE_PRICE' }, { status: 400 });
    }

    // Gate de visibilidade: super_admin pode tudo; tenant precisa de acesso ao plano.
    // - public: ok
    // - private: company_id deve estar em allowed_company_ids
    // - invite_only: NUNCA permitido por aqui — cliente precisa redimir invite primeiro
    if (!caller.is_super_admin) {
      const v = plan.visibility || 'public';
      const allowed = Array.isArray(plan.allowed_company_ids) ? plan.allowed_company_ids : [];
      const isAllowed = v === 'public' || (v === 'private' && allowed.includes(company_id));
      if (!isAllowed) {
        try {
          await base44.asServiceRole.entities.SecurityEvent.create({
            event_type: 'unauthorized_plan_access', severity: 'high',
            actor_email: user.email, company_id, route: 'upgradePlan',
            details: { plan_id, plan_visibility: v }, blocked: true,
          });
        } catch (_e) { /* never break on log */ }
        return Response.json({ success: false, error: 'PLAN_NOT_AVAILABLE' }, { status: 403 });
      }
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Caminho A — a Company AINDA não tem subscription ativa no Stripe (trial, checkout
    // não concluído, sub cancelada). Em vez de falhar, criamos uma Checkout Session
    // para o novo plano: assim o cliente preenche cartão no Stripe e retorna ativo.
    if (!company.stripe_subscription_id) {
      const appUrl = Deno.env.get('APP_URL') || '';

      // Validação defensiva: stripe_customer_id pode estar órfão (cliente foi
      // excluído no Stripe ou pertence a outro env). Se inválido, limpa o vinculo
      // e cai para o fluxo de customer_email (Stripe cria um novo customer).
      let validCustomerId = company.stripe_customer_id || null;
      if (validCustomerId) {
        try {
          const cust = await stripe.customers.retrieve(validCustomerId);
          if (cust?.deleted) validCustomerId = null;
        } catch (custErr) {
          if (custErr?.code === 'resource_missing' || /No such customer/i.test(custErr?.message || '')) {
            console.warn('[upgradePlan] stripe_customer_id órfão — limpando', validCustomerId);
            validCustomerId = null;
            try {
              await base44.asServiceRole.entities.Company.update(company_id, { stripe_customer_id: null });
            } catch (_e) { /* segue mesmo se falhar */ }
          } else {
            throw custErr;
          }
        }
      }

      try {
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
          customer: validCustomerId || undefined,
          customer_email: !validCustomerId ? (company.owner_email || user.email) : undefined,
          subscription_data: {
            metadata: {
              base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
              company_id,
              plan_id: plan.id,
            },
          },
          metadata: {
            base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
            company_id,
            plan_id: plan.id,
            source: 'upgradePlan_no_active_sub',
          },
          success_url: `${appUrl}/app/configuracoes/assinatura?activated=1`,
          cancel_url: `${appUrl}/app/configuracoes/assinatura?cancelled=1`,
          allow_promotion_codes: true,
        });
        console.log('[upgradePlan] no active sub — created checkout session', session.id);
        return Response.json({
          success: true,
          requires_checkout: true,
          checkout_url: session.url,
          plan: { id: plan.id, name: plan.name, stripe_price_id: plan.stripe_price_id },
        });
      } catch (checkoutErr) {
        console.error('[upgradePlan] checkout creation failed:', checkoutErr.message);
        return Response.json({ success: false, error: 'CHECKOUT_CREATE_FAILED' }, { status: 500 });
      }
    }

    // Caminho B — já existe subscription, atualiza item para o novo price (upgrade/downgrade).
    let sub;
    try {
      sub = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
    } catch (stripeErr) {
      // Subscription foi excluída/cancelada no Stripe mas o ID continua salvo no Company.
      // Limpa o vínculo órfão e devolve erro amigável (frontend orienta a refazer checkout).
      if (stripeErr?.code === 'resource_missing' || /No such subscription/i.test(stripeErr?.message || '')) {
        console.warn('[upgradePlan] subscription órfã — limpando vínculo', company.stripe_subscription_id);
        await base44.asServiceRole.entities.Company.update(company_id, {
          stripe_subscription_id: null,
          stripe_price_id: null,
          subscription_status: null,
        });
        return Response.json({ success: false, error: 'SUBSCRIPTION_NOT_FOUND_REFRESH_CHECKOUT' }, { status: 400 });
      }
      throw stripeErr;
    }
    const itemId = sub.items?.data?.[0]?.id;
    if (!itemId) return Response.json({ success: false, error: 'STRIPE_ITEM_NOT_FOUND' }, { status: 500 });

    const updated = await stripe.subscriptions.update(company.stripe_subscription_id, {
      items: [{ id: itemId, price: plan.stripe_price_id }],
      proration_behavior: 'create_prorations',
    });

    const before = { plan_id: company.plan_id, plan_name: company.plan_name, stripe_price_id: company.stripe_price_id };
    await base44.asServiceRole.entities.Company.update(company_id, {
      plan_id: plan.id,
      plan_name: plan.name,
      stripe_price_id: plan.stripe_price_id,
    });

    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_email: user.email,
        actor_is_super_admin: !!caller.is_super_admin,
        action: 'UPGRADE_PLAN',
        target_type: 'Company',
        target_id: company_id,
        before,
        after: { plan_id: plan.id, plan_name: plan.name, stripe_price_id: plan.stripe_price_id },
        metadata: { subscription_id: company.stripe_subscription_id, stripe_status: updated.status },
      });
    } catch (auditErr) {
      console.warn('[upgradePlan] audit log failed:', auditErr.message);
    }

    console.log('[upgradePlan] ok', { user: user.email, company_id, plan_id, plan_name: plan.name });
    return Response.json({
      success: true,
      plan: { id: plan.id, name: plan.name, stripe_price_id: plan.stripe_price_id },
      subscription_status: updated.status,
    });
  } catch (error) {
    const az = authzErrorResponse(error);
    if (az) {
      console.warn('[upgradePlan] authz blocked:', error.code);
      return az;
    }
    console.error('[upgradePlan] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});