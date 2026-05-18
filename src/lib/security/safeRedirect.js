/**
 * safeRedirect.js — Open Redirect Guard
 *
 * Sanitiza valores de `?next=`, `?returnTo=`, `?redirect=`, `?callback=` etc.
 * para evitar que um atacante leve o usuário logado para um domínio externo
 * malicioso após login/onboarding/checkout.
 *
 * Bloqueia:
 *  - URLs absolutas (https://evil.com, //evil.com)
 *  - Protocolos perigosos (javascript:, data:, blob:, file:, vbscript:)
 *  - Path traversal (../, %2e%2e, ..%2f)
 *  - Strings vazias / não-string
 *  - Caracteres de controle (newline, tab, NUL) — usados em smuggling
 *
 * Permite APENAS rotas internas começando com "/" (uma barra só).
 *
 * USO:
 *   import { safeRedirect } from '@/lib/security/safeRedirect';
 *   const target = safeRedirect(params.get('next'), '/app/dashboard');
 *   navigate(target);
 */

const DEFAULT_FALLBACK = '/app/dashboard';

// Caracteres que NUNCA podem aparecer numa rota interna.
// Inclui controles ASCII (\u0000–\u001F + \u007F) que podem ser usados em
// header/path smuggling, e backslash que alguns navegadores normalizam para "/".
// eslint-disable-next-line no-control-regex
const DANGEROUS_CHARS = /[\u0000-\u001F\u007F\\<>"`{}|^]/;

const FORBIDDEN_PROTOCOL = /^(javascript|data|blob|file|vbscript|about|chrome|moz-extension|chrome-extension):/i;

/**
 * Retorna `input` se for um path interno seguro, ou `fallback` caso contrário.
 *
 * @param {unknown} input - valor recebido de query string / state / form
 * @param {string} [fallback='/app/dashboard'] - rota interna de fallback
 * @returns {string} rota interna segura (sempre começa com "/")
 */
export function safeRedirect(input, fallback = DEFAULT_FALLBACK) {
  const safeFallback = isInternalPath(fallback) ? fallback : DEFAULT_FALLBACK;

  if (typeof input !== 'string') return safeFallback;

  // Trim — espaços laterais não fazem parte de URL legítima
  const raw = input.trim();
  if (!raw) return safeFallback;

  // Decodifica até 2 vezes para pegar payloads tipo %252e%252e%252f
  let decoded = raw;
  try {
    for (let i = 0; i < 2; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return safeFallback; // URI mal formada
  }

  // Caracteres de controle / quebras / backslash — nunca em rota legítima
  if (DANGEROUS_CHARS.test(decoded)) return safeFallback;

  // Protocolos perigosos
  if (FORBIDDEN_PROTOCOL.test(decoded)) return safeFallback;

  // URL absoluta com scheme (http://, https://, etc.)
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(decoded)) return safeFallback;

  // "//domain" — protocol-relative URL, escapa do origin atual
  if (decoded.startsWith('//')) return safeFallback;

  // Tem que começar com "/" (e só uma)
  if (!decoded.startsWith('/')) return safeFallback;

  // Path traversal — qualquer ".." é suspeito numa rota SPA
  if (decoded.includes('..')) return safeFallback;

  return decoded;
}

/**
 * Helper interno: valida se o fallback informado é seguro.
 */
function isInternalPath(p) {
  return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') && !p.includes('..');
}

/**
 * Conveniência para uso direto com `useSearchParams`:
 *
 *   const [params] = useSearchParams();
 *   navigate(safeRedirectFromParams(params, ['next', 'returnTo', 'redirect']));
 */
export function safeRedirectFromParams(params, keys = ['next', 'returnTo', 'redirect', 'callback'], fallback = DEFAULT_FALLBACK) {
  if (!params) return safeRedirect(null, fallback);
  for (const key of keys) {
    const value = typeof params.get === 'function' ? params.get(key) : params?.[key];
    if (value) return safeRedirect(value, fallback);
  }
  return safeRedirect(null, fallback);
}