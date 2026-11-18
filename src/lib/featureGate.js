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

// ============================================================================
// PLANO CLÁSSICO — ALLOW-LIST ESTRITA (7 recursos contratados):
// 1. 1 barbeiro cadastrado (agenda dedicada, limites barbers=1)
// 2. Agendamentos online ilimitados (online_booking)
// 3. Link público /agendar/:slug (online_booking)
// 4. Recebimento via PIX e cartões integrado ao Asaas (online_payments, pix)
// 5. Painel financeiro com fechamento de caixa (financial_dashboard, cashier)
// 6. Lembretes automáticos no WhatsApp (whatsapp)
// 7. Cadastro e histórico de clientes — CRM Básico (incluso no core sem VIP/IA/Retenção)
// ============================================================================
export const CLASSICO_ALLOWED_FEATURES = [
  'online_booking',
  'online_payments',
  'pix',
  'cashier',
  'financial_dashboard',
  'whatsapp',
];

export const CLASSICO_LIMITS = {
  barbers: 1,
  professionals: 1,
  units: 1,
  appointments_month: 0, // 0 = agendamentos online ilimitados
  storage_mb: 500,
};

// ============================================================================
// PLANO MASTER — LIBERAÇÃO COMPLETA DOS RECURSOS AVANÇADOS (8 pilares):
// 1. Barbeiros e profissionais ilimitados (barbers: 0, team_management)
// 2. Agendamentos online ilimitados (online_booking, appointments_month: 0)
// 3. CRM de retenção inteligente / IA anti-churn (crm_retention, lifecycle_automation, ai_growth, smart_insights)
// 4. Clientes VIP e clubes de assinatura recorrente (vip_customers, subscriptions, online_payments, pix)
// 5. Cálculo e conciliação automática de comissões (commissions)
// 6. Automação de mensagens e pós-atendimento (whatsapp, reviews)
// 7. Relatórios avançados de faturamento e ticket médio (financial_dashboard, cashier, advanced_reports, advanced_dashboard)
// 8. Suporte prioritário humanizado no WhatsApp (priority_support)
// ============================================================================
export const MASTER_ALLOWED_FEATURES = [
  'online_booking',
  'online_payments',
  'pix',
  'cashier',
  'financial_dashboard',
  'whatsapp',
  'team_management',
  'crm_retention',
  'lifecycle_automation',
  'vip_customers',
  'subscriptions',
  'commissions',
  'reviews',
  'advanced_reports',
  'advanced_dashboard',
  'ai_growth',
  'smart_insights',
  'combos',
  'referral_program',
  'priority_support',
];

export const MASTER_LIMITS = {
  barbers: 0, // 0 = barbeiros e profissionais ilimitados
  professionals: 0,
  units: 1,
  appointments_month: 0, // 0 = agendamentos online ilimitados
  storage_mb: 5120,
};

const CLASSIC_SET = new Set(CLASSICO_ALLOWED_FEATURES);
const MASTER_SET = new Set(MASTER_ALLOWED_FEATURES);

function normalizePlanText(val) {
  return String(val || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function resolvePlanKey(plan, company) {
  const candidates = [
    plan?.slug,
    plan?.id,
    plan?.name,
    company?.plan_id,
    company?.plan_name,
  ];
  for (const raw of candidates) {
    const n = normalizePlanText(raw);
    if (!n) continue;
    if (n.includes('exclusiv') || n.includes('matriz') || n.includes('franquia') || n.includes('enterprise')) {
      return 'exclusivo';
    }
    if (n.includes('classic') || n.includes('starter') || n.includes('basico')) {
      return 'classico';
    }
    if (n.includes('master') || n === 'pro' || n.includes('plan-pro')) {
      return 'master';
    }
  }
  return null;
}

export function isClassicoPlan(plan, company) {
  return resolvePlanKey(plan, company) === 'classico';
}

export function isMasterPlan(plan, company) {
  return resolvePlanKey(plan, company) === 'master';
}

export function getPlanLimits(plan, company) {
  const key = resolvePlanKey(plan, company);
  if (key === 'classico') {
    return { ...CLASSICO_LIMITS };
  }
  if (key === 'master') {
    return { ...MASTER_LIMITS };
  }
  const rawLimits = plan?.limits || {};
  return {
    barbers: Number(rawLimits.barbers ?? rawLimits.professionals ?? 0), // 0 = ilimitado
    professionals: Number(rawLimits.professionals ?? rawLimits.barbers ?? 0),
    units: Number(rawLimits.units ?? 0),
    appointments_month: Number(rawLimits.appointments_month ?? 0),
    storage_mb: Number(rawLimits.storage_mb ?? 10240),
  };
}

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

  // 3. Planos com especificação estrita
  const planKey = resolvePlanKey(plan, company);
  if (planKey === 'classico') {
    return CLASSIC_SET.has(key);
  }
  if (planKey === 'master') {
    if (MASTER_SET.has(key)) return true;
    if (Array.isArray(plan?.features) && plan.features.length > 0) {
      return plan.features.map(canonicalFeatureKey).includes(key);
    }
    return false;
  }

  // 4. Plan.features
  if (!plan) {
    return true; // sem plano cadastrado (trial) ou Exclusivo → libera
  }
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
// Mapa rota → feature requerida. Usado em PrivateRoute e Middleware para gating.
// ============================================================================
export const ROUTE_FEATURE_MAP = {
  '/app/financeiro':              'financial_dashboard',
  '/app/caixa/auditoria':         'advanced_reports',
  '/app/caixa/relatorios':        'advanced_reports',
  '/app/caixa':                   'cashier',
  '/app/comissoes':               'commissions',
  '/app/relatorios':              'advanced_reports',
  '/app/ai-growth':               'ai_growth',
  '/app/crm':                     'crm_retention',
  '/app/retencao':                'crm_retention',
  '/app/automacoes':              'whatsapp',
  '/app/whatsapp':                'whatsapp',
  '/app/campanhas':               'whatsapp',
  '/app/avaliacoes':              'reviews',
  '/app/indicacoes':              'referral_program',
  '/app/indique-ganhe':           'referral_program',
  '/app/combos':                  'combos',
  '/app/planos':                  'subscriptions',
  '/app/equipe':                  'team_management',
  '/app/configuracoes/unidades':  'multi_units',
  '/app/configuracoes/pagamentos':'online_payments',
};

// Retorna a feature requerida pela rota (ou null se rota não tem gating).
export function featureForRoute(pathname) {
  if (!pathname) return null;
  // Match exato primeiro (garante rotas mais específicas como /app/caixa/relatorios antes de /app/caixa)
  if (ROUTE_FEATURE_MAP[pathname]) return ROUTE_FEATURE_MAP[pathname];
  const sortedPrefixes = Object.entries(ROUTE_FEATURE_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, feature] of sortedPrefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return feature;
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
  'ai-growth':  'ai_growth',
  crm:          'crm_retention',
  automacoes:   'whatsapp',
  avaliacoes:   'reviews',
  indicacoes:   'referral_program',
  combos:       'combos',
  planos:       'subscriptions',
  equipe:       'team_management',
};

// Backwards-compat: chaves antigas exportadas para quem ainda importa
export const FEATURE_KEYS = {
  FINANCIAL: 'financial_dashboard',
  REPORTS: 'advanced_reports',
  AI_GROWTH: 'ai_growth',
  WHATSAPP: 'whatsapp',
  COMBOS: 'combos',
  REVIEWS: 'reviews',
  TEAM: 'team_management',
};