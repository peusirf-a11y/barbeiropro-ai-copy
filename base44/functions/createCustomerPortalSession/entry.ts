import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Bloqueia super admin de abrir portal de cobrança (deveria usar Stripe Dashboard direto)
    if (user.is_super_admin) {
      return Response.json({ error: 'Super admins não podem alterar billing via portal. Use o Stripe Dashboard.' }, { status: 403 });
    }

    // TEST MODE: força chave de teste.
    const stripeKey = Deno.env.get('STRIPE_TEST_SECRET_KEY') || '';
    if (!stripeKey || !stripeKey.startsWith('sk_test_')) {
      return Response.json({ error: 'TEST_MODE: STRIPE_TEST_SECRET_KEY ausente ou inválida.' }, { status: 500 });
    }
    const stripe = new Stripe(stripeKey);
    const { return_url } = await req.json().catch(() => ({}));

    // Buscar empresa do usuário
    const companies = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email });
    const company = companies?.[0];

    if (!company || !company.stripe_customer_id) {
      return Response.json({ error: 'Nenhuma assinatura encontrada para este usuário.' }, { status: 404 });
    }

    const origin = req.headers.get('origin') || `https://${req.headers.get('host') || ''}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: company.stripe_customer_id,
      return_url: return_url || `${origin}/app/configuracoes/assinatura`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createCustomerPortalSession error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});