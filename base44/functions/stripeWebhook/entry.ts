import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

function slugify(text) {
  return (text || 'barbearia')
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'barbearia';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('Stripe event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const md = session.metadata || {};
      const email = md.email || session.customer_email;
      if (!email) {
        console.error('No email in session');
        return Response.json({ received: true });
      }

      // Verificar se já existe empresa
      const existing = await base44.asServiceRole.entities.Company.filter({ owner_email: email });
      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.Company.update(existing[0].id, {
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          subscription_status: 'trialing',
          status: 'trial',
          plan_name: md.plan_name || 'Starter',
        });
        console.log('Updated existing company for', email);
      } else {
        const baseSlug = slugify(md.business_name);
        const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
        const trialEnds = new Date();
        trialEnds.setDate(trialEnds.getDate() + 7);

        await base44.asServiceRole.entities.Company.create({
          name: md.business_name || 'Minha Barbearia',
          owner_email: email,
          owner_name: md.owner_name || '',
          whatsapp: md.phone || '',
          phone: md.phone || '',
          slug,
          plan_name: md.plan_name || 'Starter',
          status: 'trial',
          subscription_status: 'trialing',
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          trial_ends_at: trialEnds.toISOString(),
          onboarding_step: 1,
          onboarding_completed: false,
        });
        console.log('Created company for', email);
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const companies = await base44.asServiceRole.entities.Company.filter({ stripe_subscription_id: sub.id });
      if (companies && companies.length > 0) {
        const c = companies[0];
        const updates = {
          subscription_status: sub.status,
          stripe_price_id: sub.items?.data?.[0]?.price?.id,
        };
        if (sub.current_period_end) {
          updates.current_period_end = new Date(sub.current_period_end * 1000).toISOString();
        }
        if (sub.status === 'active') updates.status = 'active';
        else if (sub.status === 'trialing') updates.status = 'trial';
        else if (['past_due', 'unpaid', 'canceled', 'incomplete'].includes(sub.status)) updates.status = 'blocked';

        await base44.asServiceRole.entities.Company.update(c.id, updates);
        console.log('Updated subscription for company', c.id, 'status:', sub.status);
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      if (invoice.subscription) {
        const companies = await base44.asServiceRole.entities.Company.filter({ stripe_subscription_id: invoice.subscription });
        if (companies && companies.length > 0) {
          await base44.asServiceRole.entities.Company.update(companies[0].id, {
            status: 'active',
            subscription_status: 'active',
          });
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});