/**
 * urlSanitizer.js — Sanitização de fragmentos de URL.
 *
 * Funções complementares ao safeRedirect:
 *  - `sanitizeSlug(value)`      — slugs de empresa, nomes públicos (a-z 0-9 _ -)
 *  - `sanitizePath(value)`      — paths internos (a-z A-Z 0-9 _ - / .)
 *  - `sanitizeUrlParam(value)`  — valor genérico de query param (sem `< > " ' \` etc.)
 *
 * Todas as funções:
 *  - Aceitam qualquer entrada (string ou não), retornam string
 *  - Decodificam até 2 vezes para detectar payloads %252e
 *  - Aplicam limite de tamanho (MAX_LEN) para prevenir DoS
 *  - Bloqueiam padrões clássicos: ../, //, javascript:, data:, blob:, %2e
 *  - Retornam string vazia quando o input é claramente malicioso
 *
 * NÃO usa essas funções para redirect — para redirect, use safeRedirect.
 * Essas funções são para EXIBIR/USAR valores em queries/paths, não navegar.
 */

const MAX_LEN = 256;
const FORBIDDEN_PROTOCOL = /(javascript|data|blob|file|vbscript|about|chrome|moz-extension|chrome-extension):/i;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const SLUG_VALID = /^[a-z0-9_-]+$/;
const PATH_VALID = /^[a-zA-Z0-9_\-/.]+$/;

function decodeTwice(input) {
  let s = input;
  try {
    for (let i = 0; i < 2; i++) {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    }
  } catch {
    return null;
  }
  return s;
}

function hasDangerousPattern(decoded) {
  if (decoded == null) return true;
  if (CONTROL_CHARS.test(decoded)) return true;
  if (FORBIDDEN_PROTOCOL.test(decoded)) return true;
  if (decoded.includes('..')) return true;
  if (decoded.includes('//')) return true;
  return false;
}

/**
 * Sanitiza slug público (ex: slug da barbearia).
 * Aceita apenas [a-z0-9_-], converte para lowercase, máximo 64 chars.
 * Retorna '' se inválido.
 */
export function sanitizeSlug(value) {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw || raw.length > MAX_LEN) return '';

  const decoded = decodeTwice(raw);
  if (hasDangerousPattern(decoded)) return '';

  const lower = decoded.toLowerCase().slice(0, 64);
  return SLUG_VALID.test(lower) ? lower : '';
}

/**
 * Sanitiza path interno (ex: rota SPA). Aceita [a-zA-Z0-9_-/.].
 * Retorna '' se inválido.
 */
export function sanitizePath(value) {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw || raw.length > MAX_LEN) return '';

  const decoded = decodeTwice(raw);
  if (hasDangerousPattern(decoded)) return '';

  return PATH_VALID.test(decoded) ? decoded : '';
}

/**
 * Sanitiza valor genérico de query param para exibição/uso interno.
 * Remove caracteres perigosos para HTML/JS sem destruir o valor.
 * Use quando precisar mostrar o param em algum lugar.
 */
export function sanitizeUrlParam(value) {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw || raw.length > MAX_LEN) return '';

  const decoded = decodeTwice(raw);
  if (decoded == null) return '';
  if (CONTROL_CHARS.test(decoded)) return '';
  if (FORBIDDEN_PROTOCOL.test(decoded)) return '';

  // Remove caracteres XSS clássicos
  return decoded.replace(/[<>"'`\\]/g, '').slice(0, MAX_LEN);
}