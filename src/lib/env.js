// lib/env.js — F2 do Foundation Sprint.
//
// Centraliza leitura de env vars do FRONTEND (Vite).
// Backend (Deno) tem cópia inline própria — Base44 functions não permitem
// local imports, então o mesmo padrão é replicado em `functions/_lib/envInline.md`
// como template para copy-paste em cada function.
//
// Por que existe:
//  - Antes: `import.meta.env.VITE_*` espalhado, sem validação, falha silenciosa.
//  - Agora: schema declarativo, fail-fast, defaults explícitos, fácil de auditar.
//
// Uso:
//   import { getEnv } from '@/lib/env';
//   const appId = getEnv('VITE_BASE44_APP_ID');
//
// ESLint rule (F7) bloqueia `import.meta.env.VITE_*` direto fora deste arquivo.

const SCHEMA = {
  VITE_BASE44_APP_ID:            { required: false },
  VITE_BASE44_FUNCTIONS_VERSION: { required: false },
  VITE_BASE44_APP_BASE_URL:      { required: false },
};

// Cache simples — evita recomputar a cada chamada.
const _cache = new Map();

export function getEnv(name) {
  if (_cache.has(name)) return _cache.get(name);

  const spec = SCHEMA[name];
  if (!spec) {
    throw new Error(`[env] Variable not in schema: ${name}. Add it to lib/env.js SCHEMA.`);
  }

  // Em SSR/teste, import.meta.env pode não existir.
  const source = (typeof import.meta !== 'undefined' && import.meta.env) || {};
  const raw = source[name];

  let value;
  if (raw == null || raw === '') {
    if (spec.required) {
      throw new Error(`[env] Missing required env: ${name}`);
    }
    value = spec.default ?? null;
  } else {
    if (spec.enum && !spec.enum.includes(raw)) {
      throw new Error(`[env] Invalid ${name}: expected ${spec.enum.join('|')}, got ${raw}`);
    }
    if (spec.validate && !spec.validate(raw)) {
      throw new Error(`[env] Invalid ${name}: failed validation`);
    }
    value = spec.parse ? spec.parse(raw) : raw;
  }

  _cache.set(name, value);
  return value;
}

// Helper opcional: lê várias de uma vez.
export function getEnvBatch(names) {
  return Object.fromEntries(names.map(n => [n, getEnv(n)]));
}

// Reset do cache — útil em testes. NÃO usar em produção.
export function __resetEnvCache() {
  _cache.clear();
}