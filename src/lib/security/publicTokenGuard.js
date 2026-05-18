/**
 * publicTokenGuard.js — Anti-enumeração para endpoints públicos tokenizados.
 *
 * Wrapper sobre `checkPersistentRateLimit` específico para tokens públicos
 * (confirmar agendamento, avaliar atendimento, reset de senha, etc.).
 *
 * Quando um atacante tenta enumerar tokens válidos (brute force), o sistema:
 *  1. Conta tentativas por IP+rota (não por token — o token muda a cada try).
 *  2. Bloqueia após N tentativas em M minutos.
 *  3. Registra `SecurityEvent` do tipo `brute_force_attempt`.
 *
 * USO (em uma backend function que valida token público):
 *
 *   import { checkPublicTokenAccess } from '../lib/security/publicTokenGuard.js';
 *
 *   const gate = await checkPublicTokenAccess(sdk, {
 *     action: 'confirmAppointment',
 *     ip: req.headers.get('x-forwarded-for') || 'unknown',
 *     tokenFound: !!appointment, // true se o token bateu, false caso contrário
 *     rid: requestId,
 *   });
 *   if (!gate.allowed) {
 *     return Response.json({ error: 'TOO_MANY_ATTEMPTS' }, { status: 429 });
 *   }
 */

import { checkPersistentRateLimit, logRateLimitEvent } from './persistentRateLimit.js';

const DEFAULTS = {
  // Janela curta + limite baixo: ataque típico de enumeração faz centenas de tries/min.
  limitPerWindow: 5,
  windowMinutes: 15,
  hardLimitMultiplier: 4, // 20 tries → bloqueio crítico 24h
  hardBlockHours: 24,
  softBlockHours: 1,
};

/**
 * Avalia se o IP pode fazer mais uma tentativa de validar token público.
 *
 * @param {object} sdk - base44.asServiceRole
 * @param {object} opts
 * @param {string} opts.action - 'confirmAppointment' | 'submitReview' | 'customerAuth.reset' | etc.
 * @param {string} opts.ip
 * @param {boolean} opts.tokenFound - true se o token foi encontrado no banco
 * @param {string} [opts.rid] - request_id para correlação
 * @param {object} [opts.overrides] - sobrescreve limites default
 * @returns {Promise<{allowed: boolean, blocked_until?: string, reason?: string}>}
 */
export async function checkPublicTokenAccess(sdk, { action, ip, tokenFound, rid, overrides = {} }) {
  const config = { ...DEFAULTS, ...overrides };
  const safeIp = (typeof ip === 'string' && ip) ? ip.slice(0, 64) : 'unknown';

  // Só conta tentativas FALHAS — quem acerta o token na primeira não é punido.
  // Mas se o IP já está bloqueado, bloqueamos mesmo se o token estiver certo
  // (proteção contra brute force que acabou de acertar).
  const result = await checkPersistentRateLimit(sdk, {
    action: `public_token:${action}`,
    identifier: tokenFound ? `success:${safeIp}` : `fail:${safeIp}`,
    ip: safeIp,
    limitPerWindow: config.limitPerWindow,
    windowMinutes: config.windowMinutes,
    hardLimitMultiplier: config.hardLimitMultiplier,
    hardBlockHours: config.hardBlockHours,
    softBlockHours: config.softBlockHours,
  });

  if (!result.allowed) {
    await logRateLimitEvent(sdk, {
      action: `public_token:${action}`,
      identifier: safeIp,
      ip: safeIp,
      reason: result.reason,
      attempts: result.attempts,
      rid,
    }).catch(() => {});

    // Registra evento específico de brute force quando o gatilho foi tentativa falha
    if (!tokenFound) {
      await sdk.entities.SecurityEvent.create({
        event_type: 'brute_force_attempt',
        severity: result.reason === 'HARD_BLOCKED' ? 'critical' : 'high',
        ip_address: safeIp,
        route: action,
        details: { attempts: result.attempts, request_id: rid },
        blocked: true,
        request_id: rid,
      }).catch(() => {});
    }
  }

  return result;
}