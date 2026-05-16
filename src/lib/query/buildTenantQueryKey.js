/**
 * buildTenantQueryKey.js — QueryKeys isoladas por tenant para React Query.
 *
 * Garante que o cache nunca vaza entre tenants durante:
 * - Impersonação de múltiplos tenants
 * - Login/logout
 * - Troca de unidade ativa
 *
 * FORMATO: [company_id, impersonation_id|null, user_id|null, entity, ...filters]
 */

/**
 * Constrói uma QueryKey isolada por tenant.
 *
 * @param {object} params
 * @param {string} params.entity - Nome da entidade ou query
 * @param {string} [params.companyId] - ID do tenant
 * @param {string} [params.impersonationId] - Token de impersonação ativo (ou null)
 * @param {string} [params.userId] - ID do usuário autenticado
 * @param {object|string[]} [params.filters] - Filtros adicionais
 * @returns {Array} QueryKey segura
 */
export function buildTenantQueryKey({
  entity,
  companyId = null,
  impersonationId = null,
  userId = null,
  filters = null,
}) {
  const key = [
    companyId || '__no_tenant__',
    impersonationId || '__no_impersonation__',
    userId || '__no_user__',
    entity,
  ];

  if (filters !== null && filters !== undefined) {
    key.push(filters);
  }

  return key;
}

/**
 * Hook helper para construir QueryKey com contexto de impersonação.
 * Usar nos hooks de dados do app.
 *
 * @param {string} entity
 * @param {object} context - { companyId, impersonationToken, userId }
 * @param {any} [filters]
 * @returns {Array}
 */
export function useTenantQueryKey(entity, context = {}, filters = null) {
  const { companyId, impersonationToken, userId } = context;
  return buildTenantQueryKey({
    entity,
    companyId,
    impersonationId: impersonationToken || null,
    userId,
    filters,
  });
}

/**
 * Lista de entidades que requerem isolamento estrito por tenant.
 * QueryKeys para estas entidades DEVEM incluir company_id.
 */
export const TENANT_ISOLATED_ENTITIES = new Set([
  'customers', 'appointments', 'financial_entries', 'team_members',
  'professionals', 'services', 'cash_registers', 'commissions',
  'subscriptions', 'reviews', 'whatsapp_messages', 'audit_logs',
  'blocked_times', 'units', 'plans', 'customer_plans',
]);

/**
 * Verifica se uma queryKey inclui tenant isolation.
 * Usar em desenvolvimento para detectar queryKeys inseguras.
 *
 * @param {Array} queryKey
 * @param {string} entity
 * @returns {boolean}
 */
export function isTenantIsolated(queryKey, entity) {
  if (!TENANT_ISOLATED_ENTITIES.has(entity)) return true; // entidade pública
  return Array.isArray(queryKey) && queryKey[0] !== '__no_tenant__';
}