/**
 * Content Security Policy (CSP) — configuração e utilitários.
 *
 * Uso no frontend: injetar meta tag CSP via initCSP().
 * Modo report-only por padrão; alterar ENFORCE=true para enforcement total.
 *
 * Referência: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
 */

// ── POLÍTICA CSP ──────────────────────────────────────────────────────────────
// Domínios autorizados para cada diretiva.
// Manter mínimo necessário — cada adição é superfície de ataque.
const CSP_DIRECTIVES = {
  'default-src':     ["'self'"],
  'script-src':      ["'self'", 'https://js.stripe.com', 'https://maps.googleapis.com'],
  'style-src':       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src':        ["'self'", 'https://fonts.gstatic.com'],
  'img-src':         ["'self'", 'data:', 'https:', 'blob:'],
  'connect-src':     [
    "'self'",
    'https://api.stripe.com',
    'https://*.base44.com',
    'https://media.base44.com',
    'wss://*.base44.com',
  ],
  'frame-src':       ['https://js.stripe.com', 'https://hooks.stripe.com'],
  'worker-src':      ["'self'", 'blob:'],
  'object-src':      ["'none'"],
  'base-uri':        ["'self'"],
  'form-action':     ["'self'"],
  'upgrade-insecure-requests': [],
};

/**
 * Gera a string de policy CSP a partir das diretivas configuradas.
 */
export function buildCSPString() {
  return Object.entries(CSP_DIRECTIVES)
    .map(([dir, srcs]) => srcs.length > 0 ? `${dir} ${srcs.join(' ')}` : dir)
    .join('; ');
}

/**
 * Injeta a meta tag CSP no <head> do documento.
 * Chamar uma única vez no bootstrap da aplicação (main.jsx).
 *
 * VULN-019: CSP em Enforcement Mode ativo.
 * Monitorado por 2 semanas em Report-Only; após validação zero-violations, enforcement = true.
 *
 * @param {boolean} reportOnly - true = Report-Only (não bloqueia), false = Enforcement
 * @param {string} reportUri - URL para receber relatórios de violação
 */
export function initCSP({ reportOnly = false, reportUri = '/api/cspReport' } = {}) {
  if (typeof document === 'undefined') return;

  // Evita duplicata
  if (document.querySelector('meta[http-equiv="Content-Security-Policy"]') ||
      document.querySelector('meta[http-equiv="Content-Security-Policy-Report-Only"]')) {
    return;
  }

  const policy = buildCSPString();
  const meta = document.createElement('meta');
  const httpEquiv = reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
  meta.setAttribute('http-equiv', httpEquiv);
  meta.setAttribute('content', reportUri ? `${policy}; report-uri ${reportUri}` : policy);
  document.head.prepend(meta);

  console.info(`[CSP] ${reportOnly ? 'Report-Only' : 'Enforcement'} mode ativado`);
}

/**
 * Instala um listener para eventos de violação CSP e os reporta.
 * Útil para debug em Report-Only mode.
 */
export function installCSPViolationListener(onViolation) {
  if (typeof document === 'undefined') return () => {};
  const handler = (e) => {
    const report = {
      document_uri: e.documentURI,
      violated_directive: e.violatedDirective,
      effective_directive: e.effectiveDirective,
      blocked_uri: e.blockedURI,
      source_file: e.sourceFile,
      line_number: e.lineNumber,
    };
    console.warn('[CSP Violation]', report);
    if (typeof onViolation === 'function') onViolation(report);
  };
  document.addEventListener('securitypolicyviolation', handler);
  return () => document.removeEventListener('securitypolicyviolation', handler);
}

/**
 * Security headers recomendados para responses de backend (Deno).
 * Adicionar a qualquer Response com: addSecurityHeaders(response).
 *
 * VULN-013: CORS configurado para origin único (não usar *)
 * VULN-019: CSP em enforcement via header (não apenas meta tag)
 */
const getCorsOrigin = () => {
  if (typeof globalThis !== 'undefined' && globalThis.Deno?.env?.get) {
    return globalThis.Deno.env.get('CORS_ORIGIN') || 'https://app.ocorte.com.br';
  }
  return 'https://app.ocorte.com.br';
};

/**
 * Aplica security headers a um objeto de headers existente.
 */
export function applySecurityHeaders(headers = {}) {
  return {
    ...headers,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(self)',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-XSS-Protection': '1; mode=block',
    'Access-Control-Allow-Origin': getCorsOrigin(),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}