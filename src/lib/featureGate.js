// Feature gating por plano da empresa.
// Fonte da verdade: Plan.features (array de strings).
//
// Convenções:
//   - Plano sem features definidas → libera tudo (compat com plano legado).
//   - Feature 'financial' inclui módulos: caixa, financeiro, comissões.
//   - Feature 'reports' inclui /app/relatorios.
//   - Feature 'ai_growth' inclui /app/ai-growth e /app/retencao.
//
// Uso (frontend):
//   const allowed = canAccessFeature(plan, 'financial');
//
// Para checagens server-side: copie a função `canAccessFeature` inline na function
// (backend functions não podem importar arquivos locais).

export const FEATURE_KEYS = {
  FINANCIAL: 'financial',
  REPORTS: 'reports',
  AI_GROWTH: 'ai_growth',
  WHATSAPP: 'whatsapp',
  COMBOS: 'combos',
  REVIEWS: 'reviews',
  TEAM: 'team',
};

// Mapa rota → feature requerida. Usado em PrivateRoute para gating.
export const ROUTE_FEATURE_MAP = {
  '/app/financeiro': FEATURE_KEYS.FINANCIAL,
  '/app/caixa': FEATURE_KEYS.FINANCIAL,
  '/app/comissoes': FEATURE_KEYS.FINANCIAL,
  '/app/relatorios': FEATURE_KEYS.REPORTS,
  '/app/ai-growth': FEATURE_KEYS.AI_GROWTH,
  '/app/retencao': FEATURE_KEYS.AI_GROWTH,
};

/**
 * Retorna true se o plano libera a feature.
 * - plan = null/undefined → permite (sem plano cadastrado, evita falso negativo no trial).
 * - plan.features ausente ou vazio → permite (compat).
 */
export function canAccessFeature(plan, feature) {
  if (!plan) return true;
  if (!Array.isArray(plan.features) || plan.features.length === 0) return true;
  return plan.features.includes(feature);
}

/**
 * Helper para PrivateRoute: dado o pathname e o plano, decide se libera.
 */
export function isRouteAllowedByPlan(pathname, plan) {
  const feature = ROUTE_FEATURE_MAP[pathname];
  if (!feature) return true;
  return canAccessFeature(plan, feature);
}