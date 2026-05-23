import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

// Price IDs Live (sistema opera em produção).
const PLANS = {
  starter:    { price_id: 'price_1TTyBpJBeMzbMF7xY38K2mTE', name: 'Starter' },
  pro:        { price_id: 'price_1TTyBpJBeMzbMF7x3Crs9tCG', name: 'Pro' },
  enterprise: { price_id: 'price_1TTyBpJBeMzbMF7xQWzBlm3y', name: 'Enterprise' },
};

function getStripeSecret() {
  const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  return key;
}

Deno.serve(async (req) => {
  try {
    // ─── STRIPE FREEZE (Etapa 1) ─────────────────────────────────
    // Migração Stripe → Asaas: novas assinaturas SaaS são bloqueadas.
    // Reativar (emergência): setar STRIPE_FREEZE=0.
    if ((Deno.env.get('STRIPE_FREEZE') || '1') !== '0') {
      console.warn('[createCheckoutSession] STRIPE_FROZEN — signup rejected');
      return Response.json({
        error: 'stripe_freeze_active',
        message: 'Estamos migrando o sistema de pagamentos. Novas assinaturas estão temporariamente pausadas — voltamos em breve.',
      }, { status: 503 });
    }
    const stripe = new Stripe(getStripeSecret(), { apiVersion: '2024-06-20' });
    const body = await req.json();
    const { plan, business_name, owner_name, email, phone, referral_code, referral_fingerprint } = body;

    if (!plan || !PLANS[plan]) {
      return Response.json({ error: 'Plano inválido' }, { status: 400 });
    }
    if (!business_name || !email || !owner_name) {
      return Response.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }

    const origin =
      req.headers.get('origin') ||
      req.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
      'https://ocorte.base44.app';

    console.log('[createCheckoutSession] creating session', { plan, email, origin });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PLANS[plan].price_id, quantity: 1 }],
      customer_email: email,
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          business_name,
          owner_name,
          phone: phone || '',
          plan_key: plan,
          plan_name: PLANS[plan].name,
        },
      },
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?cancelled=1`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        business_name,
        owner_name,
        email,
        phone: phone || '',
        plan_key: plan,
        plan_name: PLANS[plan].name,
        // Partner MVP: propaga código+fingerprint p/ stripeWebhook chamar partnerAttribute.
        referral_code: referral_code || '',
        referral_fingerprint: referral_fingerprint || '',
      },
    });

    if (!session?.url) {
      console.error('[createCheckoutSession] Stripe returned no url', session?.id);
      return Response.json({ error: 'Stripe não retornou URL de checkout. Tente novamente.' }, { status: 502 });
    }

    console.log('[createCheckoutSession] session created', session.id);
    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('[createCheckoutSession] Stripe error:', error?.type, error?.code, error?.message);
    const safeMsg = error?.message?.includes('Not a valid URL')
      ? 'Erro de configuração do checkout. Tente abrir o app em uma nova aba.'
      : (error?.message || 'Erro ao criar checkout');
    return Response.json({ error: safeMsg }, { status: 500 });
  }
});