// runHardeningTests — Sprint Hardening.
//
// Testes de concorrência, isolamento multi-tenant, idempotência Stripe,
// LGPD, sanitização e observabilidade. Roda separado de runFoundationTests
// pra não inflar aquele runner (que já cobre lib/* + authGate).
//
// PADRÃO: cada bloco é uma cópia inline dos protocolos reais das functions
// (slotLock, customerAuth, stripeWebhook handlers). Não é mock de business
// logic — é o MESMO algoritmo, exercitado contra mockBase44.
//
// Espelhos legíveis (sem deploy):
//   tests/concurrency/slotLock.test.js
//   tests/tenant/isolation.test.js
//   tests/stripe/webhookIdempotency.test.js
//   tests/lgpd/consent.test.js
//   tests/security/inputSanitization.test.js
//   tests/observability/auditLog.test.js
//
// Run: Dashboard → Functions → runHardeningTests → Test (admin-only).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ═══════════════════════════════════════════════════════════════════════
// MOCK BASE44 (inline — Base44 não suporta local imports em functions/)
// ═══════════════════════════════════════════════════════════════════════
let _idCounter = 0;
function _newId() { _idCounter += 1; return `mock_${Date.now()}_${_idCounter}`; }
function _matches(record, filter) {
  if (!filter) return true;
  for (const [key, expected] of Object.entries(filter)) {
    const actual = record[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$gte' in expected && !(actual >= expected.$gte)) return false;
      if ('$lte' in expected && !(actual <= expected.$lte)) return false;
      if ('$in'  in expected && !expected.$in.includes(actual)) return false;
      continue;
    }
    if (Array.isArray(expected)) { if (!expected.includes(actual)) return false; continue; }
    if (actual !== expected) return false;
  }
  return true;
}
function _sortFn(records, sortKey) {
  if (!sortKey) return records;
  const desc = sortKey.startsWith('-');
  const key = desc ? sortKey.slice(1) : sortKey;
  return [...records].sort((a, b) => {
    if (a[key] === b[key]) return 0;
    if (a[key] == null) return 1;
    if (b[key] == null) return -1;
    return (a[key] < b[key] ? -1 : 1) * (desc ? -1 : 1);
  });
}
function createMockBase44() {
  const store = {};
  const makeApi = (name) => {
    if (!store[name]) store[name] = new Map();
    const t = store[name];
    return {
      async create(data) {
        const id = data.id || _newId();
        const r = { id, created_date: new Date().toISOString(), ...data };
        t.set(id, r); return { ...r };
      },
      async get(id) { const r = t.get(id); if (!r) throw new Error(`${name} not found`); return { ...r }; },
      async filter(f, s, l) {
        let r = [...t.values()].filter(x => _matches(x, f));
        r = _sortFn(r, s);
        return (l ? r.slice(0, l) : r).map(x => ({ ...x }));
      },
      async update(id, p) { const r = t.get(id); if (!r) throw new Error('nf'); const u = { ...r, ...p }; t.set(id, u); return { ...u }; },
      async delete(id) { if (!t.delete(id)) throw new Error('nf'); return { success: true }; },
    };
  };
  const entities = new Proxy({}, { get: (_, n) => typeof n === 'string' ? makeApi(n) : undefined });
  return { entities, asServiceRole: { entities }, __store: store };
}

// ═══════════════════════════════════════════════════════════════════════
// MÓDULO 1 — concurrency/slotLock
// Espelho de tests/concurrency/slotLock.test.js + lib/slotLock.js
// ═══════════════════════════════════════════════════════════════════════

const SLOT_TTL_MS = 90 * 1000;
function _truncMin(iso) { const d = new Date(iso); d.setSeconds(0, 0); return d.toISOString(); }
function _slotKey(co, pro, at) { return `${co}:${pro}:${_truncMin(at)}`; }

async function acquireLock(sdk, { company_id, professional_id, scheduled_at, owner_phone, reservation_owner_id, source }) {
  const slot_key = _slotKey(company_id, professional_id, scheduled_at);
  const expires_at = new Date(Date.now() + SLOT_TTL_MS).toISOString();
  const existing = await sdk.entities.SlotReservation.filter({ slot_key }, '-created_date', 20);
  const nowISO = new Date().toISOString();
  const alive = existing.filter(r => r.status === 'active' && r.expires_at > nowISO);
  if (alive.length) {
    const mine = alive.find(r => {
      if (reservation_owner_id) return r.reservation_owner_id === reservation_owner_id;
      return owner_phone && r.owner_phone === owner_phone && !r.reservation_owner_id;
    });
    if (mine) {
      await sdk.entities.SlotReservation.update(mine.id, { expires_at });
      return { success: true, reservation: { ...mine, expires_at }, reused: true };
    }
    return { success: false, error: 'SLOT_TAKEN' };
  }
  const reservation = await sdk.entities.SlotReservation.create({
    company_id, professional_id, scheduled_at: _truncMin(scheduled_at),
    slot_key, owner_phone, reservation_owner_id, source: source || 'test',
    expires_at, status: 'active',
  });
  return { success: true, reservation };
}
async function consumeLock(sdk, id, appointment_id) {
  if (!id) return;
  await sdk.entities.SlotReservation.update(id, { status: 'consumed', appointment_id, consumed_at: new Date().toISOString() });
}
async function releaseLock(sdk, id) {
  if (!id) return;
  await sdk.entities.SlotReservation.update(id, { status: 'released' });
}

const slotLockTests = {
  'acquire: primeiro caller obtém o lock': async () => {
    const m = createMockBase44();
    const r = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_A' });
    if (!r.success || !r.reservation?.id) throw new Error('primeiro acquire falhou');
  },
  'acquire: segundo caller diferente é bloqueado (SLOT_TAKEN)': async () => {
    const m = createMockBase44();
    await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_A' });
    const r2 = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_B' });
    if (r2.success || r2.error !== 'SLOT_TAKEN') throw new Error('deveria ter sido SLOT_TAKEN');
  },
  'acquire: mesmo owner_id reusa lock existente (renew)': async () => {
    const m = createMockBase44();
    const r1 = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_A' });
    const r2 = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_A' });
    if (!r2.success || !r2.reused) throw new Error('mesmo owner deveria ter reusado');
    if (r2.reservation.id !== r1.reservation.id) throw new Error('reservation id mudou — não foi reuse');
  },
  'acquire (Fase 9): owner_id tem prioridade sobre phone — atacante com phone não rouba lock': async () => {
    const m = createMockBase44();
    await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_A', owner_phone: '11999999999' });
    const r = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', owner_phone: '11999999999' });
    if (r.success) throw new Error('atacante NÃO devia ter reusado lock de outro owner_id');
  },
  'acquire (legado): callers sem owner_id reusam por phone (compat)': async () => {
    const m = createMockBase44();
    await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', owner_phone: '11999999999' });
    const r = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', owner_phone: '11999999999' });
    if (!r.success || !r.reused) throw new Error('callers sem owner_id devem reusar via phone');
  },
  'acquire: slot_key truncado para minuto (12:00:30 == 12:00:45)': async () => {
    const m = createMockBase44();
    await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:30Z', reservation_owner_id: 'cu_A' });
    const r = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:45Z', reservation_owner_id: 'cu_B' });
    if (r.success) throw new Error('mesmo minuto deveria ter bloqueado segundo');
  },
  'consume: lock vira "consumed" e libera slot_key para nova reserva': async () => {
    const m = createMockBase44();
    const r1 = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_A' });
    await consumeLock(m.asServiceRole, r1.reservation.id, 'appt_xyz');
    const r2 = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_B' });
    if (!r2.success) throw new Error('após consume, status!=active não deveria bloquear novo lock');
  },
  'release: lock liberado permite novo acquire': async () => {
    const m = createMockBase44();
    const r1 = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_A' });
    await releaseLock(m.asServiceRole, r1.reservation.id);
    const r2 = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_B' });
    if (!r2.success) throw new Error('após release, novo lock deveria ter passado');
  },
  'cross-tenant: mesmo prof + mesma hora em companies diferentes NÃO colide': async () => {
    const m = createMockBase44();
    const r1 = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_X', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_A' });
    const r2 = await acquireLock(m.asServiceRole, { company_id: 'co_2', professional_id: 'p_X', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_B' });
    if (!r1.success || !r2.success) throw new Error('companies diferentes deveriam ter slots independentes');
  },
};

// ═══════════════════════════════════════════════════════════════════════
// MÓDULO 2 — tenant/isolation
// ═══════════════════════════════════════════════════════════════════════

const tenantIsolationTests = {
  'filter por company_id retorna apenas registros do tenant': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.Customer.create({ company_id: 'co_1', name: 'A1', phone: '111' });
    await m.asServiceRole.entities.Customer.create({ company_id: 'co_2', name: 'A2', phone: '222' });
    const co1 = await m.asServiceRole.entities.Customer.filter({ company_id: 'co_1' });
    if (co1.length !== 1 || co1[0].name !== 'A1') throw new Error('vazou cross-tenant');
  },
  'mesmo email em companies diferentes não colide': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.Customer.create({ company_id: 'co_1', name: 'X', email: 'a@x.com', phone: '111' });
    await m.asServiceRole.entities.Customer.create({ company_id: 'co_2', name: 'X', email: 'a@x.com', phone: '222' });
    const co1 = await m.asServiceRole.entities.Customer.filter({ company_id: 'co_1', email: 'a@x.com' });
    const co2 = await m.asServiceRole.entities.Customer.filter({ company_id: 'co_2', email: 'a@x.com' });
    if (co1.length !== 1 || co2.length !== 1) throw new Error('email duplicado entre tenants quebrou isolamento');
    if (co1[0].phone === co2[0].phone) throw new Error('retornou mesmo registro');
  },
  'professional_id de outro tenant não vaza em filter explícito': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.Professional.create({ company_id: 'co_1', name: 'Pro1' });
    const proCo2 = await m.asServiceRole.entities.Professional.create({ company_id: 'co_2', name: 'Pro2' });
    const cross = await m.asServiceRole.entities.Professional.filter({ company_id: 'co_1', id: proCo2.id });
    if (cross.length !== 0) throw new Error('filter cross-tenant retornou registro de outro tenant');
  },
  'appointments de co_2 não aparecem em listagem de co_1': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.Appointment.create({ company_id: 'co_1', professional_id: 'p1', service_id: 's1', scheduled_at: '2026-06-01T10:00:00Z' });
    await m.asServiceRole.entities.Appointment.create({ company_id: 'co_2', professional_id: 'p1', service_id: 's1', scheduled_at: '2026-06-01T11:00:00Z' });
    const co1Appts = await m.asServiceRole.entities.Appointment.filter({ company_id: 'co_1' });
    if (co1Appts.length !== 1) throw new Error(`esperado 1 appointment em co_1, veio ${co1Appts.length}`);
  },
  'AuditLog scoped por company_id': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.AuditLog.create({ company_id: 'co_1', action: 'X' });
    await m.asServiceRole.entities.AuditLog.create({ company_id: 'co_2', action: 'X' });
    const co1Logs = await m.asServiceRole.entities.AuditLog.filter({ company_id: 'co_1' });
    if (co1Logs.length !== 1) throw new Error('audit log vazou');
  },
  'FinancialEntry com mesmo valor em tenants diferentes não colide': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.FinancialEntry.create({ company_id: 'co_1', type: 'entrada', amount: 100, date: '2026-06-01' });
    await m.asServiceRole.entities.FinancialEntry.create({ company_id: 'co_2', type: 'entrada', amount: 100, date: '2026-06-01' });
    const co1 = await m.asServiceRole.entities.FinancialEntry.filter({ company_id: 'co_1' });
    if (co1.length !== 1) throw new Error('financeiro vazou');
  },
  'IdempotencyKey scoped por route (mesmo key + routes diferentes não colidem)': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.IdempotencyKey.create({ key: 'k1', route: 'r1', company_id: 'co_1', expires_at: '2027-01-01T00:00:00Z' });
    await m.asServiceRole.entities.IdempotencyKey.create({ key: 'k1', route: 'r2', company_id: 'co_2', expires_at: '2027-01-01T00:00:00Z' });
    const co1 = await m.asServiceRole.entities.IdempotencyKey.filter({ key: 'k1', route: 'r1' });
    if (co1.length !== 1 || co1[0].company_id !== 'co_1') throw new Error('idempotency cross-tenant');
  },
  'CustomerConsent isolado por (customer_id + company_id)': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.CustomerConsent.create({ customer_id: 'cu_1', company_id: 'co_1', consent_type: 'whatsapp_marketing', granted: true });
    await m.asServiceRole.entities.CustomerConsent.create({ customer_id: 'cu_1', company_id: 'co_2', consent_type: 'whatsapp_marketing', granted: false });
    const co1 = await m.asServiceRole.entities.CustomerConsent.filter({ customer_id: 'cu_1', company_id: 'co_1' });
    if (co1.length !== 1 || co1[0].granted !== true) throw new Error('consent cross-tenant');
  },
  'SlotReservation slot_key inclui company_id (mesmo prof+hora em tenants diferentes)': async () => {
    const m = createMockBase44();
    const r1 = await m.asServiceRole.entities.SlotReservation.create({ company_id: 'co_1', professional_id: 'p_X', scheduled_at: '2026-06-01T10:00:00Z', slot_key: 'co_1:p_X:2026-06-01T10:00:00.000Z', status: 'active', expires_at: '2027-01-01T00:00:00Z' });
    const r2 = await m.asServiceRole.entities.SlotReservation.create({ company_id: 'co_2', professional_id: 'p_X', scheduled_at: '2026-06-01T10:00:00Z', slot_key: 'co_2:p_X:2026-06-01T10:00:00.000Z', status: 'active', expires_at: '2027-01-01T00:00:00Z' });
    if (r1.id === r2.id) throw new Error('reservations colidiram');
    const lookups = await m.asServiceRole.entities.SlotReservation.filter({ slot_key: 'co_1:p_X:2026-06-01T10:00:00.000Z' });
    if (lookups.length !== 1) throw new Error('slot_key cross-tenant collision');
  },
};

// ═══════════════════════════════════════════════════════════════════════
// MÓDULO 3 — stripe/webhookIdempotency
// ═══════════════════════════════════════════════════════════════════════

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
async function handlePaymentSucceeded(sdk, { eventId, appointmentId }) {
  if (await alreadyProcessed(sdk, eventId)) return { deduped: true };
  const appts = await sdk.entities.Appointment.filter({ id: appointmentId });
  const appt = appts?.[0];
  if (!appt) return { error: 'not_found' };
  if (appt.status === 'aguardando_pagamento' || appt.payment_status !== 'succeeded') {
    await sdk.entities.Appointment.update(appt.id, {
      status: 'agendado', payment_status: 'succeeded', paid_online: true, payer_tax_id: null,
    });
  }
  await markProcessed(sdk, eventId, 'payment_intent.succeeded');
  return { processed: true };
}

const stripeWebhookTests = {
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
    await handlePaymentSucceeded(m.asServiceRole, { eventId: 'evt_A', appointmentId: a.id });
    const after1 = await m.asServiceRole.entities.Appointment.get(a.id);
    if (after1.status !== 'agendado' || after1.payment_status !== 'succeeded') throw new Error('primeiro evento não promoveu');
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

// ═══════════════════════════════════════════════════════════════════════
// MÓDULO 4 — lgpd/consent
// ═══════════════════════════════════════════════════════════════════════

async function grantConsent(sdk, { customer_id, company_id, consent_type, source, ip_address, legal_text_version, legal_text_snippet }) {
  await sdk.entities.CustomerConsent.create({
    customer_id, company_id, consent_type, granted: true,
    granted_at: new Date().toISOString(), source, ip_address, legal_text_version, legal_text_snippet,
  });
  await sdk.entities.PrivacyAuditLog.create({
    company_id, customer_id, action: 'CONSENT_GRANTED', actor_type: 'customer_self',
    details: { consent_type }, ip_address,
  });
}
async function revokeConsent(sdk, { customer_id, company_id, consent_type, actor_email }) {
  const existing = await sdk.entities.CustomerConsent.filter({ customer_id, company_id, consent_type, granted: true });
  if (existing[0]) {
    await sdk.entities.CustomerConsent.update(existing[0].id, { granted: false, revoked_at: new Date().toISOString() });
  }
  await sdk.entities.PrivacyAuditLog.create({
    company_id, customer_id, action: 'CONSENT_REVOKED', actor_type: actor_email ? 'staff' : 'customer_self',
    actor_email, details: { consent_type },
  });
}
async function checkConsent(sdk, { customer_id, company_id, consent_type }) {
  const list = await sdk.entities.CustomerConsent.filter({ customer_id, company_id, consent_type });
  const sorted = [...list].sort((a, b) => (b.granted_at || '').localeCompare(a.granted_at || ''));
  return sorted[0]?.granted === true;
}

const lgpdConsentTests = {
  'grant: cria CustomerConsent e PrivacyAuditLog': async () => {
    const m = createMockBase44();
    await grantConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'whatsapp_marketing', source: 'booking_flow', ip_address: '1.1.1.1', legal_text_version: 'v1.0', legal_text_snippet: 'Aceito...' });
    const consents = await m.asServiceRole.entities.CustomerConsent.filter({ customer_id: 'cu_1' });
    if (consents.length !== 1 || !consents[0].granted) throw new Error('consent não foi criado');
    const logs = await m.asServiceRole.entities.PrivacyAuditLog.filter({ customer_id: 'cu_1', action: 'CONSENT_GRANTED' });
    if (logs.length !== 1) throw new Error('audit log não foi criado');
  },
  'revoke: marca granted=false + revoked_at': async () => {
    const m = createMockBase44();
    await grantConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'email_marketing', source: 'booking_flow' });
    await revokeConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'email_marketing' });
    const allowed = await checkConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'email_marketing' });
    if (allowed) throw new Error('consent não foi revogado');
  },
  'revoke: PrivacyAuditLog registra mesmo quando não há consent ativo (auditoria completa)': async () => {
    const m = createMockBase44();
    await revokeConsent(m.asServiceRole, { customer_id: 'cu_99', company_id: 'co_1', consent_type: 'email_marketing' });
    const logs = await m.asServiceRole.entities.PrivacyAuditLog.filter({ customer_id: 'cu_99', action: 'CONSENT_REVOKED' });
    if (logs.length !== 1) throw new Error('revoke deveria sempre ser auditado, mesmo no-op');
  },
  'isolamento: consent em co_1 não afeta co_2': async () => {
    const m = createMockBase44();
    await grantConsent(m.asServiceRole, { customer_id: 'cu_X', company_id: 'co_1', consent_type: 'whatsapp_marketing', source: 'booking_flow' });
    const co1 = await checkConsent(m.asServiceRole, { customer_id: 'cu_X', company_id: 'co_1', consent_type: 'whatsapp_marketing' });
    const co2 = await checkConsent(m.asServiceRole, { customer_id: 'cu_X', company_id: 'co_2', consent_type: 'whatsapp_marketing' });
    if (!co1) throw new Error('co_1 deveria ter consent');
    if (co2) throw new Error('co_2 NÃO deveria ter consent');
  },
  'versionamento: legal_text_version + snippet preservados (prova jurídica)': async () => {
    const m = createMockBase44();
    await grantConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'data_processing_general', source: 'booking_flow', legal_text_version: 'v2.5-2026', legal_text_snippet: 'Eu autorizo o tratamento...' });
    const c = (await m.asServiceRole.entities.CustomerConsent.filter({ customer_id: 'cu_1' }))[0];
    if (c.legal_text_version !== 'v2.5-2026') throw new Error('versão não preservada');
    if (!c.legal_text_snippet?.includes('autorizo')) throw new Error('snippet legal não preservado');
  },
  'IP e UA registrados em CustomerConsent (rastreabilidade)': async () => {
    const m = createMockBase44();
    await grantConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'whatsapp_marketing', source: 'booking_flow', ip_address: '203.0.113.42' });
    const c = (await m.asServiceRole.entities.CustomerConsent.filter({ customer_id: 'cu_1' }))[0];
    if (c.ip_address !== '203.0.113.42') throw new Error('IP não foi registrado');
  },
  'múltiplos consent_types por customer são independentes': async () => {
    const m = createMockBase44();
    await grantConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'whatsapp_marketing', source: 'booking_flow' });
    await grantConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'email_marketing', source: 'booking_flow' });
    await revokeConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'whatsapp_marketing' });
    const wpp = await checkConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'whatsapp_marketing' });
    const email = await checkConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'email_marketing' });
    if (wpp) throw new Error('whatsapp deveria ter sido revogado');
    if (!email) throw new Error('email não deveria ter sido afetado');
  },
};

// ═══════════════════════════════════════════════════════════════════════
// MÓDULO 5 — security/inputSanitization
// ═══════════════════════════════════════════════════════════════════════

function sanitizeText(v, max = 1000) {
  if (v == null) return '';
  let s = String(v).trim();
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.replace(/\s{3,}/g, '  ');
  return s.slice(0, max);
}
function sanitizeCsvCell(v) {
  if (v == null) return '';
  const s = String(v);
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}
function isSafeRedirect(url, allowedOrigins) {
  if (!url) return false;
  try {
    const u = new URL(url, 'https://app.ocorte.com.br');
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return allowedOrigins.some(o => u.origin === o);
  } catch {
    return false;
  }
}

const inputSanitizationTests = {
  'XSS: <script> tag é removida do nome': () => {
    const out = sanitizeText('João <script>alert(1)</script> Silva');
    if (out.includes('<') || out.includes('script')) throw new Error(`tag não removida: "${out}"`);
  },
  'XSS: <img onerror> também removido': () => {
    const out = sanitizeText('<img src=x onerror=alert(1)>');
    if (out.includes('<') || out.includes('onerror')) throw new Error(`payload sobreviveu: "${out}"`);
  },
  'XSS: encoded entities preservados (innocent text)': () => {
    const out = sanitizeText('&lt;script&gt; é só texto');
    if (out !== '&lt;script&gt; é só texto') throw new Error('texto inocente foi alterado');
  },
  'controle char (NULL byte) removido': () => {
    const out = sanitizeText('João\u0000Silva');
    if (out.includes('\u0000')) throw new Error('NULL byte sobreviveu');
  },
  'payload gigante é truncado': () => {
    const huge = 'A'.repeat(50000);
    const out = sanitizeText(huge, 500);
    if (out.length > 500) throw new Error(`não truncou: ${out.length}`);
  },
  'whitespace excessivo é normalizado': () => {
    const out = sanitizeText('João         Silva');
    if (/\s{3,}/.test(out)) throw new Error('whitespace não foi colapsado');
  },
  'CSV injection: =SUM() é prefixado com aspa': () => {
    const out = sanitizeCsvCell('=SUM(A1:A10)');
    if (!out.startsWith("'")) throw new Error('fórmula CSV não foi neutralizada');
  },
  'CSV injection: +1+1 também': () => {
    const out = sanitizeCsvCell('+1+1');
    if (!out.startsWith("'")) throw new Error('+ não foi neutralizado');
  },
  'CSV injection: @SUM também': () => {
    const out = sanitizeCsvCell('@SUM(1,1)');
    if (!out.startsWith("'")) throw new Error('@ não foi neutralizado');
  },
  'CSV injection: texto normal não é afetado': () => {
    const out = sanitizeCsvCell('João Silva');
    if (out !== 'João Silva') throw new Error('texto inocente foi modificado');
  },
  'open redirect: URL externa rejeitada': () => {
    const ok = isSafeRedirect('https://evil.com/steal', ['https://app.ocorte.com.br']);
    if (ok) throw new Error('evil.com foi aceito como redirect');
  },
  'open redirect: URL allowlisted aceita': () => {
    const ok = isSafeRedirect('https://app.ocorte.com.br/dashboard', ['https://app.ocorte.com.br']);
    if (!ok) throw new Error('origem legítima foi rejeitada');
  },
  'open redirect: protocolo javascript: rejeitado': () => {
    const ok = isSafeRedirect('javascript:alert(1)', ['https://app.ocorte.com.br']);
    if (ok) throw new Error('javascript: URL aceita = XSS');
  },
  'open redirect: URL malformada rejeitada': () => {
    const ok = isSafeRedirect('not-a-url://', ['https://app.ocorte.com.br']);
    if (ok) throw new Error('URL inválida aceita');
  },
};

// ═══════════════════════════════════════════════════════════════════════
// MÓDULO 6 — observability/auditLog
// ═══════════════════════════════════════════════════════════════════════

async function recordAudit(sdk, { action, actor_email, target_type, target_id, before, after, company_id, severity = 'info', request_id }) {
  return sdk.entities.AuditLog.create({
    action, actor_email, target_type, target_id, before, after, company_id, severity, request_id,
  });
}
async function recordSecurityEvent(sdk, { event_type, severity, ip_address, route, details, blocked = true }) {
  return sdk.entities.SecurityEvent.create({ event_type, severity, ip_address, route, details, blocked });
}

const observabilityTests = {
  'AuditLog: action preservada': async () => {
    const m = createMockBase44();
    const log = await recordAudit(m.asServiceRole, { action: 'APPOINTMENT_DELETED', actor_email: 'admin@x.com', target_id: 'a1' });
    if (log.action !== 'APPOINTMENT_DELETED') throw new Error('action não preservada');
  },
  'AuditLog: before/after diff preservado': async () => {
    const m = createMockBase44();
    const log = await recordAudit(m.asServiceRole, {
      action: 'APPOINTMENT_MODIFIED', actor_email: 'rec@x.com', target_id: 'a1',
      before: { status: 'agendado' }, after: { status: 'confirmado' },
    });
    if (log.before?.status !== 'agendado' || log.after?.status !== 'confirmado') throw new Error('diff não preservado');
  },
  'AuditLog: request_id permite correlação': async () => {
    const m = createMockBase44();
    const rid = 'req_abc123';
    await recordAudit(m.asServiceRole, { action: 'CUSTOMER_DELETED', actor_email: 'a@x.com', target_id: 'c1', request_id: rid });
    await recordAudit(m.asServiceRole, { action: 'APPOINTMENT_DELETED', actor_email: 'a@x.com', target_id: 'a1', request_id: rid });
    const correlated = await m.asServiceRole.entities.AuditLog.filter({ request_id: rid });
    if (correlated.length !== 2) throw new Error(`correlation falhou: ${correlated.length}`);
  },
  'AuditLog: severity classifica criticidade': async () => {
    const m = createMockBase44();
    await recordAudit(m.asServiceRole, { action: 'CUSTOMER_ANONYMIZED', actor_email: 'a@x.com', target_id: 'c1', severity: 'critical' });
    const critical = await m.asServiceRole.entities.AuditLog.filter({ severity: 'critical' });
    if (critical.length !== 1) throw new Error('severity não indexada');
  },
  'AuditLog: scope por company_id permite filtros tenant-aware': async () => {
    const m = createMockBase44();
    await recordAudit(m.asServiceRole, { action: 'APPOINTMENT_DELETED', actor_email: 'a@x.com', target_id: 'a1', company_id: 'co_1' });
    await recordAudit(m.asServiceRole, { action: 'APPOINTMENT_DELETED', actor_email: 'a@x.com', target_id: 'a2', company_id: 'co_2' });
    const co1 = await m.asServiceRole.entities.AuditLog.filter({ company_id: 'co_1' });
    if (co1.length !== 1) throw new Error('audit log vazou cross-tenant');
  },
  'SecurityEvent: brute_force_attempt gera evento com severity critical': async () => {
    const m = createMockBase44();
    await recordSecurityEvent(m.asServiceRole, {
      event_type: 'brute_force_attempt', severity: 'critical',
      ip_address: '1.2.3.4', route: 'customerAuth:login',
      details: { reason: 'HARD_BLOCKED', attempts: 15 },
    });
    const ev = await m.asServiceRole.entities.SecurityEvent.filter({ event_type: 'brute_force_attempt' });
    if (ev.length !== 1 || ev[0].severity !== 'critical') throw new Error('brute force event não foi gravado corretamente');
  },
  'SecurityEvent: rate_limit_exceeded com IP rastreável': async () => {
    const m = createMockBase44();
    await recordSecurityEvent(m.asServiceRole, {
      event_type: 'rate_limit_exceeded', severity: 'high',
      ip_address: '203.0.113.42', route: 'createPublicAppointment',
      details: { reason: 'SOFT_BLOCKED', attempts: 5 },
    });
    const ev = (await m.asServiceRole.entities.SecurityEvent.filter({ ip_address: '203.0.113.42' }))[0];
    if (!ev || ev.details?.reason !== 'SOFT_BLOCKED') throw new Error('IP/details não preservados');
  },
  'PrivacyAuditLog: ações LGPD distintas (export, anonymize, consent)': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.PrivacyAuditLog.create({ company_id: 'co_1', customer_id: 'cu_1', action: 'DATA_EXPORT_REQUESTED', actor_type: 'admin', actor_email: 'a@x.com' });
    await m.asServiceRole.entities.PrivacyAuditLog.create({ company_id: 'co_1', customer_id: 'cu_1', action: 'DATA_ANONYMIZED', actor_type: 'admin', actor_email: 'a@x.com' });
    await m.asServiceRole.entities.PrivacyAuditLog.create({ company_id: 'co_1', customer_id: 'cu_1', action: 'CONSENT_REVOKED', actor_type: 'customer_self' });
    const all = await m.asServiceRole.entities.PrivacyAuditLog.filter({ customer_id: 'cu_1' });
    if (all.length !== 3) throw new Error(`esperado 3, veio ${all.length}`);
    const actions = new Set(all.map(l => l.action));
    if (!actions.has('DATA_EXPORT_REQUESTED') || !actions.has('DATA_ANONYMIZED') || !actions.has('CONSENT_REVOKED')) {
      throw new Error('ações LGPD distintas não foram preservadas');
    }
  },
  'AdminAuditLog: actor_is_impersonating capturado': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.AdminAuditLog.create({
      actor: 'super@x.com', actor_role: 'super_admin', actor_is_impersonating: true,
      company_id: 'co_1', action: 'CUSTOMER_DELETED', target_id: 'cu_1', severity: 'critical',
    });
    const log = (await m.asServiceRole.entities.AdminAuditLog.filter({ actor: 'super@x.com' }))[0];
    if (!log.actor_is_impersonating) throw new Error('impersonação não foi marcada no log');
    if (log.severity !== 'critical') throw new Error('severity de ação crítica não preservada');
  },
};

// ═══════════════════════════════════════════════════════════════════════
// REGISTRY + RUNNER
// ═══════════════════════════════════════════════════════════════════════

const TEST_MODULES = {
  'concurrency/slotLock': slotLockTests,
  'tenant/isolation': tenantIsolationTests,
  'stripe/webhookIdempotency': stripeWebhookTests,
  'lgpd/consent': lgpdConsentTests,
  'security/inputSanitization': inputSanitizationTests,
  'observability/auditLog': observabilityTests,
};

async function runModule(name, cases) {
  const results = [];
  for (const [testName, fn] of Object.entries(cases)) {
    const t0 = Date.now();
    try {
      await fn();
      results.push({ module: name, name: testName, status: 'pass', ms: Date.now() - t0 });
    } catch (err) {
      results.push({
        module: name, name: testName, status: 'fail',
        ms: Date.now() - t0, error: err?.message || String(err),
      });
    }
  }
  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });

    const allResults = [];
    for (const [name, cases] of Object.entries(TEST_MODULES)) {
      const res = await runModule(name, cases);
      allResults.push(...res);
    }

    const passed = allResults.filter(r => r.status === 'pass').length;
    const failed = allResults.filter(r => r.status === 'fail').length;
    const total = allResults.length;
    const duration = allResults.reduce((s, r) => s + r.ms, 0);

    console.log(`[runHardeningTests] ${passed}/${total} passed in ${duration}ms`);
    if (failed > 0) {
      const fails = allResults.filter(r => r.status === 'fail');
      console.error('[runHardeningTests] FAILURES:', fails.map(r => `${r.module} :: ${r.name} — ${r.error}`).join(' | '));
    }

    return Response.json({
      summary: { passed, failed, total, duration_ms: duration, success: failed === 0 },
      results: allResults,
    });
  } catch (error) {
    console.error('[runHardeningTests] error:', error?.message, error?.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});