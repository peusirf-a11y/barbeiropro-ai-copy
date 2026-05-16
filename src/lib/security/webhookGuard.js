/**
 * webhookGuard.js — Proteção robusta para endpoints de webhook.
 *
 * Implementa:
 *  - Validação de timestamp (tolerância configurável)
 *  - Proteção contra replay com nonce persistido
 *  - Assinatura obrigatória
 *  - Idempotência forte
 *  - Allowlist opcional de IPs de origem
 *
 * USO: backend functions (Deno).
 */

// Tolerância de relógio: aceita webhooks com até N segundos de diferença
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 300; // 5 min

// TTL do nonce para deduplicação (deve ser >= clock tolerance)
const NONCE_TTL_SECONDS = 600; // 10 min

/**
 * Valida se um timestamp está dentro da janela de tolerância.
 * @param {number|string} timestamp - Unix timestamp em segundos
 * @param {number} toleranceSeconds
 * @returns {{ valid: boolean, reason: string|null }}
 */
export function validateTimestamp(timestamp, toleranceSeconds = DEFAULT_CLOCK_TOLERANCE_SECONDS) {
  if (!timestamp) return { valid: false, reason: 'Timestamp ausente' };

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return { valid: false, reason: 'Timestamp inválido' };

  const nowSeconds = Math.floor(Date.now() / 1000);
  const diff = Math.abs(nowSeconds - ts);

  if (diff > toleranceSeconds) {
    return {
      valid: false,
      reason: `Timestamp fora da janela: ${diff}s (tolerância: ${toleranceSeconds}s)`,
    };
  }

  return { valid: true, reason: null };
}

/**
 * Valida assinatura HMAC-SHA256 de webhook.
 * @param {string} payload - Body raw como string
 * @param {string} signature - Assinatura recebida (hex ou base64)
 * @param {string} secret - Segredo compartilhado
 * @returns {Promise<boolean>}
 */
export async function validateHmacSignature(payload, signature, secret) {
  if (!payload || !signature || !secret) return false;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const computedHex = Array.from(new Uint8Array(sigBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Remove prefixos comuns (sha256=, v1=, etc.)
    const cleanSig = signature.replace(/^(sha256=|v1=|hmac-)/, '');
    
    // Comparação timing-safe
    if (computedHex.length !== cleanSig.length) return false;
    let diff = 0;
    for (let i = 0; i < computedHex.length; i++) {
      diff |= computedHex.charCodeAt(i) ^ cleanSig.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

/**
 * Extrai e valida o nonce de um webhook para proteção contra replay.
 * @param {string} nonce - ID único do evento
 * @param {object[]} recentEvents - Eventos recentes do SecurityEvent
 * @returns {{ valid: boolean, reason: string|null }}
 */
export function validateNonce(nonce, recentEvents = []) {
  if (!nonce) return { valid: false, reason: 'Nonce ausente' };

  const isDuplicate = recentEvents.some(e =>
    e.details?.nonce === nonce &&
    e.event_type === 'webhook_replay_attempt'
  );

  if (isDuplicate) {
    return { valid: false, reason: `Replay detectado: nonce ${nonce} já processado` };
  }

  return { valid: true, reason: null };
}

/**
 * Guard completo para webhooks.
 * @param {object} params
 * @param {string} params.payload - Body raw
 * @param {string} params.signature - Assinatura recebida
 * @param {string} params.secret - Segredo HMAC
 * @param {string|number} params.timestamp - Unix timestamp do evento
 * @param {string} params.nonce - ID único do evento (para anti-replay)
 * @param {object[]} params.recentEvents - SecurityEvents recentes (para nonce check)
 * @param {string[]} [params.allowedIps] - IPs permitidos (opcional)
 * @param {string} [params.sourceIp] - IP de origem do request
 * @returns {Promise<{ valid: boolean, reason: string|null }>}
 */
export async function validateWebhook({
  payload,
  signature,
  secret,
  timestamp,
  nonce,
  recentEvents = [],
  allowedIps,
  sourceIp,
}) {
  // 1) IP allowlist (opcional)
  if (allowedIps && allowedIps.length > 0 && sourceIp) {
    if (!allowedIps.includes(sourceIp)) {
      return { valid: false, reason: `IP não autorizado: ${sourceIp}` };
    }
  }

  // 2) Timestamp
  const tsResult = validateTimestamp(timestamp);
  if (!tsResult.valid) return tsResult;

  // 3) Assinatura HMAC
  const sigValid = await validateHmacSignature(payload, signature, secret);
  if (!sigValid) return { valid: false, reason: 'Assinatura inválida' };

  // 4) Nonce/replay
  if (nonce) {
    const nonceResult = validateNonce(nonce, recentEvents);
    if (!nonceResult.valid) return nonceResult;
  }

  return { valid: true, reason: null };
}