import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

// Resolve config Stripe baseado em STRIPE_ENVIRONMENT ('test' | 'live').
// Retorna { secretKey, webhookSecret, isLive } e valida prefixos.
function getStripeConfig() {
  const env = (Deno.env.get('STRIPE_ENVIRONMENT') || 'test').toLowerCase();
  const isLive = env === 'live';
  const secretKey = (isLive ? Deno.env.get('STRIPE_SECRET_KEY') : Deno.env.get('STRIPE_TEST_SECRET_KEY')) || '';
  const webhookSecret = (isLive ? Deno.env.get('STRIPE_WEBHOOK_SECRET') : Deno.env.get('STRIPE_TEST_WEBHOOK_SECRET')) || '';
  const expectedPrefix = isLive ? 'sk_live_' : 'sk_test_';
  if (!secretKey || !secretKey.startsWith(expectedPrefix)) {
    throw new Error(`Stripe secret missing/invalid for environment=${env} (expected ${expectedPrefix})`);
  }
  if (!webhookSecret) {
    throw new Error(`Stripe webhook secret missing for environment=${env}`);
  }
  console.log(`[stripe] environment=${env}`);
  return { secretKey, webhookSecret, isLive };
}

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
    const { secretKey, webhookSecret, isLive } = getStripeConfig();
    const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Rejeita eventos do ambiente errado (livemode mismatch).
    if (event.livemode !== isLive) {
      console.warn(`[stripeWebhook] env mismatch: event.livemode=${event.livemode}, app=${isLive ? 'live' : 'test'} — ignored:`, event.type, event.id);
      return Response.json({ received: true, ignored: 'environment_mismatch' });
    }

    console.log(`Stripe event: ${event.type} (env=${isLive ? 'live' : 'test'})`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const md = session.metadata || {};

      // ─── CUSTOMER PLAN CHECKOUT (Connect) ──────────────────────────────
      // Cliente final assinou um CustomerPlan via conta Connect da barbearia.
      // Promove a CustomerSubscription pending_payment para active.
      if (md.payment_kind === 'customer_plan' && md.subscription_id) {
        try {
          const subId = md.subscription_id;
          const sub = await base44.asServiceRole.entities.CustomerSubscription.get(subId).catch(() => null);
          if (sub && sub.status === 'pending_payment') {
            await base44.asServiceRole.entities.CustomerSubscription.update(subId, {
              status: 'active',
              last_payment_status: 'pago',
              last_payment_at: new Date().toISOString(),
              stripe_subscription_id: session.subscription || null,
              stripe_customer_id: session.customer || null,
            });
            console.log('[stripeWebhook] customer plan activated:', subId);
          }
        } catch (err) {
          console.error('[stripeWebhook] customer_plan handler error:', err.message);
        }
        return Response.json({ received: true });
      }

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
        // Stripe webhook não envia header `origin`, e `host` é a URL do Deno (que retorna 400 sem Base44-App-Id).
        // Sempre usar o domínio público do app.
        const accessLink = 'https://barbertrimly.base44.app/app/dashboard';
        const firstName = (ownerName || '').split(' ')[0] || 'tudo certo';
        const subject = isNewAccount
          ? `Bem-vindo ao O CORTE, ${firstName}! 💈`
          : `Sua assinatura O CORTE foi atualizada`;

        const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#F8F7F3;color:#0F172A;">
  <div style="background:#fff;border-radius:16px;padding:32px 28px;border:1px solid rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#2563EB 0%,#60A5FA 100%);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="color:#fff;font-size:22px;font-weight:900;letter-spacing:0.06em;">O CORTE 💈</div>
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
    © ${new Date().getFullYear()} O CORTE
  </p>
</div>`.trim();

        const companyForLog = existing?.[0] || (await base44.asServiceRole.entities.Company.filter({ owner_email: email }))?.[0];
        await base44.asServiceRole.functions.invoke('sendAuditedEmail', {
          to: email,
          subject,
          body: html,
          from_name: 'O CORTE',
          type: 'welcome',
          company_id: companyForLog?.id || null,
          metadata: { plan_name: planName, is_new_account: isNewAccount, stripe_session_id: session.id },
        });
        console.log('Welcome email queued for', email);
      } catch (mailErr) {
        console.error('Failed to send welcome email:', mailErr.message);
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const sub = event.data.object;
      const priceId = sub.items?.data?.[0]?.price?.id;

      // Mapear price_id -> Plan (fonte da verdade para MRR)
      let matchedPlan = null;
      if (priceId) {
        const plans = await base44.asServiceRole.entities.Plan.filter({ stripe_price_id: priceId });
        if (plans && plans.length > 0) matchedPlan = plans[0];
      }

      const companies = await base44.asServiceRole.entities.Company.filter({ stripe_subscription_id: sub.id });
      if (companies && companies.length > 0) {
        const c = companies[0];
        const before = {
          status: c.status,
          subscription_status: c.subscription_status,
          plan_id: c.plan_id,
        };

        const updates = {
          subscription_status: sub.status,
          stripe_price_id: priceId,
        };
        if (sub.current_period_end) {
          updates.current_period_end = new Date(sub.current_period_end * 1000).toISOString();
        }
        if (matchedPlan) {
          updates.plan_id = matchedPlan.id;
          updates.plan_name = matchedPlan.name;
        }

        // Hard-block do app conforme status do Stripe (fonte de verdade)
        if (sub.status === 'active') updates.status = 'active';
        else if (sub.status === 'trialing') updates.status = 'trial';
        else if (['past_due', 'unpaid', 'canceled', 'incomplete'].includes(sub.status)) updates.status = 'blocked';

        await base44.asServiceRole.entities.Company.update(c.id, updates);
        console.log('Synced subscription', sub.id, '->', c.id, 'status:', sub.status, 'plan:', matchedPlan?.name);

        // Disparar SystemAlert em situações críticas
        try {
          if (sub.status === 'past_due') {
            await base44.asServiceRole.entities.SystemAlert.create({
              type: 'payment_failed',
              severity: 'critical',
              message: `Pagamento em atraso: ${c.name}`,
              company_id: c.id,
              metadata: { subscription_id: sub.id, status: sub.status },
            });
          } else if (sub.status === 'canceled' || event.type === 'customer.subscription.deleted') {
            await base44.asServiceRole.entities.SystemAlert.create({
              type: 'subscription_canceled',
              severity: 'warning',
              message: `Assinatura cancelada: ${c.name}`,
              company_id: c.id,
              metadata: { subscription_id: sub.id },
            });
          }
        } catch (alertErr) {
          console.error('Falha ao criar SystemAlert:', alertErr.message);
        }

        // AuditLog do sync (rastreabilidade do Stripe)
        try {
          await base44.asServiceRole.entities.AuditLog.create({
            actor_email: 'stripe-webhook',
            action: `STRIPE_${event.type.toUpperCase().replace(/\./g, '_')}`,
            target_type: 'Company',
            target_id: c.id,
            before,
            after: { status: updates.status, subscription_status: updates.subscription_status, plan_id: updates.plan_id },
            metadata: { subscription_id: sub.id, price_id: priceId },
          });
        } catch (auditErr) {
          console.error('Falha ao gravar AuditLog do webhook:', auditErr.message);
        }
      } else {
        console.warn('Subscription event recebido mas nenhuma Company corresponde:', sub.id);
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
            is_blocked_by_billing: false,
          });
          console.log('[stripeWebhook] invoice.paid → unblocked', companies[0].id);
        }
      }
    }

    // ─── BOOKING PAYMENTS (Stripe Connect) ───────────────────────────
    // Eventos vindos de contas conectadas trazem `event.account`.
    // Tratamos payment_intent.{succeeded,payment_failed,canceled} para appointments.
    if (
      event.type === 'payment_intent.succeeded' ||
      event.type === 'payment_intent.payment_failed' ||
      event.type === 'payment_intent.canceled'
    ) {
      const pi = event.data.object;
      const apptId = pi.metadata?.appointment_id;
      const kind = pi.metadata?.payment_kind;
      // Ignoramos PIs que não são de booking (evita conflito com assinatura SaaS)
      if (kind === 'booking' && apptId) {
        try {
          const appts = await base44.asServiceRole.entities.Appointment.filter({ id: apptId });
          const appt = appts?.[0];
          if (appt) {
            if (event.type === 'payment_intent.succeeded') {
              // Idempotente: só promove se ainda estiver aguardando
              if (appt.status === 'aguardando_pagamento' || appt.payment_status !== 'succeeded') {
                await base44.asServiceRole.entities.Appointment.update(appt.id, {
                  status: 'agendado',
                  payment_status: 'succeeded',
                  paid_online: true,
                });
                console.log('[stripeWebhook] booking confirmed by payment:', apptId);
                // Dispara e-mail de confirmação (não bloqueia)
                if (appt.customer_email) {
                  base44.asServiceRole.functions
                    .invoke('sendBookingConfirmation', { appointment_id: apptId })
                    .catch(err => console.warn('[stripeWebhook] booking email failed:', err.message));
                }
              }
            } else if (event.type === 'payment_intent.payment_failed') {
              // Mantém o appointment como aguardando_pagamento — frontend permite retry
              await base44.asServiceRole.entities.Appointment.update(appt.id, {
                payment_status: 'failed',
              });
              console.log('[stripeWebhook] booking payment failed:', apptId);
            } else if (event.type === 'payment_intent.canceled') {
              // Libera o slot
              if (appt.status === 'aguardando_pagamento') {
                await base44.asServiceRole.entities.Appointment.update(appt.id, {
                  status: 'cancelado',
                  payment_status: 'canceled',
                });
                console.log('[stripeWebhook] booking canceled:', apptId);
              }
            }
          }
        } catch (err) {
          console.error('[stripeWebhook] booking handler error:', err.message);
        }
      }
    }

    // ─── CONNECT ACCOUNT UPDATES ─────────────────────────────────────
    if (event.type === 'account.updated') {
      const acc = event.data.object;
      try {
        const companies = await base44.asServiceRole.entities.Company.filter({
          stripe_connect_account_id: acc.id,
        });
        if (companies.length) {
          const charges = !!acc.charges_enabled;
          const payouts = !!acc.payouts_enabled;
          const status = charges ? 'enabled' : (acc.requirements?.disabled_reason ? 'disabled' : 'pending');
          await base44.asServiceRole.entities.Company.update(companies[0].id, {
            stripe_connect_status: status,
            stripe_connect_charges_enabled: charges,
            stripe_connect_payouts_enabled: payouts,
          });
          console.log('[stripeWebhook] connect account synced:', acc.id, status);
        }
      } catch (err) {
        console.error('[stripeWebhook] account.updated error:', err.message);
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      if (invoice.subscription) {
        const companies = await base44.asServiceRole.entities.Company.filter({ stripe_subscription_id: invoice.subscription });
        if (companies && companies.length > 0) {
          const c = companies[0];
          await base44.asServiceRole.entities.Company.update(c.id, {
            subscription_status: 'past_due',
            is_blocked_by_billing: true,
          });

          try {
            await base44.asServiceRole.entities.SystemAlert.create({
              type: 'payment_failed',
              severity: 'critical',
              message: `Cobrança falhou: ${c.name}`,
              company_id: c.id,
              metadata: {
                subscription_id: invoice.subscription,
                invoice_id: invoice.id,
                amount_due: invoice.amount_due,
                attempt_count: invoice.attempt_count,
              },
            });
          } catch (alertErr) {
            console.error('[stripeWebhook] SystemAlert failed:', alertErr.message);
          }

          try {
            await base44.asServiceRole.entities.AuditLog.create({
              actor_email: 'stripe-webhook',
              action: 'STRIPE_INVOICE_PAYMENT_FAILED',
              target_type: 'Company',
              target_id: c.id,
              after: { is_blocked_by_billing: true, subscription_status: 'past_due' },
              metadata: { subscription_id: invoice.subscription, invoice_id: invoice.id },
            });
          } catch (auditErr) {
            console.error('[stripeWebhook] AuditLog failed:', auditErr.message);
          }

          console.log('[stripeWebhook] invoice.payment_failed → blocked', c.id);
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});