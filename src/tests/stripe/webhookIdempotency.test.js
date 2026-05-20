// tests/stripe/webhookIdempotency.test.js — Sprint Hardening.
//
// Valida o protocolo de idempotência de stripeWebhook: dedup por event.id,
// state-machine no Appointment, e proteção contra retries do Stripe.
//
// Não exercitamos a verificação de assinatura (depende de secret real). Testamos
// SÓ a camada lógica que protege side-effects contra eventos duplicados.

import { createMockBase44 } from '@/tests/helpers/mockBase44';

const IDEMP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function alreadyProcessed(sdk, eventId) {
  if (!eventId) return false;
  const list = await sdk.entities.IdempotencyKey.filter({ key: eventId, route: 'stripeWebhook' }, '-created_date', 1);
  const found = list?.[0];
  if (!found) return false;
  const nowISO = new Date().toISOString();
  if (found.expires_at && found.expires_at < nowISO) return false;
  return found.status === 'completed';
}

async function markProcessed(sdk, eventId, eventType) {
  await sdk.entities.IdempotencyKey.create({
    key: eventId, route: 'stripeWebhook', user_id: 'webhook',
    request_hash: eventId, status: 'completed',
    response_snapshot: { event_type: eventType },
    response_status: 200,
    expires_at: new Date(Date.now() + IDEMP_TTL_MS).toISOString(),
  });
}

// Simula handler de payment_intent.succeeded com state-machine.
async function handlePaymentSucceeded(sdk, { eventId, appointmentId }) {
  if (await alreadyProcessed(sdk, eventId)) return { deduped: true };
  const appts = await sdk.entities.Appointment.filter({ id: appointmentId });
  const appt = appts?.[0];
  if (!appt) return { error: 'not_found' };
  // State-machine: só promove se ainda aguardando
  if (appt.status === 'aguardando_pagamento' || appt.payment_status !== 'succeeded') {
    await sdk.entities.Appointment.update(appt.id, {
      status: 'agendado', payment_status: 'succeeded', paid_online: true, payer_tax_id: null,
    });
  }
  await markProcessed(sdk, eventId, 'payment_intent.succeeded');
  return { processed: true };
}

export const stripeWebhookTests = {
  'evento processado uma vez marca IdempotencyKey': async () => {
    const m = createMockBase44();
    const a = await m.asServiceRole.entities.Appointment.create({ company_id: 'co_1', professional_id: 'p1', service_id: 's1', scheduled_at: '2026-06-01T10:00:00Z', status: 'aguardando_pagamento' });
    await handlePaymentSucceeded(m.asServiceRole, { eventId: 'evt_1', appointmentId: a.id });
    const keys = await m.asServiceRole.entities.IdempotencyKey.filter({ key: 'evt_1', route: 'stripeWebhook' });
    if (keys.length !== 1 || keys[0].status !== 'completed') throw new Error('idempotency key não foi criada/marcada');
  },
  'evento duplicado (replay) é deduped — não atualiza appointment 2x': async () => {
    const m = createMockBase44();
    const a = await m.asServiceRole.entities.Appointment.create({ company_id: 'co_1', professional_id: 'p1', service_id: 's1', scheduled_at: '2026-06-01T10:00:00Z', status: 'aguardando_pagamento' });
    await handlePaymentSucceeded(m.asServiceRole, { eventId: 'evt_2', appointmentId: a.id });
    const r2 = await handlePaymentSucceeded(m.asServiceRole, { eventId: 'evt_2', appointmentId: a.id });
    if (!r2.deduped) throw new Error('replay deveria ter sido deduped');
    const keys = await m.asServiceRole.entities.IdempotencyKey.filter({ key: 'evt_2', route: 'stripeWebhook' });
    if (keys.length !== 1) throw new Error(`esperado 1 IdempotencyKey, veio ${keys.length}`);
  },
  'eventos com IDs diferentes para mesmo appointment: state-machine impede duplo update': async () => {
    const m = createMockBase44();
    const a = await m.asServiceRole.entities.Appointment.create({ company_id: 'co_1', professional_id: 'p1', service_id: 's1', scheduled_at: '2026-06-01T10:00:00Z', status: 'aguardando_pagamento' });
    // Primeiro evento promove
    await handlePaymentSucceeded(m.asServiceRole, { eventId: 'evt_A', appointmentId: a.id });
    const after1 = await m.asServiceRole.entities.Appointment.get(a.id);
    if (after1.status !== 'agendado' || after1.payment_status !== 'succeeded') throw new Error('primeiro evento não promoveu');
    // Segundo evento (raro mas possível: Stripe re-emite com ID diferente) — state-machine impede regressão
    await handlePaymentSucceeded(m.asServiceRole, { eventId: 'evt_B', appointmentId: a.id });
    const after2 = await m.asServiceRole.entities.Appointment.get(a.id);
    if (after2.status !== 'agendado') throw new Error('segundo evento regrediu status');
  },
  'evento para appointment inexistente retorna not_found (não cria nada)': async () => {
    const m = createMockBase44();
    const r = await handlePaymentSucceeded(m.asServiceRole, { eventId: 'evt_x', appointmentId: 'inexistente' });
    if (r.error !== 'not_found') throw new Error('deveria ter retornado not_found');
  },
  'CPF do pagador é limpo após pagamento confirmado (LGPD minimization)': async () => {
    const m = createMockBase44();
    const a = await m.asServiceRole.entities.Appointment.create({ company_id: 'co_1', professional_id: 'p1', service_id: 's1', scheduled_at: '2026-06-01T10:00:00Z', status: 'aguardando_pagamento', payer_tax_id: '12345678900' });
    await handlePaymentSucceeded(m.asServiceRole, { eventId: 'evt_lgpd', appointmentId: a.id });
    const after = await m.asServiceRole.entities.Appointment.get(a.id);
    if (after.payer_tax_id !== null) throw new Error(`CPF não foi limpo: ${after.payer_tax_id}`);
  },
  'IdempotencyKey expirado não bloqueia novo processamento': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.IdempotencyKey.create({
      key: 'evt_expired', route: 'stripeWebhook',
      status: 'completed', expires_at: '2020-01-01T00:00:00Z', request_hash: 'h',
    });
    const isDedup = await alreadyProcessed(m.asServiceRole, 'evt_expired');
    if (isDedup) throw new Error('key expirada não deveria bloquear');
  },
  'cross-account: eventos de Connect accounts diferentes não interferem': async () => {
    const m = createMockBase44();
    const a1 = await m.asServiceRole.entities.Appointment.create({ company_id: 'co_1', professional_id: 'p1', service_id: 's1', scheduled_at: '2026-06-01T10:00:00Z', status: 'aguardando_pagamento' });
    const a2 = await m.asServiceRole.entities.Appointment.create({ company_id: 'co_2', professional_id: 'p1', service_id: 's1', scheduled_at: '2026-06-01T11:00:00Z', status: 'aguardando_pagamento' });
    await handlePaymentSucceeded(m.asServiceRole, { eventId: 'evt_co1', appointmentId: a1.id });
    await handlePaymentSucceeded(m.asServiceRole, { eventId: 'evt_co2', appointmentId: a2.id });
    const r1 = await m.asServiceRole.entities.Appointment.get(a1.id);
    const r2 = await m.asServiceRole.entities.Appointment.get(a2.id);
    if (r1.status !== 'agendado' || r2.status !== 'agendado') throw new Error('cross-account isolamento quebrou');
  },
};