// Cria uma Stripe Checkout Session em modo `subscription` na conta Stripe Connect
// da barbearia, para o cliente final assinar um CustomerPlan.
//
// Pré-requisitos:
//  - Company.stripe_connect_account_id e charges_enabled
//  - CustomerPlan.stripe_price_id (sincronizado por syncCustomerPlanToStripe)
//  - Cliente autenticado via Customer.auth_token (área pública /cliente/:slug)
//
// Fluxo:
//  1) Valida cliente e plano
//  2) Cria CustomerSubscription como pending_payment (snapshot dos dados)
//  3) Cria Checkout Session com metadata para reconciliar no webhook
//  4) Retorna a URL para o frontend redirecionar
//
// O webhook stripeWebhook processa `checkout.session.completed` (Connect) e
// promove a CustomerSubscription para `active`.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';
import { addMonths } from 'npm:date-fns@3.6.0';

function getStripeSecret() {
  const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  return key;
}

async function authenticateCustomer(base44, { company_id, token }) {
  if (!token) return null;
  const list = await base44.asServiceRole.entities.Customer.filter({ company_id, auth_token: token });
  const customer = list[0];
  if (!customer) return null;
  if (customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) < new Date()) return null;
  return customer;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { company_id, token, plan_id, success_url, cancel_url } = body;

    if (!company_id || !plan_id) {
      return Response.json({ error: 'Parâmetros incompletos' }, { status: 400 });
    }

    const customer = await authenticateCustomer(base44, { company_id, token });
    if (!customer) {
      return Response.json({ error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    // Bloqueia duplicidade: já tem assinatura ativa/pendente/pausada?
    const existing = await base44.asServiceRole.entities.CustomerSubscription.filter({
      company_id, customer_id: customer.id,
    });
    const blocking = existing.find(s => ['active', 'pending_payment', 'paused'].includes(s.status));
    if (blocking) {
      return Response.json({ error: 'Você já possui uma assinatura ativa ou pendente.' }, { status: 409 });
    }

    // Carrega plano e empresa
    const plans = await base44.asServiceRole.entities.CustomerPlan.filter({ id: plan_id, company_id });
    const plan = plans[0];
    if (!plan || !plan.active) {
      return Response.json({ error: 'Plano não disponível' }, { status: 404 });
    }
    if (!plan.stripe_price_id) {
      return Response.json({ error: 'Este plano ainda não está configurado para pagamento online.' }, { status: 400 });
    }

    const company = await base44.asServiceRole.entities.Company.get(company_id);
    if (!company?.stripe_connect_account_id || !company?.stripe_connect_charges_enabled) {
      return Response.json({ error: 'A barbearia ainda não habilitou pagamentos online.' }, { status: 400 });
    }

    const stripe = new Stripe(getStripeSecret(), { apiVersion: '2024-06-20' });
    const stripeOpts = { stripeAccount: company.stripe_connect_account_id };

    // Cria a assinatura local em pending_payment ANTES da Checkout, para podermos
    // referenciá-la no metadata e o webhook saber qual subscription ativar.
    const now = new Date();
    const cycleEnd = addMonths(now, 1);
    const isUnlimited = plan.type === 'unlimited';

    const sub = await base44.asServiceRole.entities.CustomerSubscription.create({
      company_id,
      customer_id: customer.id,
      plan_id: plan.id,
      plan_name_snapshot: plan.name,
      plan_price_snapshot: plan.price_monthly,
      plan_type_snapshot: plan.type,
      plan_usage_limit_snapshot: isUnlimited ? 9999 : (plan.usage_limit || 0),
      status: 'pending_payment',
      started_at: now.toISOString(),
      current_cycle_start: now.toISOString(),
      current_cycle_end: cycleEnd.toISOString(),
      uses_remaining: isUnlimited ? 9999 : (plan.usage_limit || 0),
      uses_consumed_total: 0,
      last_payment_status: 'pendente',
      self_service_signup: true,
    });

    // URLs de retorno (default: voltam para a página do cliente)
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'https://ocorte.base44.app';
    const successURL = success_url || `${origin}/cliente/${company.slug}?subscription=success`;
    const cancelURL = cancel_url || `${origin}/cliente/${company.slug}/planos?subscription=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      customer_email: customer.email || undefined,
      success_url: successURL,
      cancel_url: cancelURL,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
        payment_kind: 'customer_plan',
        company_id,
        customer_id: customer.id,
        plan_id: plan.id,
        subscription_id: sub.id,
      },
      subscription_data: {
        metadata: {
          payment_kind: 'customer_plan',
          company_id,
          customer_id: customer.id,
          plan_id: plan.id,
          subscription_id: sub.id,
        },
      },
    }, stripeOpts);

    return Response.json({ url: session.url, session_id: session.id, subscription_id: sub.id });
  } catch (error) {
    console.error('[createCustomerPlanCheckout] erro:', error?.message, error);
    return Response.json({ error: error?.message || 'Erro ao iniciar checkout' }, { status: 500 });
  }
});