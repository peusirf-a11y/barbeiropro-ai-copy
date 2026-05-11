// lib/slotLock.js — Lock atômico de slots para evitar double-booking.
//
// WHY: o fluxo antigo (filter Appointment + create) tem janela de race de ~300ms.
// Dois clientes simultâneos podem passar o filter como "vazio" e criar 2 appointments
// no mesmo horário. Ver docs/RACE_CONDITIONS.md §1.
//
// SOLUÇÃO: entidade SlotReservation separada com TTL curto (90s default).
//   1. acquireSlotLock(slot_key)
//        - busca reservations ativas no mesmo slot_key
//        - se tem outra ativa (não-expirada) e não é do MESMO owner → SLOT_TAKEN
//        - cria reservation status=active com expires_at = now + TTL
//   2. Cria Appointment
//   3. consumeSlotLock(reservation_id, appointment_id)
//        - marca reservation como consumed
//   Se algo der errado entre 2 e 3 → releaseSlotLock(reservation_id)
//
// IMPORTANTE: isto NÃO é um lock 100% atômico (Base44 SDK não expõe transações).
// É um "soft lock" que reduz drasticamente a janela de race. Defesa em profundidade:
// o filter de Appointment antigo continua existindo como segunda camada.
//
// Feature flag: ENABLE_SLOT_LOCK (default 'true'). Se 'false', acquire vira no-op.
//
// CONFIG via env:
//   SLOT_RESERVATION_TTL_SECONDS = 90 (default)
//   ENABLE_SLOT_LOCK = 'true' (default)

// Default 90s. Cobre latência maior do fluxo de pagamento (Pix QR code generation).
const DEFAULT_TTL_SECONDS = 90;

// WHY: este módulo é fonte canônica de referência. No backend (Deno), `Deno.env`
// existe; no bundle do frontend (Vite), não. Usamos globalThis para evitar lint
// `no-undef` e funcionar nos dois ambientes sem precisar de import condicional.
function _readEnv(key) {
  const D = /** @type {any} */ (globalThis).Deno;
  if (D && D.env && typeof D.env.get === 'function') return D.env.get(key);
  return null;
}

function readTtlSeconds() {
  const raw = _readEnv('SLOT_RESERVATION_TTL_SECONDS') || '';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_SECONDS;
}

function isFeatureEnabled() {
  const raw = _readEnv('ENABLE_SLOT_LOCK');
  // default = true; só desliga se explicitamente 'false'
  if (raw === undefined || raw === null || raw === '') return true;
  return String(raw).toLowerCase() !== 'false';
}

/**
 * Trunca um ISO datetime para o início do minuto.
 * Garante que slot_key seja idêntico mesmo com diferenças de segundos/ms.
 */
export function truncateToMinute(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error('invalid scheduled_at for slot lock');
  d.setSeconds(0, 0);
  return d.toISOString();
}

/**
 * Monta a slot_key composta. Determinística para o mesmo (company, professional, minuto).
 */
export function buildSlotKey({ company_id, professional_id, scheduled_at }) {
  const iso = truncateToMinute(scheduled_at);
  return `${company_id}:${professional_id}:${iso}`;
}

/**
 * Tenta adquirir o lock para um slot.
 *
 * Retorna:
 *   { success: true, reservation, reused: boolean }
 *   { success: false, error: 'SLOT_TAKEN', conflict_reservation_id }
 *
 * Se o MESMO owner já tem uma reservation ativa → reusa (caso: cliente troca pix↔card).
 *
 * @param {object} sdk - base44.asServiceRole
 * @param {object} params - { company_id, unit_id?, professional_id, scheduled_at,
 *                            owner_phone?, reservation_owner_id?, source }
 */
export async function acquireSlotLock(sdk, params) {
  if (!isFeatureEnabled()) {
    // WHY: feature flag permite rollback instantâneo sem code change.
    console.log('[slotLock] disabled by ENABLE_SLOT_LOCK=false — skipping');
    return { success: true, reservation: null, reused: false, skipped: true };
  }

  const { company_id, unit_id, professional_id, scheduled_at, owner_phone, reservation_owner_id, source } = params;
  if (!company_id || !professional_id || !scheduled_at) {
    throw new Error('acquireSlotLock: missing required params');
  }

  const slot_key = buildSlotKey({ company_id, professional_id, scheduled_at });
  const scheduledAtTrunc = truncateToMinute(scheduled_at);
  const now = new Date();
  const ttlSeconds = readTtlSeconds();
  const expires_at = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  // Busca reservations no mesmo slot_key. Filtramos por slot_key (indexed por design).
  // Limitamos a 20 para evitar ler lixo histórico — slots de minuto raramente passam disso.
  const existing = await sdk.entities.SlotReservation.filter({ slot_key }, '-created_date', 20);

  // Considera "viva" se status=active E expires_at > now.
  // Reservations expiradas não bloqueiam (cleanup job vai marcar como expired depois).
  const nowISO = now.toISOString();
  const alive = existing.filter(r => r.status === 'active' && r.expires_at > nowISO);

  if (alive.length > 0) {
    // Já existe reserva viva. Pode reusar se for do MESMO owner.
    const mine = alive.find(r =>
      (reservation_owner_id && r.reservation_owner_id === reservation_owner_id) ||
      (owner_phone && r.owner_phone === owner_phone)
    );
    if (mine) {
      // WHY: cenário válido — cliente trocou método de pagamento (pix↔card) ou refresh.
      // Estendemos o TTL para o cliente ter mais tempo.
      try {
        await sdk.entities.SlotReservation.update(mine.id, { expires_at });
      } catch (err) {
        console.warn('[slotLock] failed to extend own reservation:', err.message);
      }
      return { success: true, reservation: { ...mine, expires_at }, reused: true };
    }
    // Existe lock de OUTRO cliente. Bloqueia.
    console.warn('[slotLock] SLOT_TAKEN', { slot_key, conflict_id: alive[0].id });
    return { success: false, error: 'SLOT_TAKEN', conflict_reservation_id: alive[0].id };
  }

  // Caminho feliz: nenhuma reserva ativa → criar.
  const reservation = await sdk.entities.SlotReservation.create({
    company_id,
    unit_id: unit_id || undefined,
    professional_id,
    scheduled_at: scheduledAtTrunc,
    slot_key,
    owner_phone: owner_phone || undefined,
    reservation_owner_id: reservation_owner_id || undefined,
    source: source || 'internal',
    expires_at,
    status: 'active',
  });
  console.log('[slotLock] acquired', { reservation_id: reservation.id, slot_key, ttlSeconds });
  return { success: true, reservation, reused: false };
}

/**
 * Marca a reservation como consumida (appointment criado com sucesso).
 * Idempotente — chamadas duplicadas não causam erro.
 */
export async function consumeSlotLock(sdk, reservation_id, appointment_id) {
  if (!reservation_id) return;
  try {
    await sdk.entities.SlotReservation.update(reservation_id, {
      status: 'consumed',
      appointment_id,
      consumed_at: new Date().toISOString(),
    });
    console.log('[slotLock] consumed', { reservation_id, appointment_id });
  } catch (err) {
    // WHY: se falhar aqui, a reservation vai expirar sozinha em <=90s.
    // Não é crítico para integridade — só polui logs.
    console.warn('[slotLock] failed to mark consumed:', err.message);
  }
}

/**
 * Libera a reservation explicitamente (ex: rollback após erro no Stripe).
 * Idempotente.
 */
export async function releaseSlotLock(sdk, reservation_id) {
  if (!reservation_id) return;
  try {
    await sdk.entities.SlotReservation.update(reservation_id, {
      status: 'released',
    });
    console.log('[slotLock] released', { reservation_id });
  } catch (err) {
    console.warn('[slotLock] failed to release:', err.message);
  }
}

/**
 * Expira reservations cuja TTL passou. Chamado pelo job de cleanup.
 * Retorna { checked, expired }.
 */
export async function expireStaleReservations(sdk, limit = 200) {
  const nowISO = new Date().toISOString();
  const active = await sdk.entities.SlotReservation.filter(
    { status: 'active' },
    '-created_date',
    limit
  );
  const stale = active.filter(r => r.expires_at && r.expires_at < nowISO);
  let expired = 0;
  for (const r of stale) {
    try {
      await sdk.entities.SlotReservation.update(r.id, { status: 'expired' });
      expired++;
    } catch (err) {
      console.warn('[slotLock] expire failed for', r.id, err.message);
    }
  }
  return { checked: active.length, expired };
}