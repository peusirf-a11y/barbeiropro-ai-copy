// Referral Tracking — captura e persiste o `?ref=CODE` do parceiro indicador.
//
// Regras:
//  • Storage: localStorage (com fallback para sessionStorage).
//  • TTL: 90 dias (último clique válido vence — sobrescreve registro anterior).
//  • Captura: chamado uma vez no app shell. Idempotente.
//  • Consumo: ao criar Company (checkout/onboarding), ler `getActiveReferral()`
//    e enviar `referral_code` + `click_metadata` no payload do backend.
//
// IMPORTANTE: este módulo é client-side puro — server-side valida tudo de novo.

const KEY = 'ocorte_ref';
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

function _safeStorage() {
  // Tenta localStorage; cai pra sessionStorage; senão usa memória.
  if (typeof window === 'undefined') return null;
  try {
    const t = '__ocorte_ref_test__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
}

function _readRaw() {
  const s = _safeStorage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.code || !parsed?.expires_at) return null;
    if (new Date(parsed.expires_at).getTime() < Date.now()) {
      // Expirou — limpa.
      s.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function _writeRaw(payload) {
  const s = _safeStorage();
  if (!s) return false;
  try {
    s.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Captura `?ref=CODE` da URL atual e persiste por 90 dias.
 * Último clique vence. Chamado uma vez no boot do app.
 * Retorna o código capturado (se houver) ou null.
 */
export function captureReferralFromUrl() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('ref') || '').trim();
    if (!code) return null;
    // Sanitização: aceita apenas alfanumérico + _ + -, 4-32 chars.
    if (!/^[A-Za-z0-9_-]{4,32}$/.test(code)) return null;
    const payload = {
      code,
      captured_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + TTL_MS).toISOString(),
      landing: window.location.pathname + window.location.search,
    };
    _writeRaw(payload);
    return code;
  } catch {
    return null;
  }
}

/**
 * Retorna o referral ativo atual (não expirado) ou null.
 * Estrutura: { code, captured_at, expires_at, landing }
 */
export function getActiveReferral() {
  return _readRaw();
}

/**
 * Devolve apenas o código (string) ativo ou null.
 */
export function getReferralCode() {
  const r = _readRaw();
  return r?.code || null;
}

/**
 * Limpa o referral persistido (chamar após consumo bem-sucedido no signup,
 * para evitar atribuir duas vezes em fluxos posteriores).
 */
export function clearReferral() {
  const s = _safeStorage();
  if (!s) return;
  try { s.removeItem(KEY); } catch { /* no-op */ }
}

/**
 * Gera um device fingerprint leve (não-tracking invasivo) — usado em anti-fraude.
 * Combina: user-agent + screen + timezone + língua. Hash simples (FNV-1a).
 */
export function getDeviceFingerprint() {
  if (typeof window === 'undefined') return null;
  try {
    const parts = [
      navigator.userAgent || '',
      navigator.language || '',
      String(screen?.width || '') + 'x' + String(screen?.height || ''),
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      String(navigator.hardwareConcurrency || ''),
    ].join('|');
    // FNV-1a 32-bit
    let h = 0x811c9dc5;
    for (let i = 0; i < parts.length; i++) {
      h ^= parts.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return 'fp_' + h.toString(16).padStart(8, '0');
  } catch {
    return null;
  }
}