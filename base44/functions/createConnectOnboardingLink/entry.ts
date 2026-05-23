// createConnectOnboardingLink — cria (ou recupera) a conta Stripe Connect Express
// da barbearia e devolve o link de onboarding (KYC). Usado pelo dono no painel
// admin antes de poder receber pagamentos pelo link público.
//
// Fluxo:
//  1. Owner clica "Conectar Stripe" no painel.
//  2. Se Company.stripe_connect_account_id já existe → valida no Stripe; se órfão, limpa.
//  3. Senão cria conta Express com country=BR, default_currency=brl.
//  4. Gera AccountLink (refresh_url + return_url) e devolve URL.
//
// Segurança: só o dono da empresa (owner_email) ou um admin do team pode chamar.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

function getStripeSecret() {
  const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  return key;
}

Deno.serve(async (req) => {
  try {
    // ─── STRIPE FREEZE (Etapa 1) ─────────────────────────────────
    // Migração Stripe → Asaas: nenhum novo onboarding Connect é iniciado.
    // Reativar (emergência): setar STRIPE_FREEZE=0.
    if ((Deno.env.get('STRIPE_FREEZE') || '1') !== '0') {
      console.warn('[createConnectOnboardingLink] STRIPE_FROZEN — onboarding rejected');
      return Response.json({
        error: 'stripe_freeze_active',
        message: 'A conexão com Stripe está pausada — estamos migrando para o Asaas. Em breve você poderá conectar pelo novo fluxo.',
      }, { status: 503 });
    }
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const stripe = new Stripe(getStripeSecret(), { apiVersion: '2024-06-20' });
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

    // 0) Se já existe accountId salvo, valida se ainda é acessível pela plataforma.
    // Conta pode ter sido criada em outro env (test/live) ou ter access revogado.
    // Nesse caso, limpa o vinculo órfão e cai no fluxo de criação de uma nova.
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
      } catch (accErr) {
        const msg = accErr?.message || '';
        if (accErr?.code === 'account_invalid' || accErr?.code === 'resource_missing' ||
            /not connected to your platform|does not exist|Application access/i.test(msg)) {
          console.warn('[createConnectOnboardingLink] stripe_connect_account_id órfão — limpando', accountId);
          await base44.asServiceRole.entities.Company.update(company.id, {
            stripe_connect_account_id: null,
            stripe_connect_status: null,
            stripe_connect_charges_enabled: false,
            stripe_connect_payouts_enabled: false,
            stripe_connect_pix_enabled: false,
          });
          accountId = null;
        } else {
          throw accErr;
        }
      }
    }

    // 1) Cria conta Connect se ainda não existe
    if (!accountId) {
      const stripeBusinessType = company.business_type === 'individual' ? 'individual' : 'company';

      const ad = company.address_details || {};
      const supportAddress = (ad.line1 && ad.city && ad.state && ad.postal_code) ? {
        line1: ad.line1,
        line2: ad.line2 || undefined,
        city: ad.city,
        state: ad.state,
        postal_code: String(ad.postal_code).replace(/\D/g, ''),
        country: ad.country || 'BR',
      } : undefined;

      const supportPhone = (company.phone || '').replace(/\D/g, '');

      const account = await stripe.accounts.create({
        type: 'express',
        country: 'BR',
        default_currency: 'brl',
        email: company.owner_email,
        business_type: stripeBusinessType,
        business_profile: {
          name: company.name,
          mcc: '7230',
          url: `https://barbertrimly.base44.app/agendar/${company.slug || ''}`,
          ...(supportPhone ? { support_phone: supportPhone } : {}),
          ...(supportAddress ? { support_address: supportAddress } : {}),
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
          base44_company_id: company.id,
          business_type: company.business_type || '',
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
    const raw = error.message || '';
    let friendly = raw;
    if (/not connected to your platform|does not exist|Application access/i.test(raw)) {
      friendly = 'A conta Stripe Connect anterior não está mais disponível. Tente novamente — vamos criar uma nova conta automaticamente.';
    }
    return Response.json({ error: friendly }, { status: 500 });
  }
});