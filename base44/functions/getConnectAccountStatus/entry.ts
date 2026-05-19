// getConnectAccountStatus — sincroniza status da conta Connect com a Company.
// Chamado:
//  - Após o redirect de retorno do onboarding.
//  - Por polling no painel se o dono ficou aguardando aprovação.
//  - Pelo PublicBooking (via getCompanyConnectStatus) para validar que o link
//    público pode aceitar pagamentos.
//
// Atualiza Company.stripe_connect_status / charges_enabled / payouts_enabled.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

function getStripeSecret() {
  const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  return key;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const stripe = new Stripe(getStripeSecret(), { apiVersion: '2024-06-20' });
    const body = await req.json().catch(() => ({}));
    const { company_id } = body;
    if (!company_id) return Response.json({ error: 'company_id required' }, { status: 400 });

    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies.length) return Response.json({ error: 'Company not found' }, { status: 404 });
    const company = companies[0];

    if (!company.stripe_connect_account_id) {
      return Response.json({
        connected: false,
        status: null,
        charges_enabled: false,
        payouts_enabled: false,
      });
    }

    const account = await stripe.accounts.retrieve(company.stripe_connect_account_id);
    const charges = !!account.charges_enabled;
    const payouts = !!account.payouts_enabled;
    const pixEnabled = account.capabilities?.pix_payments === 'active';
    const status = charges ? 'enabled' : (account.requirements?.disabled_reason ? 'disabled' : 'pending');

    await base44.asServiceRole.entities.Company.update(company.id, {
      stripe_connect_status: status,
      stripe_connect_charges_enabled: charges,
      stripe_connect_payouts_enabled: payouts,
      stripe_connect_pix_enabled: pixEnabled,
    });

    return Response.json({
      connected: true,
      account_id: account.id,
      status,
      charges_enabled: charges,
      payouts_enabled: payouts,
      pix_enabled: pixEnabled,
      capabilities: account.capabilities || null,
      requirements: account.requirements || null,
    });
  } catch (error) {
    console.error('[getConnectAccountStatus] error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});