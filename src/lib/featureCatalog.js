// ============================================================================
// CATÁLOGO CENTRAL DE FEATURES — fonte única da verdade (FEATURE_REGISTRY).
// ============================================================================
// Toda funcionalidade comercial controlável por plano/override DEVE estar aqui.
// O Master usa isso para montar a aba "Funcionalidades", os planos usam para
// montar o grid de toggles, e o helper hasFeature() valida contra esta lista.
//
// IMPORTANTE: features ainda NÃO implementadas TAMBÉM ficam registradas aqui
// (com hidden=true ou badge='soon') para:
//   - arquitetura escalável (sem migrations futuras)
//   - facilitar upsell e roadmap
//   - permitir liberar progressivamente
//
// Schema de cada feature:
//   key             string  — identificador estável (snake_case)
//   name            string  — nome humano para exibição
//   description     string  — texto curto explicando a feature
//   category        string  — categoria do agrupamento (ver FEATURE_CATEGORIES)
//   badge           string? — beta | premium | enterprise | soon | null
//   default_enabled boolean — se entra ON por padrão em planos novos
//   beta            boolean — feature em beta (visível, mas sinalizada)
//   enterprise_only boolean — só liberada em planos enterprise
//   hidden          boolean — esconder da UI (Master/planos) até estar pronta
//   icon            string? — nome de ícone lucide-react (opcional)
//
// Adicionar uma feature nova:
//   1. Acrescente o objeto neste array.
//   2. Se controla acesso a uma rota, adicione em ROUTE_FEATURE_MAP (featureGate.js).
//   3. Use useFeature('key') ou <FeatureGate feature="key"> no componente.
// ============================================================================

export const FEATURE_CATEGORIES = {
  agenda:      { label: 'Agenda',                  sort: 1 },
  crm:         { label: 'CRM & Retenção',          sort: 2 },
  payments:    { label: 'Pagamentos',              sort: 3 },
  finance:     { label: 'Financeiro',              sort: 4 },
  operations:  { label: 'Operação',                sort: 5 },
  marketing:   { label: 'Marketing',               sort: 6 },
  ai:          { label: 'Inteligência Artificial', sort: 7 },
  admin:       { label: 'Admin & Plataforma',      sort: 8 },
  experience:  { label: 'Experiência & Branding',  sort: 9 },
};

// ============================================================================
// MIGRAÇÃO DE KEYS LEGADAS → KEYS NOVAS
// ============================================================================
export const LEGACY_FEATURE_ALIAS = {
  financial: 'financial_dashboard',
  reports: 'advanced_reports',
  ai_growth: 'ai_features',
  whatsapp_automation: 'whatsapp',
  reviews: 'reviews',
  referrals: 'referral_program',
  cash_register: 'cashier',
  combos: 'combos',
  commissions: 'commissions',
  ai_features: 'ai_growth',
};

export function canonicalFeatureKey(key) {
  if (!key) return key;
  return LEGACY_FEATURE_ALIAS[key] || key;
}

// ============================================================================
// FEATURE_REGISTRY — registro central, expansível para escala enterprise
// ============================================================================
// Defaults: default_enabled=false, beta=false, enterprise_only=false, hidden=false
// ============================================================================
const def = (overrides) => ({
  badge: null,
  default_enabled: false,
  beta: false,
  enterprise_only: false,
  hidden: false,
  icon: null,
  ...overrides,
});

export const FEATURE_REGISTRY = [
  // ── AGENDA ────────────────────────────────────────────────────────────────
  def({
    key: 'online_booking',
    name: 'Agenda online',
    category: 'agenda',
    description: 'Link público de agendamento em /agendar/:slug.',
    default_enabled: true,
    icon: 'Calendar',
  }),
  def({
    key: 'recurring_appointments',
    name: 'Agendamentos recorrentes',
    category: 'agenda',
    description: 'Cliente agenda um horário fixo semanal/quinzenal automaticamente.',
    badge: 'soon',
    hidden: true,
    icon: 'Repeat',
  }),
  def({
    key: 'waitlist',
    name: 'Lista de espera',
    category: 'agenda',
    description: 'Clientes entram em fila quando a agenda está cheia e são avisados em vagas.',
    badge: 'soon',
    hidden: true,
    icon: 'Clock',
  }),
  def({
    key: 'smart_reminders',
    name: 'Lembretes inteligentes',
    category: 'agenda',
    description: 'IA escolhe melhor horário e canal para lembrar cada cliente.',
    badge: 'premium',
    hidden: true,
    icon: 'Bell',
  }),

  // ── CRM & RETENÇÃO ────────────────────────────────────────────────────────
  def({
    key: 'crm_retention',
    name: 'CRM & Retenção',
    category: 'crm',
    description: 'Lifecycle, VIP, automações e recuperação de clientes.',
    badge: 'premium',
    icon: 'Sparkles',
  }),
  def({
    key: 'vip_customers',
    name: 'Clientes VIP',
    category: 'crm',
    description: 'Marcação manual e sugestões automáticas de clientes premium.',
    icon: 'Crown',
  }),
  def({
    key: 'lifecycle_automation',
    name: 'Automação de lifecycle',
    category: 'crm',
    description: 'Campanhas automáticas para 1ª visita, em risco, inativo, perdido.',
    badge: 'premium',
    icon: 'Zap',
  }),
  def({
    key: 'campaigns',
    name: 'Campanhas',
    category: 'crm',
    description: 'Mensagens em massa segmentadas (WhatsApp, push, email).',
    badge: 'soon',
    hidden: true,
    icon: 'Megaphone',
  }),
  def({
    key: 'segmentation',
    name: 'Segmentação avançada',
    category: 'crm',
    description: 'Segmentos dinâmicos por comportamento, frequência e ticket.',
    badge: 'soon',
    hidden: true,
    icon: 'Filter',
  }),

  // ── PAGAMENTOS ────────────────────────────────────────────────────────────
  def({
    key: 'stripe_payments',
    name: 'Pagamentos Stripe',
    category: 'payments',
    description: 'Receber pagamentos online via Stripe Connect (Pix e cartão).',
    badge: 'premium',
    icon: 'CreditCard',
  }),
  def({
    key: 'subscriptions',
    name: 'Assinaturas',
    category: 'payments',
    description: 'Planos mensais para clientes (assinaturas recorrentes).',
    badge: 'premium',
    icon: 'Repeat',
  }),
  def({
    key: 'pix',
    name: 'Pix',
    category: 'payments',
    description: 'Cobrança via Pix integrada ao link público.',
    icon: 'QrCode',
  }),
  def({
    key: 'split_payment',
    name: 'Split de pagamento',
    category: 'payments',
    description: 'Divisão automática entre barbearia e profissionais.',
    badge: 'soon',
    hidden: true,
    icon: 'GitBranch',
  }),
  def({
    key: 'automatic_billing',
    name: 'Cobrança automática',
    category: 'payments',
    description: 'Cobrança recorrente sem intervenção manual.',
    badge: 'soon',
    hidden: true,
    icon: 'Receipt',
  }),

  // ── FINANCEIRO ────────────────────────────────────────────────────────────
  def({
    key: 'cashier',
    name: 'Caixa',
    category: 'finance',
    description: 'Abertura/fechamento de caixa diário com conferência.',
    icon: 'Banknote',
  }),
  def({
    key: 'financial_dashboard',
    name: 'Dashboard financeiro',
    category: 'finance',
    description: 'Entradas, saídas e saúde financeira da barbearia.',
    icon: 'TrendingUp',
  }),
  def({
    key: 'advanced_reports',
    name: 'Relatórios avançados',
    category: 'finance',
    description: 'Relatórios profundos, exportação e análises por período.',
    icon: 'BarChart3',
  }),
  def({
    key: 'commissions',
    name: 'Comissões',
    category: 'finance',
    description: 'Cálculo automático e pagamento de comissões da equipe.',
    icon: 'Percent',
  }),

  // ── OPERAÇÃO ──────────────────────────────────────────────────────────────
  def({
    key: 'multi_units',
    name: 'Multi-unidades',
    category: 'operations',
    description: 'Várias filiais sob a mesma conta com seletor de unidade.',
    badge: 'enterprise',
    enterprise_only: true,
    icon: 'Building2',
  }),
  def({
    key: 'inventory',
    name: 'Estoque',
    category: 'operations',
    description: 'Controle de produtos, entrada/saída e alertas de estoque baixo.',
    badge: 'soon',
    hidden: true,
    icon: 'Boxes',
  }),
  def({
    key: 'products',
    name: 'Produtos',
    category: 'operations',
    description: 'Venda de produtos avulsos no atendimento.',
    badge: 'soon',
    hidden: true,
    icon: 'Package',
  }),
  def({
    key: 'loyalty_program',
    name: 'Programa de fidelidade',
    category: 'operations',
    description: 'Pontuação, cartelas e recompensas por fidelidade.',
    badge: 'soon',
    hidden: true,
    icon: 'Award',
  }),
  def({
    key: 'combos',
    name: 'Combos',
    category: 'operations',
    description: 'Pacotes de serviços combinados com preço promocional.',
    icon: 'Layers',
  }),

  // ── MARKETING ─────────────────────────────────────────────────────────────
  def({
    key: 'whatsapp',
    name: 'WhatsApp automático',
    category: 'marketing',
    description: 'Confirmações, lembretes e mensagens de retenção via WhatsApp.',
    default_enabled: true,
    icon: 'MessageCircle',
  }),
  def({
    key: 'ai_growth',
    name: 'AI Growth',
    category: 'marketing',
    description: 'Insights de crescimento e ações sugeridas pela IA.',
    badge: 'premium',
    icon: 'Sparkles',
  }),
  def({
    key: 'coupons',
    name: 'Cupons',
    category: 'marketing',
    description: 'Cupons de desconto promocionais com regras e validade.',
    badge: 'soon',
    hidden: true,
    icon: 'Ticket',
  }),
  def({
    key: 'referral_program',
    name: 'Indique e ganhe',
    category: 'marketing',
    description: 'Programa de indicação entre barbearias / B2B.',
    icon: 'Share2',
  }),
  def({
    key: 'reviews',
    name: 'Avaliações',
    category: 'marketing',
    description: 'Coleta de avaliações pós-atendimento e moderação.',
    icon: 'Star',
  }),

  // ── INTELIGÊNCIA ARTIFICIAL ───────────────────────────────────────────────
  def({
    key: 'ai_assistant',
    name: 'Assistente IA',
    category: 'ai',
    description: 'Copiloto que responde dúvidas e executa ações no painel.',
    badge: 'soon',
    hidden: true,
    icon: 'Bot',
  }),
  def({
    key: 'smart_pricing',
    name: 'Preço dinâmico',
    category: 'ai',
    description: 'IA sugere preço ideal por horário e demanda.',
    badge: 'soon',
    hidden: true,
    icon: 'TrendingUp',
  }),
  def({
    key: 'predictive_retention',
    name: 'Retenção preditiva',
    category: 'ai',
    description: 'Previsão de churn e ações automáticas para reter clientes.',
    badge: 'soon',
    hidden: true,
    icon: 'Brain',
  }),
  def({
    key: 'smart_insights',
    name: 'Insights inteligentes',
    category: 'ai',
    description: 'Análises automáticas dos pontos de atenção da operação.',
    badge: 'premium',
    icon: 'Lightbulb',
  }),

  // ── ADMIN & PLATAFORMA ────────────────────────────────────────────────────
  def({
    key: 'team_management',
    name: 'Gestão de equipe',
    category: 'admin',
    description: 'Convites e papéis (admin, recepção, financeiro, barbeiro).',
    icon: 'Users',
  }),
  def({
    key: 'api_access',
    name: 'API',
    category: 'admin',
    description: 'Acesso à API REST para integrações externas.',
    badge: 'enterprise',
    enterprise_only: true,
    hidden: true,
    icon: 'Code',
  }),
  def({
    key: 'advanced_permissions',
    name: 'Permissões avançadas',
    category: 'admin',
    description: 'Papéis customizados e permissões granulares por recurso.',
    badge: 'enterprise',
    enterprise_only: true,
    hidden: true,
    icon: 'Shield',
  }),
  def({
    key: 'audit_logs',
    name: 'Logs de auditoria',
    category: 'admin',
    description: 'Histórico de ações sensíveis com filtros e exportação.',
    badge: 'enterprise',
    enterprise_only: true,
    hidden: true,
    icon: 'FileText',
  }),

  // ── EXPERIÊNCIA & BRANDING ────────────────────────────────────────────────
  def({
    key: 'custom_branding',
    name: 'Marca personalizada',
    category: 'experience',
    description: 'Logo, cores e domínio próprio nas páginas públicas.',
    badge: 'enterprise',
    enterprise_only: true,
    icon: 'Palette',
  }),
  def({
    key: 'white_label',
    name: 'White label',
    category: 'experience',
    description: 'Aplicativo totalmente sem marca da plataforma.',
    badge: 'enterprise',
    enterprise_only: true,
    hidden: true,
    icon: 'Tag',
  }),
  def({
    key: 'advanced_dashboard',
    name: 'Dashboard avançado',
    category: 'experience',
    description: 'Métricas profundas, ranking de profissionais e insights.',
    badge: 'premium',
    icon: 'LayoutDashboard',
  }),
];

// ============================================================================
// COMPATIBILIDADE — código antigo importava FEATURE_CATALOG
// ============================================================================
export const FEATURE_CATALOG = FEATURE_REGISTRY.map(f => ({
  ...f,
  // alias label → name para componentes antigos
  label: f.name,
}));

// ============================================================================
// HELPERS
// ============================================================================
const FEATURE_KEYS_SET = new Set(FEATURE_REGISTRY.map(f => f.key));

export function isKnownFeature(key) {
  return FEATURE_KEYS_SET.has(canonicalFeatureKey(key));
}

export function getFeatureMeta(key) {
  const k = canonicalFeatureKey(key);
  return FEATURE_REGISTRY.find(f => f.key === k) || null;
}

export function getFeaturesByCategory({ includeHidden = false } = {}) {
  const grouped = {};
  for (const f of FEATURE_REGISTRY) {
    if (!includeHidden && f.hidden) continue;
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  }
  return grouped;
}

// Lista de keys que entram ON por padrão em planos novos.
export function getDefaultEnabledKeys() {
  return FEATURE_REGISTRY.filter(f => f.default_enabled).map(f => f.key);
}

export const BADGE_STYLES = {
  beta:       { label: 'Beta',       className: 'bg-amber-50 text-amber-700 border-amber-200' },
  premium:    { label: 'Premium',    className: 'bg-violet-50 text-violet-700 border-violet-200' },
  enterprise: { label: 'Enterprise', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  soon:       { label: 'Em breve',   className: 'bg-sky-50 text-sky-700 border-sky-200' },
  hidden:     { label: 'Oculto',     className: 'bg-gray-100 text-gray-500 border-gray-200' },
};