// Lista de funcionalidades reais da plataforma O CORTE, agrupadas por categoria.
// Exibido no Master Dashboard para refletir o poder atual do produto.
import {
  Calendar, MoveHorizontal, UserPlus, Building2,
  CreditCard, Wallet, Sparkles,
  TrendingUp, Repeat2, Award, Layers, Scale,
  Zap, CalendarOff, Lock, Clock4, Shield,
} from 'lucide-react';

const groups = [
  {
    title: 'Agenda & Operação',
    icon: Calendar,
    color: 'text-[#2563EB] bg-[#EFF6FF] ring-[#DBEAFE] dark:text-blue-300 dark:bg-blue-500/15 dark:ring-blue-500/30',
    items: [
      {
        icon: Calendar,
        label: 'Agendamento online',
        tag: 'Essencial · Plano Master',
        desc: 'Link público /agendar/:slug com escolha de barbeiro, serviço e horário em tempo real.',
      },
      {
        icon: MoveHorizontal,
        label: 'Drag-and-drop entre barbeiros',
        tag: 'Plano Master',
        desc: 'Reorganize horários e transfira atendimentos entre profissionais com um arraste.',
      },
      {
        icon: UserPlus,
        label: 'Cadastro automático de clientes',
        tag: 'Essencial · Plano Master',
        desc: 'Cria e atualiza fichas de clientes automaticamente a partir do agendamento.',
      },
      {
        icon: Building2,
        label: 'Multi-unidade por empresa',
        tag: 'Plano Exclusivo · Redes',
        desc: 'Gestão centralizada de matriz e filiais com relatórios independentes por unidade.',
      },
      {
        icon: CalendarOff,
        label: 'Bloqueios recorrentes (dias e horários)',
        tag: 'Plano Master',
        desc: 'Configure pausas de almoço, folgas fixas e feriados para cada profissional.',
      },
      {
        icon: Lock,
        label: 'Link público com login (e-mail + senha)',
        tag: 'Essencial · Plano Master',
        desc: 'Área do cliente segura com histórico de cortes, clubes ativos e reagendamento.',
      },
    ],
  },
  {
    title: 'Pagamentos & Recorrência',
    icon: CreditCard,
    color: 'text-emerald-700 bg-emerald-50 ring-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15 dark:ring-emerald-500/30',
    items: [
      {
        icon: CreditCard,
        label: 'Pagamento Pix e cartão (Asaas)',
        tag: 'Plano Master · Asaas',
        desc: 'Checkout transparente com confirmação automática de pagamento e baixa no caixa.',
      },
      {
        icon: Wallet,
        label: 'Planos de assinatura para clientes',
        tag: 'Plano Master · Recorrência',
        desc: 'Crie clubes mensais recorrentes com controle automático de usos e renovação.',
      },
      {
        icon: Sparkles,
        label: 'Sugestão inteligente de preços (IA)',
        tag: 'Premium · IA',
        desc: 'Recomendações de tarifa baseadas na ocupação e demanda histórica da barbearia.',
      },
      {
        icon: Clock4,
        label: 'Planos off-peak (janela restrita)',
        tag: 'Plano Master · Recorrência',
        desc: 'Assinaturas com dias permitidos (ex: terça e quarta) para preencher horários ociosos.',
      },
    ],
  },
  {
    title: 'Analytics & BI Financeiro',
    icon: TrendingUp,
    color: 'text-amber-700 bg-amber-50 ring-amber-100 dark:text-amber-300 dark:bg-amber-500/15 dark:ring-amber-500/30',
    items: [
      {
        icon: Clock4,
        label: 'Horários de pico mais agendados',
        tag: 'Plano Master · BI',
        desc: 'Mapa de calor de ocupação para otimizar escalas e bancadas da equipe.',
      },
      {
        icon: Repeat2,
        label: 'Retenção (retorno em até 60 dias)',
        tag: 'Plano Master · CRM',
        desc: 'Monitoramento contínuo da taxa de retorno e alertas de clientes em risco de churn.',
      },
      {
        icon: Award,
        label: 'Ranking de barbeiros (retenção e perda)',
        tag: 'Plano Master · Equipe',
        desc: 'Indicadores individuais de produtividade, ticket médio, comissões e fidelização.',
      },
      {
        icon: Layers,
        label: 'Performance de upsell de serviços',
        tag: 'Plano Master · BI',
        desc: 'Análise de conversão de combos e serviços adicionais por atendimento.',
      },
      {
        icon: Scale,
        label: 'Comparativo: assinatura vs avulso',
        tag: 'Plano Master · Financeiro',
        desc: 'Visão clara da receita recorrente (MRR) frente aos atendimentos avulsos.',
      },
    ],
  },
  {
    title: 'Crescimento & Governança',
    icon: Zap,
    color: 'text-purple-700 bg-purple-50 ring-purple-100 dark:text-purple-300 dark:bg-purple-500/15 dark:ring-purple-500/30',
    items: [
      {
        icon: Zap,
        label: 'Preenchimento automático de horários vazios',
        tag: 'Plano Master · IA Growth',
        desc: 'Campanhas inteligentes via WhatsApp para convidar clientes quando há janelas livres.',
      },
      {
        icon: Shield,
        label: 'Painel Master (empresas, planos e acessos)',
        tag: 'Enterprise · Governança',
        desc: 'Controle multi-tenant, auditoria imutável, LGPD e feature flags em tempo real.',
      },
    ],
  },
];

export default function PlatformFeatures() {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">
            Catálogo Comercial de Funcionalidades — Plano Master & Plataforma
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-200 mt-0.5 font-medium">
            Recursos comerciais organizados em cards com descrição de valor e tag comercial por funcionalidade.
          </p>
        </div>
        <span className="inline-flex items-center self-start sm:self-auto text-[11px] font-bold px-3 py-1 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/35">
          Plano Master · Catálogo Ativo
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((g) => {
          const GIcon = g.icon;
          return (
            <div key={g.title} className="rounded-xl border border-slate-200 dark:border-[#232B45] bg-slate-50/70 dark:bg-[#0D1326] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ring-1 ${g.color}`}>
                  <GIcon className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">{g.title}</h3>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <div
                      key={it.label}
                      data-testid="platform-feature-card"
                      className="rounded-xl border border-slate-200 dark:border-[#2A3352] bg-white dark:bg-[#141A2E] p-3 shadow-2xs hover:border-blue-500/45 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">
                          <Icon className="w-3.5 h-3.5 flex-shrink-0 text-blue-600 dark:text-blue-300" />
                          <span>{it.label}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/35 whitespace-nowrap">
                          {it.tag}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-200 leading-relaxed pl-5">
                        {it.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}