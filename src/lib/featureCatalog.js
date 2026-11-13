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
  stripe_payments: 'online_payments',
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
  badge: 'master',
  commercial_tag: 'Plano Master',
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
    description: 'Link público de agendamento em /agendar/:slug com confirmação instantânea.',
    badge: 'core',
    commercial_tag: 'Essencial · Plano Master',
    default_enabled: true,
    icon: 'Calendar',
  }),
  def({
    key: 'recurring_appointments',
    name: 'Agendamentos recorrentes',
    category: 'agenda',
    description: 'Cliente agenda um horário fixo semanal/quinzenal automaticamente.',
    badge: 'soon',
    commercial_tag: 'Roadmap · Plano Master',
    hidden: true,
    icon: 'Repeat',
  }),
  def({
    key: 'waitlist',
    name: 'Lista de espera',
    category: 'agenda',
    description: 'Clientes entram em fila quando a agenda está cheia e são avisados em vagas.',
    badge: 'soon',
    commercial_tag: 'Roadmap · Plano Master',
    hidden: true,
    icon: 'Clock',
  }),
  def({
    key: 'smart_reminders',
    name: 'Lembretes inteligentes',
    category: 'agenda',
    description: 'IA escolhe melhor horário e canal para lembrar cada cliente.',
    badge: 'premium',
    commercial_tag: 'Premium · Plano Master',
    hidden: true,
    icon: 'Bell',
  }),

  // ── CRM & RETENÇÃO ────────────────────────────────────────────────────────
  def({
    key: 'crm_retention',
    name: 'CRM & Retenção',
    category: 'crm',
    description: 'Lifecycle, VIP, automações e recuperação inteligente de clientes inativos.',
    badge: 'premium',
    commercial_tag: 'Plano Master · IA Retenção',
    icon: 'Sparkles',
  }),
  def({
    key: 'vip_customers',
    name: 'Clientes VIP',
    category: 'crm',
    description: 'Marcação manual e sugestões automáticas de clientes premium de alto LTV.',
    badge: 'master',
    commercial_tag: 'Incluso no Plano Master',
    icon: 'Crown',
  }),
  def({
    key: 'lifecycle_automation',
    name: 'Automação de lifecycle',
    category: 'crm',
    description: 'Campanhas automáticas para 1ª visita, em risco, inativo e perdido.',
    badge: 'premium',
    commercial_tag: 'Plano Master · Automação',
    icon: 'Zap',
  }),
  def({
    key: 'campaigns',
    name: 'Campanhas',
    category: 'crm',
    description: 'Mensagens em massa segmentadas (WhatsApp, push, email).',
    badge: 'soon',
    commercial_tag: 'Roadmap · Marketing',
    hidden: true,
    icon: 'Megaphone',
  }),
  def({
    key: 'segmentation',
    name: 'Segmentação avançada',
    category: 'crm',
    description: 'Segmentos dinâmicos por comportamento, frequência e ticket.',
    badge: 'soon',
    commercial_tag: 'Roadmap · CRM',
    hidden: true,
    icon: 'Filter',
  }),

  // ── PAGAMENTOS ────────────────────────────────────────────────────────────
  def({
    key: 'online_payments',
    name: 'Pagamentos online',
    category: 'payments',
    description: 'Receber pagamentos online via Asaas (Pix e cartão de crédito).',
    badge: 'premium',
    commercial_tag: 'Plano Master · Asaas',
    icon: 'CreditCard',
  }),
  def({
    key: 'subscriptions',
    name: 'Assinaturas',
    category: 'payments',
    description: 'Planos mensais para clientes (clubes de assinatura recorrente).',
    badge: 'premium',
    commercial_tag: 'Plano Master · Recorrência',
    icon: 'Repeat',
  }),
  def({
    key: 'pix',
    name: 'Pix',
    category: 'payments',
    description: 'Cobrança instantânea via Pix integrada ao link público de agendamento.',
    badge: 'core',
    commercial_tag: 'Essencial · Plano Master',
    icon: 'QrCode',
  }),
  def({
    key: 'split_payment',
    name: 'Split de pagamento',
    category: 'payments',
    description: 'Divisão automática entre barbearia e profissionais.',
    badge: 'soon',
    commercial_tag: 'Roadmap · Pagamentos',
    hidden: true,
    icon: 'GitBranch',
  }),
  def({
    key: 'automatic_billing',
    name: 'Cobrança automática',
    category: 'payments',
    description: 'Cobrança recorrente sem intervenção manual.',
    badge: 'soon',
    commercial_tag: 'Roadmap · Pagamentos',
    hidden: true,
    icon: 'Receipt',
  }),

  // ── FINANCEIRO ────────────────────────────────────────────────────────────
  def({
    key: 'cashier',
    name: 'Caixa',
    category: 'finance',
    description: 'Abertura e fechamento de caixa diário com conferência de saldo.',
    badge: 'core',
    commercial_tag: 'Essencial · Plano Master',
    icon: 'Banknote',
  }),
  def({
    key: 'financial_dashboard',
    name: 'Dashboard financeiro',
    category: 'finance',
    description: 'Entradas, saídas, DRE operacional e saúde financeira da barbearia.',
    badge: 'master',
    commercial_tag: 'Incluso no Plano Master',
    icon: 'TrendingUp',
  }),
  def({
    key: 'advanced_reports',
    name: 'Relatórios avançados',
    category: 'finance',
    description: 'Relatórios profundos, exportação CSV/PDF e análises por período.',
    badge: 'master',
    commercial_tag: 'Plano Master · BI',
    icon: 'BarChart3',
  }),
  def({
    key: 'commissions',
    name: 'Comissões',
    category: 'finance',
    description: 'Cálculo automático e conciliação de comissões da equipe de barbeiros.',
    badge: 'master',
    commercial_tag: 'Plano Master · Equipe',
    icon: 'Percent',
  }),

  // ── OPERAÇÃO ──────────────────────────────────────────────────────────────
  def({
    key: 'multi_units',
    name: 'Multi-unidades',
    category: 'operations',
    description: 'Várias filiais sob a mesma conta com seletor de unidade e governança central.',
    badge: 'enterprise',
    commercial_tag: 'Plano Exclusivo · Redes',
    enterprise_only: true,
    icon: 'Building2',
  }),
  def({
    key: 'inventory',
    name: 'Estoque',
    category: 'operations',
    description: 'Controle de produtos, entrada/saída e alertas de estoque baixo.',
    badge: 'soon',
    commercial_tag: 'Roadmap · Operação',
    hidden: true,
    icon: 'Boxes',
  }),
  def({
    key: 'products',
    name: 'Produtos',
    category: 'operations',
    description: 'Venda de produtos avulsos no atendimento.',
    badge: 'soon',
    commercial_tag: 'Roadmap · Operação',
    hidden: true,
    icon: 'Package',
  }),
  def({
    key: 'loyalty_program',
    name: 'Programa de fidelidade',
    category: 'operations',
    description: 'Pontuação, cartelas e recompensas por fidelidade.',
    badge: 'soon',
    commercial_tag: 'Roadmap · Retenção',
    hidden: true,
    icon: 'Award',
  }),
  def({
    key: 'combos',
    name: 'Combos',
    category: 'operations',
    description: 'Pacotes de serviços combinados (Corte + Barba) com preço promocional.',
    badge: 'master',
    commercial_tag: 'Incluso no Plano Master',
    icon: 'Layers',
  }),

  // ── MARKETING ─────────────────────────────────────────────────────────────
  def({
    key: 'whatsapp',
    name: 'WhatsApp automático',
    category: 'marketing',
    description: 'Confirmações, lembretes e mensagens de retenção via WhatsApp.',
    badge: 'core',
    commercial_tag: 'Essencial · Plano Master',
    default_enabled: true,
    icon: 'MessageCircle',
  }),
  def({
    key: 'ai_growth',
    name: 'AI Growth',
    category: 'marketing',
    description: 'Insights de crescimento e ações comerciais sugeridas pela IA.',
    badge: 'premium',
    commercial_tag: 'Plano Master · IA Growth',
    icon: 'Sparkles',
  }),
  def({
    key: 'coupons',
    name: 'Cupons',
    category: 'marketing',
    description: 'Cupons de desconto promocionais com regras e validade.',
    badge: 'soon',
    commercial_tag: 'Roadmap · Marketing',
    hidden: true,
    icon: 'Ticket',
  }),
  def({
    key: 'referral_program',
    name: 'Indique e ganhe',
    category: 'marketing',
    description: 'Programa de indicação entre barbearias e parceiros B2B com comissão.',
    badge: 'master',
    commercial_tag: 'Incluso no Plano Master',
    icon: 'Share2',
  }),
  def({
    key: 'reviews',
    name: 'Avaliações',
    category: 'marketing',
    description: 'Coleta automática de avaliações pós-atendimento e moderação pública.',
    badge: 'master',
    commercial_tag: 'Incluso no Plano Master',
    icon: 'Star',
  }),

  // ── INTELIGÊNCIA ARTIFICIAL ───────────────────────────────────────────────
  def({
    key: 'ai_assistant',
    name: 'Assistente IA',
    category: 'ai',
    description: 'Copiloto que responde dúvidas e executa ações no painel.',
    badge: 'soon',
    commercial_tag: 'Roadmap · IA',
    hidden: true,
    icon: 'Bot',
  }),
  def({
    key: 'smart_pricing',
    name: 'Preço dinâmico',
    category: 'ai',
    description: 'IA sugere preço ideal por horário e demanda.',
    badge: 'soon',
    commercial_tag: 'Roadmap · IA',
    hidden: true,
    icon: 'TrendingUp',
  }),
  def({
    key: 'predictive_retention',
    name: 'Retenção preditiva',
    category: 'ai',
    description: 'Previsão de churn e ações automáticas para reter clientes.',
    badge: 'soon',
    commercial_tag: 'Roadmap · IA',
    hidden: true,
    icon: 'Brain',
  }),
  def({
    key: 'smart_insights',
    name: 'Insights inteligentes',
    category: 'ai',
    description: 'Análises automáticas dos pontos de atenção e oportunidades da operação.',
    badge: 'premium',
    commercial_tag: 'Plano Master · IA Insights',
    icon: 'Lightbulb',
  }),
  def({
    key: 'ai_smart_scheduling_experimental',
    name: 'Agendamento Inteligente Experimental (IA)',
    category: 'ai',
    description: 'Feature flag experimental: motor preditivo de encaixe automático de horários via IA.',
    badge: 'experimental',
    commercial_tag: 'Experimental · Rollout IA',
    experimental: true,
    default_enabled: false,
    hidden: false,
    icon: 'Sparkles',
  }),
  def({
    key: 'dynamic_pricing_experimental',
    name: 'Precificação Dinâmica Experimental',
    category: 'ai',
    description: 'Feature flag experimental: ajuste automático de preços em horários de baixa demanda.',
    badge: 'experimental',
    commercial_tag: 'Experimental · Rollout IA',
    experimental: true,
    default_enabled: false,
    hidden: false,
    icon: 'TrendingUp',
  }),

  // ── ADMIN & PLATAFORMA ────────────────────────────────────────────────────
  def({
    key: 'team_management',
    name: 'Gestão de equipe',
    category: 'admin',
    description: 'Convites e papéis granulares (admin, recepção, financeiro, barbeiro).',
    badge: 'master',
    commercial_tag: 'Incluso no Plano Master',
    icon: 'Users',
  }),
  def({
    key: 'api_access',
    name: 'API',
    category: 'admin',
    description: 'Acesso à API REST para integrações externas.',
    badge: 'enterprise',
    commercial_tag: 'Enterprise · API',
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
    commercial_tag: 'Enterprise · RBAC',
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
    commercial_tag: 'Enterprise · Compliance',
    enterprise_only: true,
    hidden: true,
    icon: 'FileText',
  }),

  // ── EXPERIÊNCIA & BRANDING ────────────────────────────────────────────────
  def({
    key: 'custom_branding',
    name: 'Marca personalizada',
    category: 'experience',
    description: 'Logo, cores e domínio próprio nas páginas públicas da barbearia.',
    badge: 'enterprise',
    commercial_tag: 'Plano Exclusivo · Branding',
    enterprise_only: true,
    icon: 'Palette',
  }),
  def({
    key: 'white_label',
    name: 'White label',
    category: 'experience',
    description: 'Aplicativo totalmente sem marca da plataforma.',
    badge: 'enterprise',
    commercial_tag: 'Enterprise · White-Label',
    enterprise_only: true,
    hidden: true,
    icon: 'Tag',
  }),
  def({
    key: 'advanced_dashboard',
    name: 'Dashboard avançado',
    category: 'experience',
    description: 'Métricas profundas, ranking de profissionais e insights executivos.',
    badge: 'premium',
    commercial_tag: 'Plano Master · Analytics',
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
  master:       { label: 'Plano Master',            className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/35' },
  core:         { label: 'Essencial · Plano Master', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35' },
  experimental: { label: 'Experimental',            className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35' },
  beta:         { label: 'Beta',                    className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35' },
  premium:      { label: 'Premium · Plano Master',  className: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/35' },
  enterprise:   { label: 'Enterprise · Exclusivo',  className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/35' },
  soon:         { label: 'Em breve',                className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/35' },
  hidden:       { label: 'Oculto',                  className: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600' },
};