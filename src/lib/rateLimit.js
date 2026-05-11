// lib/rateLimit.js — Rate limiting para endpoints públicos.
//
// WHY: endpoints públicos (booking, reset password, submit review) podem ser
// alvo de flood/spam/scraping. Sem rate limit, um único atacante pode:
//   - criar milhares de Appointments fake e estourar a agenda
//   - inundar SlotReservation e bloquear horários
//   - exaurir créditos de WhatsApp/email
//
// ESTRATÉGIA ATUAL: contagem dinâmica baseada em queries do próprio Base44.
// Sem Redis, sem nova entidade. Janela fixa de 1h (não sliding window real).
// Suficiente para escala atual (centenas de barbearias, dezenas de bookings/min).
//
// FUTURO (não implementar agora):
//   - Sliding window real via entidade RateLimitBucket
//   - IP-based limiting (X-Forwarded-For)
//   - Fingerprinting (User-Agent + IP)
//   - Captcha escalation após N tentativas
//   - Whitelist de telefones (clientes VIP / staff)
//
// ESTE MÓDULO É FONTE CANÔNICA DE REFERÊNCIA. Como Base44 não permite imports
// entre functions/, cada backend function replica essa lógica inline.

// Default 5/hora por telefone — calibrado para uso real:
//   - Cliente normal: 1-2 bookings/dia
//   - Cliente trocando método (pix↔card): conta como 1 (mesmo phone reusa)
//   - Atacante: bloqueado rapidamente
const DEFAULT_BOOKING_PER_HOUR = 5;
const DEFAULT_REVIEW_PER_HOUR = 3;
const DEFAULT_RESET_PER_HOUR = 5;

function _readEnv(key) {
  const D = /** @type {any} */ (globalThis).Deno;
  if (D && D.env && typeof D.env.get === 'function') return D.env.get(key);
  return null;
}

function _parseLimit(key, fallback) {
  const raw = _readEnv(key) || '';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getBookingLimit() {
  return _parseLimit('BOOKING_RATE_LIMIT_PER_HOUR', DEFAULT_BOOKING_PER_HOUR);
}
export function getReviewLimit() {
  return _parseLimit('REVIEW_RATE_LIMIT_PER_HOUR', DEFAULT_REVIEW_PER_HOUR);
}
export function getResetLimit() {
  return _parseLimit('RESET_RATE_LIMIT_PER_HOUR', DEFAULT_RESET_PER_HOUR);
}

/**
 * Verifica rate limit por telefone para o fluxo de booking.
 * Conta Appointments criados nas últimas 1h com o mesmo customer_phone.
 *
 * Retorna { allowed: bool, count, limit, retry_after_seconds }.
 *
 * @param {object} sdk - base44.asServiceRole
 * @param {string} customer_phone - telefone normalizado (só dígitos)
 */
export async function checkBookingRateLimit(sdk, customer_phone) {
  if (!customer_phone) return { allowed: true, count: 0, limit: 0 };
  const limit = getBookingLimit();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  // WHY: filtramos por phone + created_date no banco — não trazemos lixo de outros clientes.
  const recent = await sdk.entities.Appointment.filter(
    { customer_phone, created_date: { $gte: oneHourAgo } },
    '-created_date',
    Math.max(limit + 5, 20)
  );
  // Conta TODOS os criados (inclui cancelados/expirados — antiabuse, atacante teria
  // que esperar 1h mesmo se cancelar a tentativa anterior).
  const count = recent.length;
  return {
    allowed: count < limit,
    count,
    limit,
    retry_after_seconds: 3600,
  };
}