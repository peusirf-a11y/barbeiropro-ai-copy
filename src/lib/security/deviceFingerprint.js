/**
 * deviceFingerprint.js — Fingerprint leve e estável de dispositivo.
 * 
 * NÃO usa: canvas fingerprint, audio fingerprint, WebRTC, técnicas anti-privacidade.
 * USA: dados públicos e não-invasivos disponíveis em qualquer navegador.
 * 
 * Gera um device_trust_id estável para reconhecimento de dispositivo confiável.
 */

// Normaliza user agent removendo versões exatas (mais estável entre updates)
function normalizeUA(ua) {
  if (!ua) return 'unknown';
  return ua
    .replace(/(\d+\.\d+\.\d+\.\d+|\d+\.\d+\.\d+)/g, 'X') // remove versões
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120); // limita tamanho
}

// Extrai família do dispositivo (mobile/desktop/tablet)
function getDeviceFamily(ua) {
  if (!ua) return 'unknown';
  const lower = ua.toLowerCase();
  if (lower.includes('ipad') || lower.includes('tablet')) return 'tablet';
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) return 'mobile';
  return 'desktop';
}

// Hash simples e rápido (não criptográfico — só para identificação)
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Converte para 32-bit
  }
  return Math.abs(hash).toString(36);
}

/**
 * Coleta os sinais do dispositivo de forma não-invasiva.
 * @returns {object} Sinais brutos do dispositivo
 */
export function collectDeviceSignals() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const win = typeof window !== 'undefined' ? window : {};
  const scr = typeof screen !== 'undefined' ? screen : {};

  return {
    ua_normalized: normalizeUA(nav.userAgent || ''),
    device_family: getDeviceFamily(nav.userAgent || ''),
    language: nav.language || nav.languages?.[0] || 'unknown',
    timezone: Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || 'unknown',
    // Resolução em bucket (não precisa ser exata)
    screen_bucket: scr.width
      ? `${Math.round(scr.width / 400) * 400}x${Math.round(scr.height / 300) * 300}`
      : 'unknown',
    // Hardware (aproximado — boa estabilidade)
    cpu_cores: nav.hardwareConcurrency || 0,
    memory_bucket: nav.deviceMemory
      ? (nav.deviceMemory <= 2 ? 'low' : nav.deviceMemory <= 8 ? 'mid' : 'high')
      : 'unknown',
    touch_support: 'ontouchstart' in (win) || (nav.maxTouchPoints || 0) > 0,
    platform: nav.platform || 'unknown',
    // Color depth (diferencia mobile/desktop)
    color_depth: scr.colorDepth || 0,
  };
}

/**
 * Gera o device_trust_id a partir dos sinais coletados.
 * É estável entre sessões do mesmo dispositivo.
 * @returns {string} device_trust_id
 */
export function generateDeviceTrustId() {
  const signals = collectDeviceSignals();
  
  // Concatena sinais mais estáveis para o hash
  const stableSignature = [
    signals.ua_normalized,
    signals.timezone,
    signals.language,
    signals.screen_bucket,
    signals.cpu_cores,
    signals.memory_bucket,
    signals.touch_support ? '1' : '0',
    signals.platform,
  ].join('|');

  return `dt_${simpleHash(stableSignature)}`;
}

/**
 * Persiste o device_trust_id no localStorage para reutilização.
 * @returns {string} device_trust_id persistido
 */
export function getOrCreateDeviceTrustId() {
  const STORAGE_KEY = 'ocorte_device_trust_id';
  
  if (typeof localStorage === 'undefined') return generateDeviceTrustId();
  
  let stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    stored = generateDeviceTrustId();
    localStorage.setItem(STORAGE_KEY, stored);
  }
  return stored;
}

/**
 * Compara dois sets de sinais e retorna score de similaridade.
 * @param {object} sigA 
 * @param {object} sigB 
 * @returns {{ similarity: number, changed_fields: string[] }}
 */
export function compareDeviceSignals(sigA, sigB) {
  if (!sigA || !sigB) return { similarity: 0, changed_fields: ['all'] };

  const fields = ['ua_normalized', 'device_family', 'language', 'timezone', 'screen_bucket', 'cpu_cores', 'touch_support', 'platform'];
  const changedFields = fields.filter(f => sigA[f] !== sigB[f]);
  const similarity = Math.round(((fields.length - changedFields.length) / fields.length) * 100);

  return { similarity, changed_fields: changedFields };
}

/**
 * Classifica o nível de confiança de um dispositivo baseado no histórico.
 * @param {object} params
 * @param {string} params.deviceTrustId - ID atual do dispositivo
 * @param {string[]} params.knownDeviceIds - IDs conhecidos do usuário
 * @param {number} params.successfulLoginsOnDevice - Logins bem-sucedidos neste device
 * @returns {'trusted'|'known'|'suspicious'|'unknown'}
 */
export function classifyDeviceTrust({ deviceTrustId, knownDeviceIds = [], successfulLoginsOnDevice = 0 }) {
  if (!deviceTrustId) return 'unknown';
  
  const isKnown = knownDeviceIds.includes(deviceTrustId);
  
  if (!isKnown) return 'unknown';
  if (successfulLoginsOnDevice >= 5) return 'trusted';
  if (successfulLoginsOnDevice >= 2) return 'known';
  return 'suspicious';
}