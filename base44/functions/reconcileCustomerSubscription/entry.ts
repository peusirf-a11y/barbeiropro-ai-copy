// Admin-only: reconcilia uma CustomerSubscription em pending_payment consultando
// o Stripe (Connect). Usado quando webhooks falharam ou foram perdidos.
//
// Fluxo:
//   1) Carrega a CustomerSubscription pelo id
//   2) Lista subscriptions ativas/trialing no Stripe Connect da Company filtrando
//      por metadata.subscription_id == sub.id
//   3) Se encontrar uma com status active/trialing → ativa localmente
//   4) Se não encontrar → retorna {found: false}

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

function getStripeSecret() {
  const env = (Deno.env.get('STRIPE_ENVIRONMENT') || 'test').toLowerCase();
  const isLive = env === 'live';
  const key = (isLive ? Deno.env.get('STRIPE_SECRET_KEY') : Deno.env.get('STRIPE_TEST_SECRET_KEY')) || '';
  if (!key) throw new Error(`Stripe secret missing for environment=${env}`);
  return key;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { subscription_id } = await req.json().catch(() => ({}));
    if (!subscription_id) return Response.json({ error: 'subscription_id required' }, { status: 400 });

    const sub = await base44.asServiceRole.entities.CustomerSubscription.get(subscription_id);
    if (!sub) return Response.json({ error: 'Subscription not found' }, { status: 404 });
    if (sub.status === 'active') {
      return Response.json({ ok: true, status: 'already_active' });
    }

    const company = await base44.asServiceRole.entities.Company.get(sub.company_id);
    if (!company?.stripe_connect_account_id) {
      return Response.json({ error: 'Company has no Connect account' }, { status: 400 });
    }

    const stripe = new Stripe(getStripeSecret(), { apiVersion: '2024-06-20' });
    const stripeOpts = { stripeAccount: company.stripe_connect_account_id };

    // Busca por metadata.subscription_id usando search API
    const search = await stripe.subscriptions.search({
      query: `metadata['subscription_id']:'${subscription_id}'`,
      limit: 5,
    }, stripeOpts);

    console.log(`[reconcile] found ${search.data.length} stripe subs for ${subscription_id}`);

    const stripeSub = search.data.find(s => s.status === 'active' || s.status === 'trialing');
    if (!stripeSub) {
      return Response.json({
        ok: false,
        found: false,
        stripe_subs: search.data.map(s => ({ id: s.id, status: s.status })),
      });
    }

    await base44.asServiceRole.entities.CustomerSubscription.update(subscription_id, {
      status: 'active',
      last_payment_status: 'pago',
      last_payment_at: new Date().toISOString(),
      stripe_subscription_id: stripeSub.id,
      stripe_customer_id: stripeSub.customer || null,
    });

    console.log(`[reconcile] activated ${subscription_id} from stripe sub ${stripeSub.id}`);
    return Response.json({
      ok: true,
      status: 'activated',
      stripe_subscription_id: stripeSub.id,
      stripe_status: stripeSub.status,
    });
  } catch (error) {
    console.error('[reconcileCustomerSubscription] error:', error?.message, error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});