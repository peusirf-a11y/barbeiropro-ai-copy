/**
 * cookieConsent.js — Gerenciador central de consentimento de cookies (LGPD-compliant)
 *
 * Responsabilidades:
 * - Salvar / ler consentimento no localStorage
 * - Verificar permissões por categoria
 * - Bloquear scripts de tracking antes do consentimento
 * - Carregar scripts apenas após consentimento explícito
 * - Revogar consentimento e limpar dados de tracking
 * - Detectar expiração (6 meses) e solicitar revalidação
 *
 * Categorias:
 *   necessary  — sempre ativo, não pode ser desligado
 *   analytics  — Google Analytics, métricas, heatmaps
 *   marketing  — pixels de remarketing, Meta Pixel, anúncios
 *   functional — preferências, tema, idioma
 */

const STORAGE_KEY = 'ocorte_cookie_consent';
const POLICY_VERSION = 'v1.0';
const EXPIRY_MONTHS = 6; // revalidar a cada 6 meses

// ─── Tipos ───────────────────────────────────────────────────────────────────

export const COOKIE_CATEGORIES = {
  necessary: {
    id: 'necessary',
    label: 'Necessários',
    description: 'Autenticação, sessão, segurança (CSRF) e persistência de login. Sempre ativos.',
    always_on: true,
    cookies: ['session', 'auth_token', 'csrf_token', '__stripe_*'],
  },
  analytics: {
    id: 'analytics',
    label: 'Analytics',
    description: 'Google Analytics, métricas de uso, heatmaps e rastreamento de eventos de produto.',
    always_on: false,
    cookies: ['_ga', '_gid', '_gat', '_hjid', '_hjSession*'],
    scripts: ['https://www.googletagmanager.com', 'https://static.hotjar.com'],
  },
  marketing: {
    id: 'marketing',
    label: 'Marketing',
    description: 'Pixels de remarketing, Meta Pixel, Google Ads e métricas de conversão.',
    always_on: false,
    cookies: ['_fbp', '_fbc', 'fr', '_gcl_*'],
    scripts: ['https://connect.facebook.net', 'https://googleadservices.com'],
  },
  functional: {
    id: 'functional',
    label: 'Funcionais',
    description: 'Preferências do usuário, tema, idioma e personalização de interface.',
    always_on: false,
    cookies: ['theme', 'lang', 'ui_preferences'],
  },
};

// ─── ID anônimo ───────────────────────────────────────────────────────────────

export function getAnonymousId() {
  try {
    let id = localStorage.getItem('ocorte_anon_id');
    if (!id) {
      id = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('ocorte_anon_id', id);
    }
    return id;
  } catch {
    return 'anon_unknown';
  }
}

// ─── Leitura / escrita ────────────────────────────────────────────────────────

export function getConsentState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveConsentState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

// ─── Status atual ─────────────────────────────────────────────────────────────

/**
 * Retorna o estado atual do consentimento.
 * null = nunca consentido / precisa mostrar banner
 */
export function getConsentStatus() {
  const state = getConsentState();
  if (!state) return { hasConsent: false, expired: false, revalidationNeeded: false };

  // Verifica expiração
  if (state.expires_at && new Date(state.expires_at) < new Date()) {
    return { hasConsent: true, expired: true, revalidationNeeded: true, state };
  }

  // Verifica mudança de versão da política
  if (state.policy_version !== POLICY_VERSION) {
    return { hasConsent: true, expired: false, revalidationNeeded: true, state };
  }

  return { hasConsent: true, expired: false, revalidationNeeded: false, state };
}

/**
 * Verifica se uma categoria específica foi aceita.
 */
export function hasConsent(category) {
  if (category === 'necessary') return true;
  const state = getConsentState();
  if (!state) return false;
  return Array.isArray(state.accepted_categories) && state.accepted_categories.includes(category);
}

/**
 * True se está em privacy-first mode (usuário recusou analytics).
 */
export function isPrivacyFirstMode() {
  return !hasConsent('analytics') && !hasConsent('marketing');
}

// ─── Ações de consentimento ────────────────────────────────────────────────────

function buildExpiresAt() {
  const d = new Date();
  d.setMonth(d.getMonth() + EXPIRY_MONTHS);
  return d.toISOString();
}

export function acceptAll() {
  const state = {
    anonymous_id: getAnonymousId(),
    accepted_categories: ['analytics', 'marketing', 'functional'],
    rejected_categories: [],
    action: 'accept_all',
    policy_version: POLICY_VERSION,
    consented_at: new Date().toISOString(),
    expires_at: buildExpiresAt(),
    privacy_first_mode: false,
  };
  saveConsentState(state);
  _applyConsent(state);
  _logConsent(state);
  return state;
}

export function rejectOptional() {
  const state = {
    anonymous_id: getAnonymousId(),
    accepted_categories: [],
    rejected_categories: ['analytics', 'marketing', 'functional'],
    action: 'reject_optional',
    policy_version: POLICY_VERSION,
    consented_at: new Date().toISOString(),
    expires_at: buildExpiresAt(),
    privacy_first_mode: true,
  };
  saveConsentState(state);
  _applyConsent(state);
  _logConsent(state);
  return state;
}

export function setCustomConsent({ analytics, marketing, functional }) {
  const accepted = [];
  const rejected = [];
  if (analytics) accepted.push('analytics'); else rejected.push('analytics');
  if (marketing) accepted.push('marketing'); else rejected.push('marketing');
  if (functional) accepted.push('functional'); else rejected.push('functional');

  const state = {
    anonymous_id: getAnonymousId(),
    accepted_categories: accepted,
    rejected_categories: rejected,
    action: 'custom',
    policy_version: POLICY_VERSION,
    consented_at: new Date().toISOString(),
    expires_at: buildExpiresAt(),
    privacy_first_mode: !analytics && !marketing,
  };
  saveConsentState(state);
  _applyConsent(state);
  _logConsent(state);
  return state;
}

export function revokeConsent() {
  const prev = getConsentState();
  const state = {
    anonymous_id: getAnonymousId(),
    accepted_categories: [],
    rejected_categories: ['analytics', 'marketing', 'functional'],
    action: 'revoke',
    policy_version: POLICY_VERSION,
    consented_at: new Date().toISOString(),
    expires_at: buildExpiresAt(),
    privacy_first_mode: true,
  };
  saveConsentState(state);
  _removeTrackingCookies();
  _logConsent(state);
  // Reload para descarregar scripts já carregados
  window.location.reload();
}

// ─── Aplicação de scripts ─────────────────────────────────────────────────────

function _applyConsent(state) {
  const accepted = state.accepted_categories || [];

  // Analytics
  if (accepted.includes('analytics')) {
    _loadGoogleAnalytics();
  }

  // Marketing
  if (accepted.includes('marketing')) {
    _loadMetaPixel();
  }
}

function _loadGoogleAnalytics() {
  // Só carrega se GA_ID estiver definido na window (configurado pelo app)
  const gaId = window.GA_MEASUREMENT_ID;
  if (!gaId || document.querySelector(`script[src*="googletagmanager"]`)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', gaId, { anonymize_ip: true });
}

function _loadMetaPixel() {
  const pixelId = window.META_PIXEL_ID;
  if (!pixelId || document.querySelector(`script[src*="connect.facebook.net"]`)) return;
  !function(f,b,e,v,n,t,s) {
    if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)
  }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}

function _removeTrackingCookies() {
  const trackingCookies = ['_ga', '_gid', '_gat', '_hjid', '_fbp', '_fbc', 'fr'];
  trackingCookies.forEach(name => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
}

// ─── Auditoria async (não-bloqueante) ─────────────────────────────────────────

async function _logConsent(state) {
  try {
    const { base44 } = await import('@/api/base44Client');
    await base44.entities.CookieConsentLog.create({
      anonymous_id: state.anonymous_id,
      accepted_categories: state.accepted_categories,
      rejected_categories: state.rejected_categories,
      action: state.action,
      policy_version: state.policy_version,
      expires_at: state.expires_at,
      privacy_first_mode: state.privacy_first_mode,
      user_agent: navigator.userAgent,
    });
  } catch {
    // log silencioso — não deve impedir fluxo
  }
}

// ─── Inicialização (chamada no boot do app) ───────────────────────────────────

/**
 * Chame esta função no carregamento do app.
 * Aplica consentimento já salvo sem pedir novamente ao usuário.
 * Retorna o status atual para o banner decidir se deve aparecer.
 */
export function initCookieConsent() {
  const status = getConsentStatus();
  if (status.hasConsent && !status.revalidationNeeded) {
    _applyConsent(status.state);
  }
  return status;
}

export { POLICY_VERSION };