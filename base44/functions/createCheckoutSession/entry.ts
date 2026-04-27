import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

const PLANS = {
  starter: { price_id: 'price_1TQrZARWNwmSffsEvByG8X2T', name: 'Starter' },
  pro: { price_id: 'price_1TQrZARWNwmSffsELiP0sg2i', name: 'Pro' },
  enterprise: { price_id: 'price_1TQrZARWNwmSffsEF7agRVO9', name: 'Enterprise' },
};

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const body = await req.json();
    const { plan, business_name, owner_name, email, phone } = body;

    if (!plan || !PLANS[plan]) {
      return Response.json({ error: 'Plano inválido' }, { status: 400 });
    }
    if (!business_name || !email || !owner_name) {
      return Response.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }

    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || '';

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
      },
    });

    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('createCheckoutSession error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});