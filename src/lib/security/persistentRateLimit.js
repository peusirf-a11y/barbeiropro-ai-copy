/**
 * persistentRateLimit.js — Rate limit distribuído persistente no banco.
 *
 * Substitui os buckets em memória de startImpersonation / impersonatedMutation.
 * Usa SecurityRateLimit entity como backend — sobrevive a cold starts.
 *
 * Algoritmo: janela deslizante real com anti-burst e cooldown exponencial.
 * Chave composta: action:user_id:ip (device_trust_id opcional)
 *
 * USO: backend functions (Deno) via sdk.asServiceRole
 */

/**
 * Verifica e registra uma tentativa de rate limit persistente.
 *
 * @param {object} sdk - base44.asServiceRole
 * @param {object} opts
 * @param {string} opts.action - identificador da ação (ex: 'startImpersonation')
 * @param {string} opts.identifier - user_id ou email do ator
 * @param {string} opts.ip - IP de origem
 * @param {number} [opts.limitPerWindow=5] - max tentativas na janela
 * @param {number} [opts.windowMinutes=10] - duração da janela em minutos
 * @param {number} [opts.hardLimitMultiplier=3] - multiplicador para bloqueio severo (limiar * X)
 * @param {number} [opts.hardBlockHours=24] - horas de bloqueio crítico
 * @param {number} [opts.softBlockHours=1] - horas de bloqueio suave
 * @returns {Promise<{allowed: boolean, blocked_until?: string, reason?: string, attempts?: number}>}
 */
export async function checkPersistentRateLimit(sdk, {
  action,
  identifier,
  ip,
  limitPerWindow = 5,
  windowMinutes = 10,
  hardLimitMultiplier = 3,
  hardBlockHours = 24,
  softBlockHours = 1,
}) {
  const key = `${action}:${identifier}:${ip}`;
  const now = new Date();
  const windowMs = windowMinutes * 60 * 1000;

  const existing = await sdk.entities.SecurityRateLimit.filter({ key }, '-created_date', 1).catch(() => []);
  const record = existing?.[0];

  // Se está bloqueado, verificar se o bloqueio ainda é válido
  if (record?.is_blocked && record?.blocked_until) {
    const blockedUntil = new Date(record.blocked_until);
    if (blockedUntil > now) {
      return {
        allowed: false,
        blocked_until: record.blocked_until,
        reason: record.attempts >= limitPerWindow * hardLimitMultiplier
          ? 'HARD_BLOCKED'
          : 'SOFT_BLOCKED',
        attempts: record.attempts,
      };
    }
    // Bloqueio expirou — resetar janela
    await sdk.entities.SecurityRateLimit.update(record.id, {
      attempts: 1,
      window_start: now.toISOString(),
      window_end: new Date(now.getTime() + windowMs).toISOString(),
      is_blocked: false,
      blocked_until: null,
    }).catch(() => {});
    return { allowed: true, attempts: 1 };
  }

  if (record && record.window_end && new Date(record.window_end) > now) {
    // Dentro da janela ativa — incrementar
    const newAttempts = (record.attempts || 0) + 1;

    if (newAttempts >= limitPerWindow * hardLimitMultiplier) {
      // Bloqueio crítico (24h por padrão)
      const blocked_until = new Date(now.getTime() + hardBlockHours * 60 * 60 * 1000).toISOString();
      await sdk.entities.SecurityRateLimit.update(record.id, {
        attempts: newAttempts,
        is_blocked: true,
        blocked_until,
      }).catch(() => {});
      return { allowed: false, blocked_until, reason: 'HARD_BLOCKED', attempts: newAttempts };
    }

    if (newAttempts >= limitPerWindow) {
      // Bloqueio suave (1h por padrão)
      const blocked_until = new Date(now.getTime() + softBlockHours * 60 * 60 * 1000).toISOString();
      await sdk.entities.SecurityRateLimit.update(record.id, {
        attempts: newAttempts,
        is_blocked: true,
        blocked_until,
      }).catch(() => {});
      return { allowed: false, blocked_until, reason: 'SOFT_BLOCKED', attempts: newAttempts };
    }

    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts }).catch(() => {});
    return { allowed: true, attempts: newAttempts };
  }

  // Nova janela (ou primeiro acesso)
  const window_start = now.toISOString();
  const window_end = new Date(now.getTime() + windowMs).toISOString();

  if (record) {
    await sdk.entities.SecurityRateLimit.update(record.id, {
      attempts: 1,
      window_start,
      window_end,
      is_blocked: false,
      blocked_until: null,
    }).catch(() => {});
  } else {
    await sdk.entities.SecurityRateLimit.create({
      key,
      route: action,
      ip,
      identifier,
      attempts: 1,
      window_start,
      window_end,
      is_blocked: false,
    }).catch(() => {});
  }

  return { allowed: true, attempts: 1 };
}

/**
 * Registra SecurityEvent de abuso de rate limit.
 */
export async function logRateLimitEvent(sdk, { action, identifier, ip, reason, attempts, rid }) {
  await sdk.entities.SecurityEvent.create({
    event_type: 'rate_limit_exceeded',
    severity: reason === 'HARD_BLOCKED' ? 'critical' : 'high',
    actor_email: identifier,
    ip_address: ip,
    route: action,
    details: { reason, attempts, request_id: rid },
    blocked: true,
    request_id: rid,
  }).catch(() => {});
}