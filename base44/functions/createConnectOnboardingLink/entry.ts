// createConnectOnboardingLink — cria (ou recupera) a conta Stripe Connect Express
// da barbearia e devolve o link de onboarding (KYC). Usado pelo dono no painel
// admin antes de poder receber pagamentos pelo link público.
//
// Fluxo:
//  1. Owner clica "Conectar Stripe" no painel.
//  2. Se Company.stripe_connect_account_id já existe → reutiliza.
//  3. Senão cria conta Express com country=BR, default_currency=brl.
//  4. Gera AccountLink (refresh_url + return_url) e devolve URL.
//
// Segurança: só o dono da empresa (owner_email) ou um admin do team pode chamar.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const body = await req.json().catch(() => ({}));
    const { company_id, return_url } = body;
    if (!company_id) return Response.json({ error: 'company_id required' }, { status: 400 });

    const companies = await base44.asServiceRole.entities.Company.filter({ id: company_id });
    if (!companies.length) return Response.json({ error: 'Company not found' }, { status: 404 });
    const company = companies[0];

    const userEmailLc = (user.email || '').toLowerCase();
    const ownerEmailLc = (company.owner_email || '').toLowerCase();
    const isOwner = ownerEmailLc && ownerEmailLc === userEmailLc;
    const teamMembers = await base44.asServiceRole.entities.TeamMember.filter({
      company_id, email: user.email,
    });
    const isAdmin = teamMembers[0]?.role === 'admin' || user.role === 'admin';
    if (!isOwner && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    let accountId = company.stripe_connect_account_id;

    // 1) Cria conta Connect se ainda não existe
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'BR',
        default_currency: 'brl',
        email: company.owner_email,
        business_type: 'company',
        business_profile: {
          name: company.name,
          mcc: '7230', // Beauty/Barber Shops
          url: `https://barbertrimly.base44.app/agendar/${company.slug || ''}`,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
          base44_company_id: company.id,
        },
      });
      accountId = account.id;
      await base44.asServiceRole.entities.Company.update(company.id, {
        stripe_connect_account_id: accountId,
        stripe_connect_status: 'pending',
      });
      console.log('[createConnectOnboardingLink] account created:', accountId, 'for', company.id);
    }

    // 2) Gera AccountLink (KYC)
    const baseUrl = return_url || `https://barbertrimly.base44.app/app/configuracoes`;
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}?stripe_connect=refresh`,
      return_url: `${baseUrl}?stripe_connect=return`,
      type: 'account_onboarding',
    });

    return Response.json({ url: link.url, account_id: accountId });
  } catch (error) {
    console.error('[createConnectOnboardingLink] error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});