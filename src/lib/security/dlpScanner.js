/**
 * dlpScanner.js — Data Loss Prevention (DLP).
 *
 * Detecta e sanitiza dados sensíveis em logs, exports e erros.
 * Previne vazamento de: CPF, cartões, tokens, secrets, emails em massa.
 *
 * USO: chamar antes de qualquer console.log/error em functions críticas,
 * e antes de persistir metadata em SecurityEvent/AuditLog.
 */

// ── PADRÕES SENSÍVEIS ─────────────────────────────────────────────────────────

const SENSITIVE_PATTERNS = [
  // Cartão de crédito (qualquer formato)
  {
    name: 'credit_card',
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    replacement: '[CARTÃO REDACTED]',
    severity: 'critical',
  },
  // CPF (com ou sem pontuação)
  {
    name: 'cpf',
    pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
    replacement: '[CPF REDACTED]',
    severity: 'high',
  },
  // Stripe Secret Key
  {
    name: 'stripe_secret',
    pattern: /sk_(live|test)_[A-Za-z0-9]{20,}/g,
    replacement: '[STRIPE_SK REDACTED]',
    severity: 'critical',
  },
  // Stripe Publishable Key
  {
    name: 'stripe_pk',
    pattern: /pk_(live|test)_[A-Za-z0-9]{20,}/g,
    replacement: '[STRIPE_PK REDACTED]',
    severity: 'medium',
  },
  // JWT tokens
  {
    name: 'jwt',
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replacement: '[JWT REDACTED]',
    severity: 'critical',
  },
  // Bearer tokens genéricos
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[A-Za-z0-9_\-\.]+/gi,
    replacement: 'Bearer [TOKEN REDACTED]',
    severity: 'critical',
  },
  // Hashes hex longos (tokens de sessão, etc.)
  {
    name: 'hex_token',
    pattern: /\b[a-f0-9]{64}\b/gi,
    replacement: '[HEX_TOKEN REDACTED]',
    severity: 'high',
  },
  // Authorization header
  {
    name: 'auth_header',
    pattern: /authorization:\s*[^\n\r,}]{8,}/gi,
    replacement: 'authorization: [REDACTED]',
    severity: 'critical',
  },
  // Chaves AWS
  {
    name: 'aws_key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    replacement: '[AWS_KEY REDACTED]',
    severity: 'critical',
  },
  // Password em JSON
  {
    name: 'password_field',
    pattern: /"password"\s*:\s*"[^"]{3,}"/gi,
    replacement: '"password": "[REDACTED]"',
    severity: 'critical',
  },
  // Hash de senha PBKDF2
  {
    name: 'password_hash',
    pattern: /\b[a-f0-9]{32}:[a-f0-9]{64}\b/g,
    replacement: '[HASH REDACTED]',
    severity: 'critical',
  },
];

/**
 * Escaneia e sanitiza uma string para remover dados sensíveis.
 * @param {string} input - String a sanitizar
 * @returns {{ sanitized: string, findings: string[] }}
 */
export function scanAndRedact(input) {
  if (!input || typeof input !== 'string') return { sanitized: input, findings: [] };

  let sanitized = input;
  const findings = [];

  for (const { name, pattern, replacement, severity } of SENSITIVE_PATTERNS) {
    const matches = sanitized.match(new RegExp(pattern.source, pattern.flags));
    if (matches && matches.length > 0) {
      findings.push(`${name}(${severity}):${matches.length}`);
      sanitized = sanitized.replace(new RegExp(pattern.source, pattern.flags), replacement);
    }
  }

  return { sanitized, findings };
}

/**
 * Sanitiza recursivamente um objeto (remove campos sensíveis e redacta valores).
 * @param {any} obj - Objeto a sanitizar
 * @param {number} depth - Profundidade máxima de recursão
 * @returns {any} Objeto sanitizado
 */
export function sanitizeObject(obj, depth = 5) {
  if (depth <= 0 || obj === null || obj === undefined) return obj;

  // Campos que NUNCA devem aparecer em logs
  const BLOCKED_KEYS = [
    'password', 'password_hash', 'auth_token', 'reset_token',
    'stripe_secret_key', 'api_key', 'secret', 'private_key',
    'token_version', 'pin', 'cvv', 'card_number',
  ];

  if (typeof obj === 'string') {
    return scanAndRedact(obj).sanitized;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth - 1));
  }

  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      if (BLOCKED_KEYS.some(blocked => keyLower.includes(blocked))) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = sanitizeObject(value, depth - 1);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Verifica se um export LGPD contém dados que não deveriam ser exportados.
 * @param {object} exportData
 * @returns {{ clean: boolean, issues: string[] }}
 */
export function validateLGPDExport(exportData) {
  const issues = [];
  const str = JSON.stringify(exportData);

  const { findings } = scanAndRedact(str);
  if (findings.length > 0) {
    issues.push(...findings.map(f => `Dado sensível detectado: ${f}`));
  }

  // Verificar se campos de segurança foram incluídos erroneamente
  const dangerousFields = ['password_hash', 'auth_token', 'reset_token', 'stripe_secret'];
  dangerousFields.forEach(field => {
    if (str.includes(field) && !str.includes(`"${field}": "[REDACTED]"`)) {
      issues.push(`Campo proibido no export: ${field}`);
    }
  });

  return { clean: issues.length === 0, issues };
}

/**
 * Wrapper seguro para console.error em Deno functions.
 * Remove dados sensíveis antes de logar.
 * @param {string} prefix - Prefixo da mensagem
 * @param {any} data - Dados a logar
 */
export function safeLog(prefix, data) {
  if (typeof data === 'string') {
    console.log(prefix, scanAndRedact(data).sanitized);
  } else {
    console.log(prefix, sanitizeObject(data));
  }
}