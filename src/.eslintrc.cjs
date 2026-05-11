// .eslintrc.cjs — F7 Foundation Sprint.
//
// IMPORTANTE: Base44 não roda ESLint automaticamente no deploy.
// Este arquivo serve para:
//   1. IDE local do builder (VS Code com ESLint extension).
//   2. CI próprio se o builder configurar (GitHub Actions etc.).
//   3. Documentação executável das regras de arquitetura.
//
// Mesmo sem CI, é a fonte da verdade das convenções de código.

module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  rules: {
    // ── F2: Banir leitura direta de env vars ────────────────────────────
    'no-restricted-properties': ['error',
      {
        object: 'process',
        property: 'env',
        message: 'Use getEnv() de @/lib/env (frontend) ou o bloco inline em backend functions.',
      },
    ],
    'no-restricted-globals': ['error',
      {
        name: 'Deno',
        message: 'Não use Deno.* no frontend. No backend, use o helper getEnv inline.',
      },
    ],

    // ── F4: Banir new Date(string) — força parseDate ────────────────────
    // Comentado: ativar APENAS depois da migração dos call sites.
    // 'no-restricted-syntax': ['warn', {
    //   selector: "NewExpression[callee.name='Date'][arguments.length=1][arguments.0.type='Literal']",
    //   message: 'Use parseDate() de @/lib/dates em vez de new Date(string).',
    // }],

    // ── Limpeza geral ────────────────────────────────────────────────────
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off', // logs explícitos são bem-vindos
  },
  overrides: [
    // Helpers de env têm permissão exclusiva de tocar nas env vars.
    {
      files: ['src/lib/env.js', 'lib/env.js', 'functions/_envInline.md'],
      rules: {
        'no-restricted-properties': 'off',
        'no-restricted-globals': 'off',
      },
    },
    // Backend functions (Deno) precisam de Deno.* — só permitido no bloco inline.
    // O guardrail real é cultural: revisor checa se o uso está dentro do bloco _ENV_SCHEMA.
    {
      files: ['functions/**/*.js'],
      rules: {
        'no-restricted-globals': 'off',
      },
    },
    // Testes podem tocar em internals.
    {
      files: ['tests/**/*.js'],
      rules: {
        'no-restricted-properties': 'off',
      },
    },
  ],
};