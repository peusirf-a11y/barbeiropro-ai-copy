// ============================================================================
// E2E TEST TENANT FACTORY — constantes determinísticas compartilhadas
// ============================================================================
//
// IMPORTANTE: Backend functions no Base44 NÃO importam arquivos locais
// (sandbox Deno isolado). Por isso este arquivo expõe APENAS CONSTANTES
// determinísticas + helpers utilizáveis no frontend (Playwright/Cypress).
//
// A lógica real de criação/reset/delete vive INLINE em cada function:
//   - functions/seedTestTenant.js
//   - functions/resetTestTenant.js
//   - functions/deleteTestTenant.js
//
// Qualquer mudança nas constantes abaixo deve ser refletida nas 3 functions
// (mantemos cópia literal lá para manter as functions auto-contidas).
//
// REGRAS:
//   - Todos os nomes carregam prefixo [E2E] para isolamento
//   - Slug fixo: e2e-barbershop
//   - Owner email: e2e@teste.com (admin login Base44)
//   - Tudo idempotente: rodar 100x = mesmo resultado
// ============================================================================

export const E2E_PREFIX = '[E2E]';

export const E2E_TENANT = Object.freeze({
  slug: 'e2e-barbershop',
  name: '[E2E] Barbearia Teste',
  owner_email: 'e2e@teste.com',
  owner_name: '[E2E] Admin Teste',
  phone: '11999990000',
  whatsapp: '11999990000',
  primary_color: '#2563EB',
  secondary_color: '#F8F7F3',
});

// Senha fixa usada APENAS para customers (área pública). Admin login Base44
// é via plataforma — não usa essa senha.
export const E2E_CUSTOMER_PASSWORD = 'E2E#StrongPassword2026';

export const E2E_PLAN = Object.freeze({
  name: '[E2E] Plano Enterprise Teste',
  price_monthly: 397,
  features: [
    'crm',
    'crm_retention',
    'appointments',
    'financial_dashboard',
    'subscriptions',
    'dashboard',
    'cashier',
    'analytics',
    'advanced_reports',
    'ai_growth',
    'reviews',
    'team_management',
    'commissions',
    'combos',
  ],
});

export const E2E_CUSTOMERS = Object.freeze([
  { name: '[E2E] Ana Silva',         email: 'ana.silva.e2e@teste.com',         phone: '11900001001' },
  { name: '[E2E] Ana Paula',         email: 'ana.paula.e2e@teste.com',         phone: '11900001002' },
  { name: '[E2E] João Pedro',        email: 'joao.pedro.e2e@teste.com',        phone: '11900001003' },
  { name: '[E2E] Carlos Henrique',   email: 'carlos.henrique.e2e@teste.com',   phone: '11900001004' },
  { name: '[E2E] Fernanda Lima',     email: 'fernanda.lima.e2e@teste.com',     phone: '11900001005' },
]);

export const E2E_SERVICES = Object.freeze([
  { name: '[E2E] Corte',          price: 50, duration_minutes: 30 },
  { name: '[E2E] Barba',          price: 35, duration_minutes: 20 },
  { name: '[E2E] Corte + Barba',  price: 75, duration_minutes: 50 },
]);

export const E2E_PROFESSIONAL = Object.freeze({
  name: '[E2E] Barbeiro Teste',
  email: 'barbeiro.e2e@teste.com',
  phone: '11900002000',
  commission_percentage: 50,
});

// ============================================================================
// FRONTEND HELPERS (Playwright/Cypress)
// ============================================================================

/**
 * Reseta + popula o tenant E2E em uma única chamada.
 * Usado em test.beforeEach() / cy.before() para garantir baseline.
 *
 * @param {object} base44 - cliente base44 já inicializado
 * @returns {Promise<{company_id: string, owner_email: string, summary: object}>}
 */
export async function resetE2ETenant(base44) {
  const res = await base44.functions.invoke('seedTestTenant', {
    slug: E2E_TENANT.slug,
    reset: true,
  });
  return res?.data;
}

/**
 * Apenas garante existência (não reseta dados). Use em smoke tests.
 */
export async function ensureE2ETenant(base44) {
  const res = await base44.functions.invoke('seedTestTenant', {
    slug: E2E_TENANT.slug,
    reset: false,
  });
  return res?.data;
}

/**
 * Remove TUDO do tenant E2E. Use em afterAll() de suites isoladas.
 */
export async function deleteE2ETenant(base44) {
  const res = await base44.functions.invoke('deleteTestTenant', {
    slug: E2E_TENANT.slug,
  });
  return res?.data;
}