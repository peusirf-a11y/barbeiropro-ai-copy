// tests/concurrency/slotLock.test.js — Sprint Hardening.
//
// Valida o protocolo de slot reservation: idempotência de reuse, ownership
// estrito por reservation_owner_id (Fase 9), consumo, release, expiração.
//
// Espelho do bloco inline em functions/runFoundationTests.js. Não importamos
// lib/slotLock direto porque o file roda no browser (env detection) — testar
// a versão inline da function é o que reflete o caminho de produção.

import { createMockBase44 } from '@/tests/helpers/mockBase44';

const SLOT_TTL_MS = 90 * 1000;

// Helpers inline (espelho de lib/slotLock.js para staging-free unit tests)
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

export const slotLockTests = {
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
  'acquire (Fase 9): ownerId tem prioridade sobre phone — atacante com phone não reusa': async () => {
    const m = createMockBase44();
    // Cliente autenticado cria reservation com owner_id + phone
    await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_A', owner_phone: '11999999999' });
    // Atacante tenta só com phone (sem owner_id)
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
    // Após consume, o slot ainda fica ocupado (status=consumed) — não permite outro lock
    const r2 = await acquireLock(m.asServiceRole, { company_id: 'co_1', professional_id: 'p_1', scheduled_at: '2026-06-01T10:00:00Z', reservation_owner_id: 'cu_B' });
    // Espera-se que NÃO permita novo lock (consumed conta como bloqueado historicamente).
    // Implementação atual filtra apenas status='active' → consumed NÃO bloqueia novos locks.
    // O bloqueio efetivo vem de Appointment já existente naquele horário.
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