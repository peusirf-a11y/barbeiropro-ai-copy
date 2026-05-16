/**
 * sessionManager — Gerenciamento de sessões admin/master no frontend.
 *
 * Responsabilidades:
 *  - Controle de expiração da impersonação (15 min)
 *  - Exibição de timer countdown para master
 *  - Revogação de sessão local
 *
 * Backend: entidade UserSession (device-bound sessions) é criada pelo customerAuth.
 */

const IMPERSONATION_TTL_MS = 15 * 60 * 1000; // 15 min

/**
 * Calcula tempo restante de impersonação em segundos.
 * Retorna 0 se expirado.
 */
export function getImpersonationSecondsLeft(expiresAt) {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}

/**
 * Formata segundos restantes para display (MM:SS).
 */
export function formatSecondsLeft(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Verifica se impersonação está prestes a expirar (< 2min).
 */
export function isImpersonationExpiringSoon(expiresAt, thresholdSeconds = 120) {
  return getImpersonationSecondsLeft(expiresAt) <= thresholdSeconds;
}

/**
 * Gera um device_id estável para o browser atual.
 * Persiste no sessionStorage (não sobrevive ao fechar a aba — intencional).
 */
export function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return 'ssr';
  const key = '_oc_did';
  let did = sessionStorage.getItem(key);
  if (!did) {
    did = `did_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(key, did);
  }
  return did;
}

/**
 * Extrai informações básicas do dispositivo para fingerprint superficial.
 * Nunca usar para tracking invasivo — apenas contexto de segurança.
 */
export function getDeviceContext() {
  if (typeof navigator === 'undefined') return {};
  return {
    user_agent: navigator.userAgent?.slice(0, 200),
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}`,
    device_id: getOrCreateDeviceId(),
  };
}