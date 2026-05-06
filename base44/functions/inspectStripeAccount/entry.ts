// inspectStripeAccount — debug helper v2. Inspeciona uma conta Stripe usando
// as chaves atuais (test e live) pra descobrir país da plataforma e da conta.
// Apenas admins podem chamar.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { account_id } = body;
    if (!account_id) return Response.json({ error: 'account_id required' }, { status: 400 });

    const result = {
      account_id,
      test: null,
      live: null,
      platform_test: null,
      platform_live: null,
    };

    // TEST
    const testKey = Deno.env.get('STRIPE_TEST_SECRET_KEY');
    if (testKey) {
      const stripeTest = new Stripe(testKey);
      try {
        const platform = await stripeTest.accounts.retrieve();
        result.platform_test = { id: platform.id, country: platform.country, type: platform.type };
      } catch (e) {
        result.platform_test = { error: e.message };
      }
      try {
        const acct = await stripeTest.accounts.retrieve(account_id);
        result.test = {
          id: acct.id,
          country: acct.country,
          type: acct.type,
          charges_enabled: acct.charges_enabled,
          payouts_enabled: acct.payouts_enabled,
          details_submitted: acct.details_submitted,
          capabilities: acct.capabilities,
        };
      } catch (e) {
        result.test = { error: e.message };
      }
    } else {
      result.test = { error: 'STRIPE_TEST_SECRET_KEY ausente' };
    }

    // LIVE
    const liveKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (liveKey) {
      const stripeLive = new Stripe(liveKey);
      try {
        const platform = await stripeLive.accounts.retrieve();
        result.platform_live = { id: platform.id, country: platform.country, type: platform.type };
      } catch (e) {
        result.platform_live = { error: e.message };
      }
      try {
        const acct = await stripeLive.accounts.retrieve(account_id);
        result.live = {
          id: acct.id,
          country: acct.country,
          type: acct.type,
          charges_enabled: acct.charges_enabled,
          payouts_enabled: acct.payouts_enabled,
          details_submitted: acct.details_submitted,
          capabilities: acct.capabilities,
        };
      } catch (e) {
        result.live = { error: e.message };
      }
    } else {
      result.live = { error: 'STRIPE_SECRET_KEY ausente' };
    }

    return Response.json(result);
  } catch (error) {
    console.error('[inspectStripeAccount] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});