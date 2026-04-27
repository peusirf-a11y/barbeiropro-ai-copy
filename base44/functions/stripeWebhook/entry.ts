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

      const ownerName = md.owner_name || '';
      const businessName = md.business_name || 'Minha Barbearia';
      const planName = md.plan_name || 'Starter';
      let isNewAccount = false;

      // Verificar se já existe empresa
      const existing = await base44.asServiceRole.entities.Company.filter({ owner_email: email });
      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.Company.update(existing[0].id, {
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          subscription_status: 'trialing',
          status: 'trial',
          plan_name: planName,
        });
        console.log('Updated existing company for', email);
      } else {
        const baseSlug = slugify(businessName);
        let slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
        // Garantir unicidade
        for (let i = 0; i < 5; i++) {
          const dup = await base44.asServiceRole.entities.Company.filter({ slug });
          if (!dup || dup.length === 0) break;
          slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
        }
        const trialEnds = new Date();
        trialEnds.setDate(trialEnds.getDate() + 7);

        await base44.asServiceRole.entities.Company.create({
          name: businessName,
          owner_email: email,
          owner_name: ownerName,
          whatsapp: md.phone || '',
          phone: md.phone || '',
          slug,
          plan_name: planName,
          status: 'trial',
          subscription_status: 'trialing',
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          trial_ends_at: trialEnds.toISOString(),
          onboarding_step: 1,
          onboarding_completed: false,
        });
        isNewAccount = true;
        console.log('Created company for', email);
      }

      // Enviar email de boas-vindas com link de acesso
      try {
        const origin = req.headers.get('origin') || `https://${req.headers.get('host') || 'barbertrimly.base44.app'}`;
        const accessLink = `${origin}/app/dashboard`;
        const firstName = (ownerName || '').split(' ')[0] || 'tudo certo';
        const subject = isNewAccount
          ? `Bem-vindo ao BarberTrimly, ${firstName}! 💈`
          : `Sua assinatura BarberTrimly foi atualizada`;

        const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#F8F7F3;color:#0F172A;">
  <div style="background:#fff;border-radius:16px;padding:32px 28px;border:1px solid rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#2563EB 0%,#60A5FA 100%);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.02em;">BarberTrimly 💈</div>
      <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px;">Plano ${planName} · 7 dias grátis</div>
    </div>
    <h1 style="font-size:22px;font-weight:900;margin:0 0 12px;letter-spacing:-0.02em;">Olá ${ownerName || 'tudo certo'}, sua conta está pronta!</h1>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
      Recebemos seu pagamento e sua barbearia <strong>${businessName}</strong> já está cadastrada.
      Você tem <strong>7 dias grátis</strong> para configurar tudo com calma.
    </p>
    <div style="background:#F8F7F3;border-radius:12px;padding:16px 18px;margin:20px 0;">
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Como acessar seu painel</div>
      <ol style="margin:0;padding-left:18px;color:#334155;font-size:14px;line-height:1.7;">
        <li>Clique no botão abaixo</li>
        <li>Faça login com este email: <strong>${email}</strong></li>
        <li>Complete o onboarding da sua barbearia</li>
      </ol>
    </div>
    <div style="text-align:center;margin:28px 0 16px;">
      <a href="${accessLink}" style="display:inline-block;background:#2563EB;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Acessar meu painel →
      </a>
    </div>
    <p style="color:#94A3B8;font-size:12px;text-align:center;margin:16px 0 0;">
      Login seguro via email — sem necessidade de senha.<br>
      Você pode cancelar a qualquer momento dentro do painel.
    </p>
  </div>
  <p style="color:#94A3B8;font-size:11px;text-align:center;margin-top:16px;">
    © ${new Date().getFullYear()} BarberTrimly · parte do TurboSaaS
  </p>
</div>`.trim();

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject,
          body: html,
          from_name: 'BarberTrimly',
        });
        console.log('Welcome email sent to', email);
      } catch (mailErr) {
        console.error('Failed to send welcome email:', mailErr.message);
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