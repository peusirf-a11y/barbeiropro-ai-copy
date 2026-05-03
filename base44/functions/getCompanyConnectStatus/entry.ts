// getCompanyConnectStatus — endpoint PÚBLICO (sem auth) usado pelo PublicBooking
// para descobrir se a barbearia pode aceitar pagamentos online.
// Retorna apenas o estado essencial — sem dados sensíveis da conta Stripe.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { slug, company_id } = body;
    if (!slug && !company_id) {
      return Response.json({ error: 'slug or company_id required' }, { status: 400 });
    }

    const filter = company_id ? { id: company_id } : { slug };
    const companies = await base44.asServiceRole.entities.Company.filter(filter);
    if (!companies.length) return Response.json({ error: 'Company not found' }, { status: 404 });
    const c = companies[0];

    return Response.json({
      can_accept_payments: !!c.stripe_connect_charges_enabled,
      status: c.stripe_connect_status || null,
      has_account: !!c.stripe_connect_account_id,
    });
  } catch (error) {
    console.error('[getCompanyConnectStatus] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});