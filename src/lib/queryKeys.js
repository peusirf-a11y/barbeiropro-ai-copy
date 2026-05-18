/**
 * queryKeys.js — Padrão de query keys tenant-aware para React Query.
 *
 * REGRA DE OURO:
 *   Toda query que retorna dados de UM tenant específico DEVE incluir o
 *   companyId (e quando aplicável, o usuário ou impersonation token) na key.
 *
 * Sem isso, ao trocar de tenant (ex: super-admin saindo de impersonação),
 * o React Query pode servir dados do tenant anterior do cache.
 *
 * Hoje o cache é limpo via `queryClient.clear()` em:
 *  - Login/Logout (este arquivo expõe `flushTenantCache`)
 *  - Início de impersonação (ImpersonationContext)
 *  - Fim de impersonação (ImpersonationContext)
 *
 * Helpers abaixo são opcionais — código existente continua válido.
 * Use-os em queries NOVAS para garantir consistência.
 */

/**
 * Builder genérico de query key tenant-aware.
 *
 *   tenantKey('appointments', companyId, { date: '2026-05-18' })
 *   → ['appointments', companyId, { date: '2026-05-18' }]
 *
 * Quando companyId é null/undefined, retorna a key sem o slot do tenant
 * (útil para queries globais como `master`, `plans-catalog`).
 */
export function tenantKey(domain, companyId, ...extras) {
  const base = companyId ? [domain, companyId] : [domain];
  return extras.length ? [...base, ...extras] : base;
}

/**
 * Builder de key que inclui usuário (para preferências por usuário).
 *
 *   userScopedKey('notifications', companyId, userId)
 *   → ['notifications', companyId, userId]
 */
export function userScopedKey(domain, companyId, userId, ...extras) {
  return [domain, companyId || null, userId || null, ...extras];
}

/**
 * Helper que invalida todas as queries de um tenant.
 * Use quando alguma ação muda dados que podem aparecer em várias views.
 *
 *   invalidateTenant(queryClient, companyId)
 */
export function invalidateTenant(queryClient, companyId) {
  if (!queryClient || !companyId) return;
  queryClient.invalidateQueries({
    predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes(companyId),
  });
}

/**
 * Limpa TODO o cache do React Query. Use em:
 *  - Logout (defesa em profundidade — o reload já mata o cache)
 *  - Início/fim de impersonação (já é feito automaticamente em ImpersonationContext)
 *
 *   flushTenantCache(queryClient)
 */
export function flushTenantCache(queryClient) {
  if (!queryClient) return;
  try {
    queryClient.clear();
  } catch {
    /* noop */
  }
}