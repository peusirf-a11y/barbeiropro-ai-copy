// Teste E2E temporário: cria checkout session e valida estado.
// Apaga depois dos testes.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const env = (Deno.env.get('STRIPE_ENVIRONMENT') || 'test').toLowerCase();
    const isLive = env === 'live';
    const key = isLive ? Deno.env.get('STRIPE_SECRET_KEY') : Deno.env.get('STRIPE_TEST_SECRET_KEY');
    const stripe = new Stripe(key, { apiVersion: '2024-06-20' });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'check_setup';

    if (action === 'check_setup') {
      // 1. Verifica secrets
      const wsAccount = Deno.env.get('STRIPE_TEST_WEBHOOK_SECRET') || '';
      const wsConnect = Deno.env.get('STRIPE_TEST_WEBHOOK_SECRET_CONNECT') || '';

      // 2. Lista webhooks registrados no Stripe
      const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });
      const webhooks = endpoints.data.map(w => ({
        id: w.id,
        url: w.url,
        status: w.status,
        connect: w.connect || false,
        events_count: w.enabled_events?.length || 0,
        livemode: w.livemode,
      }));

      return Response.json({
        environment: env,
        secrets: {
          STRIPE_TEST_WEBHOOK_SECRET: wsAccount ? `${wsAccount.slice(0, 8)}...${wsAccount.slice(-4)}` : 'MISSING',
          STRIPE_TEST_WEBHOOK_SECRET_CONNECT: wsConnect ? `${wsConnect.slice(0, 8)}...${wsConnect.slice(-4)}` : 'MISSING',
        },
        webhooks_registered_in_stripe: webhooks,
      });
    }

    if (action === 'check_session') {
      const session = await stripe.checkout.sessions.retrieve(body.session_id);
      return Response.json({
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        customer_email: session.customer_email,
        metadata: session.metadata,
        subscription: session.subscription,
      });
    }

    if (action === 'check_db') {
      const email = body.email;
      const companies = await base44.asServiceRole.entities.Company.filter({ owner_email: email });
      return Response.json({
        email,
        companies_found: companies.length,
        companies: companies.map(c => ({
          id: c.id,
          name: c.name,
          status: c.status,
          subscription_status: c.subscription_status,
          plan_name: c.plan_name,
          stripe_customer_id: c.stripe_customer_id,
          stripe_subscription_id: c.stripe_subscription_id,
          trial_ends_at: c.trial_ends_at,
          created_date: c.created_date,
        })),
      });
    }

    return Response.json({ error: 'unknown action', valid_actions: ['check_setup', 'check_session', 'check_db'] }, { status: 400 });
  } catch (error) {
    console.error('[testE2E] error:', error.message);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});