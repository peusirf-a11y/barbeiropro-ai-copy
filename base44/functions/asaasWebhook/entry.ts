// asaasWebhook — recebe eventos do Asaas (cobranças, assinaturas, estornos).
//
// Eventos tratados (Etapa 2A):
//   PAYMENT_CONFIRMED   → invoice paga (cartão/boleto compensado). Marca subscription active.
//   PAYMENT_RECEIVED    → equivalente a PAYMENT_CONFIRMED em alguns fluxos.
//   PAYMENT_OVERDUE     → invoice vencida. Marca past_due.
//   PAYMENT_REFUNDED    → reembolso. Marca subscription como canceled (se SaaS).
//   SUBSCRIPTION_DELETED→ assinatura cancelada no Asaas.
//
// Segurança:
//   Asaas suporta enviar header `asaas-access-token` quando o webhook é registrado
//   com authToken. Validamos esse token contra ASAAS_WEBHOOK_TOKEN (constant-time).
//   Sem o token correto → 401.
//
// Idempotência:
//   Cada event vem com `id` único. Usamos IdempotencyKey para garantir 1-shot.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const IDEMPOTENCY_TTL_DAYS = 7;

function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  const corrId = crypto.randomUUID().split('-')[0];
  try {
    // ─── 1. Auth ─────────────────────────────────────────────────────
    const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN') || '';
    if (!expectedToken) {
      console.error('[asaasWebhook] ASAAS_WEBHOOK_TOKEN not configured');
      return Response.json({ error: 'webhook_not_configured' }, { status: 503 });
    }
    const receivedToken = req.headers.get('asaas-access-token') || '';
    if (!constantTimeEquals(receivedToken, expectedToken)) {
      console.warn('[asaasWebhook] invalid token', { corrId, has_token: !!receivedToken });
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    // ─── 2. Parse + idempotência ────────────────────────────────────
    const evt = await req.json().catch(() => null);
    if (!evt?.event || !evt?.id) {
      console.warn('[asaasWebhook] malformed event', { corrId });
      return Response.json({ error: 'bad_request' }, { status: 400 });
    }
    const eventType = String(evt.event);
    const eventId = String(evt.id);

    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;

    // Idempotência: rejeita event já processado
    const idemKey = `asaas:${eventId}`;
    const existing = await sdk.entities.IdempotencyKey.filter({ key: idemKey, route: 'asaasWebhook' }, '-created_date', 1).catch(() => []);
    const prior = existing?.[0];
    if (prior && prior.status === 'completed') {
      console.log('[asaasWebhook] replay ignored', { corrId, eventId, eventType });
      return Response.json({ ok: true, replay: true });
    }
    let idemRecord = prior;
    if (!idemRecord) {
      idemRecord = await sdk.entities.IdempotencyKey.create({
        key: idemKey,
        route: 'asaasWebhook',
        status: 'pending',
        expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_DAYS * 86400_000).toISOString(),
      }).catch(() => null);
    }

    console.log('[asaasWebhook] received', { corrId, eventType, eventId });

    // ─── 3. Dispatch ────────────────────────────────────────────────
    let outcome = { handled: false, reason: 'unknown_event' };
    try {
      if (eventType === 'PAYMENT_CONFIRMED' || eventType === 'PAYMENT_RECEIVED') {
        outcome = await handlePaymentConfirmed(sdk, evt);
      } else if (eventType === 'PAYMENT_OVERDUE') {
        outcome = await handlePaymentOverdue(sdk, evt);
      } else if (eventType === 'PAYMENT_REFUNDED' || eventType === 'PAYMENT_DELETED') {
        outcome = await handlePaymentRefunded(sdk, evt);
      } else if (eventType === 'SUBSCRIPTION_DELETED') {
        outcome = await handleSubscriptionDeleted(sdk, evt);
      } else {
        // Aceita silenciosamente eventos não tratados (PAYMENT_CREATED, PAYMENT_UPDATED, etc.)
        outcome = { handled: false, reason: 'event_not_subscribed' };
      }
    } catch (err) {
      console.error('[asaasWebhook] handler error', { corrId, eventType, eventId, err: err.message, stack: err.stack });
      // Marca falha mas devolve 500 — Asaas vai retentar
      if (idemRecord?.id) {
        await sdk.entities.IdempotencyKey.update(idemRecord.id, { status: 'failed' }).catch(() => {});
      }
      return Response.json({ error: 'handler_error', message: err.message }, { status: 500 });
    }

    // Marca processado
    if (idemRecord?.id) {
      await sdk.entities.IdempotencyKey.update(idemRecord.id, {
        status: 'completed',
        response_snapshot: outcome,
        response_status: 200,
      }).catch(() => {});
    }

    console.log('[asaasWebhook] handled', { corrId, eventType, eventId, outcome, latency_ms: Date.now() - startedAt });
    return Response.json({ ok: true, ...outcome });
  } catch (err) {
    console.error('[asaasWebhook] fatal', { corrId, msg: err.message, stack: err.stack });
    return Response.json({ error: 'internal_error', message: err.message }, { status: 500 });
  }
});

// ─── Handlers ───────────────────────────────────────────────────────

async function handlePaymentConfirmed(sdk, evt) {
  const payment = evt.payment;
  if (!payment) return { handled: false, reason: 'no_payment' };
  const subId = payment.subscription;
  const externalRef = payment.externalReference || '';

  // Booking público (Etapa 2B). externalReference = "booking:<appointment_id>".
  if (externalRef.startsWith('booking:')) {
    const appointmentId = externalRef.slice('booking:'.length);
    const appts = await sdk.entities.Appointment.filter({ id: appointmentId }, '-created_date', 1).catch(() => []);
    const appt = appts?.[0];
    if (!appt) return { handled: false, reason: 'appointment_not_found' };
    // Idempotente: se já estava pago, não reescreve.
    if (appt.payment_status === 'succeeded') {
      return { handled: true, type: 'booking', appointment_id: appt.id, replay: true };
    }
    await sdk.entities.Appointment.update(appt.id, {
      status: 'agendado',
      payment_status: 'succeeded',
      paid_online: true,
      paid: true,
      paid_at: new Date().toISOString(),
    });
    return { handled: true, type: 'booking', appointment_id: appt.id };
  }

  // SaaS subscription? (externalReference = "saas:email:plan")
  if (externalRef.startsWith('saas:') || subId) {
    const companies = await sdk.entities.Company.filter(
      subId ? { asaas_subscription_id: subId } : { asaas_customer_id: payment.customer },
      '-created_date', 1,
    ).catch(() => []);
    const company = companies?.[0];
    if (!company) {
      console.warn('[asaasWebhook] company not found for sub', { subId, customer: payment.customer });
      return { handled: false, reason: 'company_not_found' };
    }

    const nextPeriodEnd = payment.dueDate
      ? new Date(new Date(payment.dueDate).getTime() + 30 * 86400_000).toISOString()
      : undefined;

    await sdk.entities.Company.update(company.id, {
      status: 'active',
      subscription_status: 'active',
      asaas_account_status: 'active',
      is_blocked_by_billing: false,
      current_period_end: nextPeriodEnd,
    });

    return { handled: true, type: 'saas_subscription', company_id: company.id };
  }

  return { handled: false, reason: 'no_subscription_match' };
}

async function handlePaymentOverdue(sdk, evt) {
  const payment = evt.payment;
  if (!payment) return { handled: false, reason: 'no_payment' };
  const subId = payment.subscription;
  if (!subId) return { handled: false, reason: 'no_subscription_id' };

  const companies = await sdk.entities.Company.filter({ asaas_subscription_id: subId }, '-created_date', 1).catch(() => []);
  const company = companies?.[0];
  if (!company) return { handled: false, reason: 'company_not_found' };

  await sdk.entities.Company.update(company.id, {
    subscription_status: 'past_due',
    asaas_account_status: 'pending',
    is_blocked_by_billing: true,
  });

  return { handled: true, type: 'saas_overdue', company_id: company.id };
}

async function handlePaymentRefunded(sdk, evt) {
  const payment = evt.payment;
  if (!payment) return { handled: false, reason: 'no_payment' };
  const subId = payment.subscription;
  if (!subId) return { handled: false, reason: 'no_subscription_id' };

  const companies = await sdk.entities.Company.filter({ asaas_subscription_id: subId }, '-created_date', 1).catch(() => []);
  const company = companies?.[0];
  if (!company) return { handled: false, reason: 'company_not_found' };

  await sdk.entities.Company.update(company.id, {
    subscription_status: 'canceled',
    asaas_account_status: 'blocked',
    is_blocked_by_billing: true,
  });

  return { handled: true, type: 'saas_refunded', company_id: company.id };
}

async function handleSubscriptionDeleted(sdk, evt) {
  const sub = evt.subscription;
  if (!sub?.id) return { handled: false, reason: 'no_subscription' };

  const companies = await sdk.entities.Company.filter({ asaas_subscription_id: sub.id }, '-created_date', 1).catch(() => []);
  const company = companies?.[0];
  if (!company) return { handled: false, reason: 'company_not_found' };

  await sdk.entities.Company.update(company.id, {
    subscription_status: 'canceled',
    asaas_account_status: 'blocked',
  });

  return { handled: true, type: 'saas_cancelled', company_id: company.id };
}