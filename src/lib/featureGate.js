// ============================================================================
// FEATURE GATING — fonte única de verdade para liberação de funcionalidades.
// ============================================================================
// REGRA DE PRIORIDADE (do mais alto pro mais baixo):
//   1. Company.feature_overrides.disabled  → SEMPRE bloqueia
//   2. Company.feature_overrides.enabled   → SEMPRE libera
//   3. Plan.features                       → libera se a key estiver na lista
//   4. Default: bloqueia (a menos que o plano não tenha features definidas
//      ainda, caso compat com base legada — aí libera)
//
// USO (frontend):
//   import { hasFeature } from '@/lib/featureGate';
//   if (hasFeature(plan, company, 'crm_retention')) { ... }
//
// USO (hook):
//   import { useFeature } from '@/hooks/useFeatures';
//   const allowed = useFeature('crm_retention');
//
// USO (rotas):
//   isRouteAllowedByPlan(pathname, plan, company)
//
// USO (server-side):
//   Backend functions não importam arquivos locais, então copie a função
//   `hasFeatureSnapshot` inline na function quando precisar gating no backend.
// ============================================================================

import { canonicalFeatureKey } from '@/lib/featureCatalog';

/**
 * Decide se uma empresa tem acesso a uma feature.
 * @param {object|null} plan      - entidade Plan (pode ser null em trial sem plano)
 * @param {object|null} company   - entidade Company (pode ser null em rotas públicas)
 * @param {string} featureKey     - key da feature (aceita legacy via canonicalFeatureKey)
 * @returns {boolean}
 */
export function hasFeature(plan, company, featureKey) {
  if (!featureKey) return true;
  const key = canonicalFeatureKey(featureKey);

  // 1. Override company.disabled → sempre bloqueia
  const disabled = company?.feature_overrides?.disabled || [];
  if (Array.isArray(disabled) && disabled.map(canonicalFeatureKey).includes(key)) {
    return false;
  }

  // 2. Override company.enabled → sempre libera
  const enabled = company?.feature_overrides?.enabled || [];
  if (Array.isArray(enabled) && enabled.map(canonicalFeatureKey).includes(key)) {
    return true;
  }

  // 3. Plan.features
  if (!plan) return true; // sem plano cadastrado (trial) → libera para não barrar
  if (!Array.isArray(plan.features) || plan.features.length === 0) return true; // compat plano legado
  return plan.features.map(canonicalFeatureKey).includes(key);
}

// ============================================================================
// Backwards-compat: API antiga `canAccessFeature(plan, key)` ainda em uso
// em alguns lugares. Mantida.
// ============================================================================
export function canAccessFeature(plan, feature) {
  return hasFeature(plan, null, feature);
}

// ============================================================================
// Mapa rota → feature requerida. Usado em PrivateRoute para gating de rotas.
// ============================================================================
export const ROUTE_FEATURE_MAP = {
  '/app/financeiro':              'financial_dashboard',
  '/app/caixa':                   'cashier',
  '/app/comissoes':                'commissions',
  '/app/relatorios':               'advanced_reports',
  '/app/ai-growth':                'ai_features',
  '/app/crm':                      'crm_retention',
  '/app/retencao':                 'crm_retention',
  '/app/avaliacoes':               'reviews',
  '/app/indicacoes':               'referrals',
  '/app/combos':                   'combos',
  '/app/planos':                   'subscriptions',
  '/app/equipe':                   'team_management',
  '/app/configuracoes/unidades':   'multi_units',
  '/app/configuracoes/pagamentos': 'stripe_payments',
};

// Retorna a feature requerida pela rota (ou null se rota não tem gating).
export function featureForRoute(pathname) {
  if (!pathname) return null;
  // Match exato, depois prefix
  if (ROUTE_FEATURE_MAP[pathname]) return ROUTE_FEATURE_MAP[pathname];
  for (const [prefix, feature] of Object.entries(ROUTE_FEATURE_MAP)) {
    if (pathname.startsWith(prefix + '/')) return feature;
  }
  return null;
}

// Helper para PrivateRoute.
export function isRouteAllowedByPlan(pathname, plan, company = null) {
  const feature = featureForRoute(pathname);
  if (!feature) return true;
  return hasFeature(plan, company, feature);
}

// Mapa: chave do menu (key em rolePermissions) → feature requerida.
// Usado no AppLayout para esconder itens do menu quando a feature não está liberada.
export const NAV_KEY_FEATURE_MAP = {
  caixa:        'cashier',
  financeiro:   'financial_dashboard',
  comissoes:    'commissions',
  relatorios:   'advanced_reports',
  'ai-growth':  'ai_features',
  crm:          'crm_retention',
  avaliacoes:   'reviews',
  indicacoes:   'referrals',
  combos:       'combos',
  planos:       'subscriptions',
  equipe:       'team_management',
};

// Backwards-compat: chaves antigas exportadas para quem ainda importa
export const FEATURE_KEYS = {
  FINANCIAL: 'financial_dashboard',
  REPORTS: 'advanced_reports',
  AI_GROWTH: 'ai_features',
  WHATSAPP: 'whatsapp',
  COMBOS: 'combos',
  REVIEWS: 'reviews',
  TEAM: 'team_management',
};