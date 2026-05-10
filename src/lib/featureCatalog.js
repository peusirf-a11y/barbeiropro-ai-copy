// ============================================================================
// CATÁLOGO CENTRAL DE FEATURES — fonte única da verdade.
// ============================================================================
// Toda funcionalidade comercial controlável por plano/override DEVE estar aqui.
// O Master usa isso para montar a aba "Funcionalidades", os planos usam para
// montar o grid de toggles, e o helper hasFeature() valida contra esta lista.
//
// Adicionar uma feature nova:
//   1. Acrescente o objeto neste array.
//   2. Se a feature controla acesso a uma rota, adicione em ROUTE_FEATURE_MAP
//      no arquivo lib/featureGate.js.
//   3. Use useFeature('key') no componente para gating.
//
// Categorias visam organizar a UI do Master/Planos.
// Badges são apenas dicas visuais (não alteram comportamento).
// ============================================================================

export const FEATURE_CATEGORIES = {
  core:        { label: 'Operação', sort: 1 },
  growth:      { label: 'Crescimento & retenção', sort: 2 },
  finance:     { label: 'Financeiro', sort: 3 },
  team:        { label: 'Equipe & multi-unidade', sort: 4 },
  integration: { label: 'Integrações', sort: 5 },
  experience:  { label: 'Experiência & branding', sort: 6 },
};

// ============================================================================
// MIGRAÇÃO DE KEYS LEGADAS → KEYS NOVAS
// ============================================================================
// Antes existiam: financial, reports, ai_growth, whatsapp_automation, reviews,
// referrals, cash_register, combos, commissions.
// Agora padronizamos: cada módulo tem sua própria key explícita.
// O helper canAccessFeature aceita ambas durante a transição.
// ============================================================================
export const LEGACY_FEATURE_ALIAS = {
  financial: 'financial_dashboard',
  reports: 'advanced_reports',
  ai_growth: 'ai_features',
  whatsapp_automation: 'whatsapp',
  reviews: 'reviews',
  referrals: 'referrals',
  cash_register: 'cashier',
  combos: 'combos',
  commissions: 'commissions',
};

// Resolve uma key (legada ou nova) para a key canônica nova.
export function canonicalFeatureKey(key) {
  if (!key) return key;
  return LEGACY_FEATURE_ALIAS[key] || key;
}

// ============================================================================
// CATÁLOGO
// ============================================================================
export const FEATURE_CATALOG = [
  // — Operação
  { key: 'online_booking',       label: 'Agenda online',           category: 'core',        description: 'Link público de agendamento em /agendar/:slug.', badge: null },
  { key: 'combos',               label: 'Combos',                  category: 'core',        description: 'Pacotes de serviços combinados com preço promocional.', badge: null },
  { key: 'inventory',            label: 'Produtos / Estoque',      category: 'core',        description: 'Controle de produtos, vendas avulsas e estoque.', badge: 'beta' },

  // — Crescimento & retenção
  { key: 'crm_retention',        label: 'CRM & Retenção',          category: 'growth',      description: 'Lifecycle, VIPs, campanhas automáticas e histórico de comunicação.', badge: 'premium' },
  { key: 'ai_features',          label: 'AI Growth',               category: 'growth',      description: 'Sugestões inteligentes de horários, mensagens e análises com IA.', badge: 'premium' },
  { key: 'reviews',              label: 'Avaliações',              category: 'growth',      description: 'Coleta de avaliações pós-atendimento e moderação.', badge: null },
  { key: 'referrals',            label: 'Indique e ganhe',         category: 'growth',      description: 'Programa de indicações entre barbearias / B2B.', badge: null },
  { key: 'loyalty',              label: 'Fidelidade',              category: 'growth',      description: 'Programa de fidelidade por pontos / cartelas.', badge: 'beta' },

  // — Financeiro
  { key: 'cashier',              label: 'Caixa',                   category: 'finance',     description: 'Abertura/fechamento de caixa diário com conferência.', badge: null },
  { key: 'financial_dashboard',  label: 'Financeiro',              category: 'finance',     description: 'Entradas, saídas e saúde financeira da barbearia.', badge: null },
  { key: 'commissions',          label: 'Comissões',               category: 'finance',     description: 'Cálculo automático e pagamento de comissões da equipe.', badge: null },
  { key: 'subscriptions',        label: 'Assinaturas',             category: 'finance',     description: 'Planos mensais para clientes (assinaturas recorrentes).', badge: 'premium' },
  { key: 'advanced_reports',     label: 'Relatórios avançados',    category: 'finance',     description: 'Relatórios profundos, exportação e análises por período.', badge: null },

  // — Equipe & multi-unidade
  { key: 'team_management',      label: 'Equipe',                  category: 'team',        description: 'Convites, papéis (admin, recepção, financeiro, barbeiro).', badge: null },
  { key: 'multi_units',          label: 'Multi-unidades',          category: 'team',        description: 'Várias filiais sob a mesma conta com seletor de unidade.', badge: 'enterprise' },

  // — Integrações
  { key: 'whatsapp',             label: 'WhatsApp automático',     category: 'integration', description: 'Confirmações, lembretes e mensagens de retenção via WhatsApp.', badge: null },
  { key: 'stripe_payments',      label: 'Pagamentos Stripe',       category: 'integration', description: 'Receber pagamentos online via Stripe Connect (Pix e cartão).', badge: 'premium' },
  { key: 'api_access',           label: 'API',                     category: 'integration', description: 'Acesso à API para integrações externas.', badge: 'enterprise' },

  // — Experiência & branding
  { key: 'advanced_dashboard',   label: 'Dashboard avançado',      category: 'experience',  description: 'Métricas profundas, ranking de profissionais e insights.', badge: 'premium' },
  { key: 'custom_branding',      label: 'Marca personalizada',     category: 'experience',  description: 'Logo, cores e domínio próprio nas páginas públicas.', badge: 'enterprise' },
];

// Set para lookups rápidos
const FEATURE_KEYS_SET = new Set(FEATURE_CATALOG.map(f => f.key));

export function isKnownFeature(key) {
  return FEATURE_KEYS_SET.has(canonicalFeatureKey(key));
}

export function getFeatureMeta(key) {
  const k = canonicalFeatureKey(key);
  return FEATURE_CATALOG.find(f => f.key === k) || null;
}

export function getFeaturesByCategory() {
  const grouped = {};
  for (const f of FEATURE_CATALOG) {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  }
  return grouped;
}

export const BADGE_STYLES = {
  beta:       { label: 'Beta',       className: 'bg-amber-50 text-amber-700 border-amber-200' },
  premium:    { label: 'Premium',    className: 'bg-violet-50 text-violet-700 border-violet-200' },
  enterprise: { label: 'Enterprise', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  hidden:     { label: 'Hidden',     className: 'bg-gray-100 text-gray-500 border-gray-200' },
};