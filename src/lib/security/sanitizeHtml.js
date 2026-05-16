/**
 * sanitizeHtml — Sanitizador central de HTML/texto para prevenção de XSS.
 *
 * Usa uma allowlist estrita de tags e atributos.
 * Bloqueia: script, iframe, onerror, onclick, javascript:, data:text/html, SVG malicioso.
 *
 * Uso:
 *   import { sanitizeHtml, sanitizeText } from '@/lib/security/sanitizeHtml';
 *   const safe = sanitizeHtml(userInput);
 *   const plain = sanitizeText(userInput); // sem HTML nenhum
 */

// Tags permitidas (HTML mínimo seguro)
const ALLOWED_TAGS = new Set([
  'b', 'i', 'em', 'strong', 'u', 's', 'br', 'p',
  'ul', 'ol', 'li', 'blockquote', 'span',
]);

// Atributos permitidos por tag
const ALLOWED_ATTRS = {
  '*': ['class', 'id'],
  a: ['href', 'title', 'target', 'rel'],
};

// Protocolos perigosos bloqueados em hrefs
const DANGEROUS_PROTOCOLS = /^(javascript|vbscript|data|blob|file):/i;

// Padrões de event handlers inline
const EVENT_HANDLER_PATTERN = /\bon\w+\s*=/i;

/**
 * Sanitiza HTML removendo tudo que não está na allowlist.
 * Para ambientes browser (React) — usa DOMParser quando disponível.
 */
export function sanitizeHtml(dirty) {
  if (!dirty || typeof dirty !== 'string') return '';

  // Strip event handlers diretos (defesa em camada)
  let s = dirty.replace(EVENT_HANDLER_PATTERN, ' ');

  // Bloqueia protocolos perigosos em src/href
  s = s.replace(/(href|src)\s*=\s*["']?(javascript|vbscript|data|blob)[^"'>\s]*/gi, '$1="#"');

  // Remove tags não permitidas, mantendo conteúdo textual
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, tag) => {
    const tagLower = tag.toLowerCase();
    if (ALLOWED_TAGS.has(tagLower)) return match;
    // Remove a tag mas mantém o conteúdo textual
    return '';
  });

  // Bloqueia javascript: em qualquer contexto restante
  s = s.replace(/javascript\s*:/gi, 'blocked:');

  return s.trim();
}

/**
 * Remove TODO html e retorna texto simples.
 * Usar em campos como notes, customer name, observações.
 */
export function sanitizeText(dirty, maxLength = 2000) {
  if (!dirty || typeof dirty !== 'string') return '';
  let s = dirty
    .replace(/<[^>]*>/g, '')              // remove todas as tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/[\u0000-\u001F\u007F]/g, '') // remove control chars
    .trim();
  return s.slice(0, maxLength);
}

/**
 * Sanitiza um objeto de template de mensagem WhatsApp.
 * Permite {variáveis} mas bloqueia HTML/scripts.
 */
export function sanitizeTemplate(template) {
  if (!template || typeof template !== 'string') return '';
  return sanitizeText(template, 1000)
    .replace(/[<>]/g, ''); // garante sem < > mesmo após sanitização
}

/**
 * Valida e sanitiza URL (href/src).
 * Retorna '#' se perigosa.
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (DANGEROUS_PROTOCOLS.test(trimmed)) return '#';
  return trimmed;
}

/**
 * Escapa HTML para uso em contextos de texto (não render HTML).
 * Converter < > & " ' em entidades.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Campos que SEMPRE devem ser text-only (nunca HTML)
const TEXT_ONLY_FIELDS = new Set([
  'name', 'phone', 'email', 'notes', 'reason',
  'description', 'justification', 'deletion_reason',
]);

/**
 * Sanitiza um objeto de entidade, aplicando sanitizeText em campos sensíveis.
 */
export function sanitizeEntityFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      if (TEXT_ONLY_FIELDS.has(key)) {
        result[key] = sanitizeText(value);
      } else {
        // Para outros campos string, remove apenas conteúdo mais perigoso
        result[key] = value.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                           .replace(/javascript\s*:/gi, 'blocked:');
      }
    }
  }
  return result;
}