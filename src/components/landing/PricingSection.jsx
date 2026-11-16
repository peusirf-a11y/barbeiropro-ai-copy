// PricingSection — Secção pública de preços e planos da Landing Page (ocorte.app)
// Apresenta os 3 planos comerciais: Clássico (R$ 69/mês), Master (R$ 79/mês - Oferta de Lançamento) e Exclusivo (R$ 249/mês).

import { Link } from 'react-router-dom';
import { Check, Zap, Sparkles, Shield, ArrowRight, Lock, Crown, Scissors } from 'lucide-react';
import SectionBadge from './SectionBadge';
import GlowButton from './GlowButton';
import { BlurReveal, SpotlightCard } from '@/components/motion/MotionPrimitives';

const PLANS = [
  {
    id: 'classico',
    key: 'classico',
    name: 'Plano Clássico',
    tag: 'Autônomos',
    icon: Scissors,
    desc: 'Ideal para barbeiros autônomos que buscam profissionalizar a agenda e o controle financeiro diário.',
    price: '69',
    cents: ',00',
    billing: '/mês',
    periodNote: 'Sem fidelidade · Cancele quando quiser',
    highlight: false,
    badge: null,
    ctaText: 'Começar com Clássico',
    ctaLink: '/register?plan=classico',
    features: [
      {
        title: '1 barbeiro cadastrado',
        desc: 'Agenda dedicada com controle de horários e serviços individuais.',
        tag: 'Essencial',
      },
      {
        title: 'Agendamentos online ilimitados',
        desc: 'Receba marcações 24h por dia sem limite de volume mensal.',
        tag: 'Agenda Online',
      },
      {
        title: 'Link público e exclusivo da barbearia',
        desc: 'Página /agendar/:slug otimizada para conversão no celular.',
        tag: 'Canal Público',
      },
      {
        title: 'Recebimento via PIX e cartões integrado',
        desc: 'Cobrança automática integrada ao Asaas com confirmação instantânea.',
        tag: 'Pagamentos',
      },
      {
        title: 'Painel financeiro com fechamento de caixa',
        desc: 'Controle diário de entradas, saídas, sangrias e saldo em tempo real.',
        tag: 'Financeiro',
      },
      {
        title: 'Lembretes automáticos no WhatsApp',
        desc: 'Notificações automáticas para reduzir faltas e atrasos.',
        tag: 'Automação',
      },
      {
        title: 'Cadastro e histórico de clientes',
        desc: 'Base completa de clientes com registro de cortes e frequência.',
        tag: 'CRM Básico',
      },
    ],
  },
  {
    id: 'master',
    key: 'master',
    name: 'Plano Master',
    tag: 'Oferta de Lançamento',
    icon: Zap,
    desc: 'Para barbearias em expansão que querem fidelizar clientes com IA e automatizar comissões da equipe.',
    originalPrice: '119,00',
    price: '79',
    cents: ',00',
    billing: '/mês',
    periodNote: 'Preço promocional nos primeiros 3 meses (depois R$ 119,00/mês)',
    highlight: true,
    badge: 'OFERTA DE LANÇAMENTO · MAIS POPULAR',
    ctaText: 'Aproveitar Oferta Master',
    ctaLink: '/register?plan=master',
    features: [
      {
        title: 'Barbeiros e profissionais ilimitados',
        desc: 'Cadastre toda a sua bancada com agendas sincronizadas e permissões por perfil.',
        tag: 'Plano Master · Equipe',
      },
      {
        title: 'Agendamentos online ilimitados',
        desc: 'Link público inteligente com encaixe automático e zero comissão por corte.',
        tag: 'Essencial · Master',
      },
      {
        title: 'CRM de retenção inteligente (IA anti-churn)',
        desc: 'Identifica clientes ausentes há mais de 30 dias e dispara ações de recuperação.',
        tag: 'Premium · IA Retenção',
      },
      {
        title: 'Clientes VIP e clubes de assinatura recorrente',
        desc: 'Crie planos mensais recorrentes (BarberPass) com cobrança automática e controle de usos.',
        tag: 'Plano Master · Recorrência',
      },
      {
        title: 'Cálculo e conciliação automática de comissões',
        desc: 'Regras flexíveis por serviço ou profissional com extrato pronto para repasse.',
        tag: 'Plano Master · Financeiro',
      },
      {
        title: 'Automação de mensagens e pós-atendimento',
        desc: 'Lembretes, confirmação de presença e coleta de avaliações 5 estrelas via WhatsApp.',
        tag: 'Plano Master · Automação',
      },
      {
        title: 'Relatórios avançados de faturamento e ticket médio',
        desc: 'DRE operacional, ranking de barbeiros, horários de pico e exportação contábil.',
        tag: 'Plano Master · BI',
      },
      {
        title: 'Suporte prioritário humanizado no WhatsApp',
        desc: 'Atendimento direto com especialistas para acelerar a operação da sua barbearia.',
        tag: 'VIP · Prioritário',
      },
    ],
  },
  {
    id: 'exclusivo',
    key: 'exclusivo',
    name: 'Plano Matriz / Exclusivo',
    tag: 'Redes & Franquias',
    icon: Crown,
    desc: 'Para redes, franquias e estabelecimentos com matriz e filiais que necessitam de governança multi-unidades.',
    price: '249',
    cents: ',00',
    billing: '/mês (matriz)',
    periodNote: '+ R$ 90,00/mês por filial adicional vinculada',
    highlight: false,
    badge: null,
    ctaText: 'Escolher Exclusivo',
    ctaLink: '/register?plan=exclusivo',
    features: [
      {
        title: 'Unidade Matriz com governança centralizada',
        desc: 'Controle todas as unidades em um único painel executivo multi-tenant.',
        tag: 'Enterprise · Matriz',
      },
      {
        title: 'Filiais adicionais por apenas +R$ 90,00/mês cada',
        desc: 'Expansão previsível com seletor instantâneo de filial e estoque independente.',
        tag: 'Multi-unidades',
      },
      {
        title: 'Todos os recursos do Plano Master incluídos',
        desc: 'Acesso integral a IA Growth, clubes de assinatura, comissões e CRM VIP.',
        tag: 'Master Incluso',
      },
      {
        title: 'Painel executivo consolidado com DRE por unidade',
        desc: 'Comparativo financeiro em tempo real entre matriz e cada filial ativa.',
        tag: 'Enterprise · BI',
      },
      {
        title: 'White-label e personalização completa da marca',
        desc: 'Identidade visual própria nos links públicos e comunicações com clientes.',
        tag: 'Enterprise · Branding',
      },
      {
        title: 'Onboarding assistido e SLA VIP dedicado',
        desc: 'Migração assistida de dados e gerente de conta dedicado para a sua rede.',
        tag: 'Enterprise · VIP',
      },
    ],
  },
];

export default function PricingSection() {
  return (
    <section id="precos" className="relative py-24 md:py-32 px-5 md:px-8 overflow-hidden">
      {/* Luz ambiente de fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[520px] bg-gradient-to-tr from-[#1D4ED8]/8 to-[#3B82F6]/6 dark:from-[#1D4ED8]/15 dark:to-[#3B82F6]/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="relative max-w-7xl mx-auto">
        {/* Cabeçalho da Seção */}
        <BlurReveal inView className="text-center mb-16 md:mb-20 max-w-3xl mx-auto">
          <div className="flex justify-center mb-5">
            <SectionBadge icon={Sparkles}>Planos Transparentes</SectionBadge>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-[-0.025em] mb-5 leading-tight">
            <span className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-700 dark:from-white dark:via-white dark:to-white/75 bg-clip-text text-transparent">
              O investimento que se paga
            </span>{' '}
            <span className="bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] dark:from-[#60A5FA] dark:via-[#3B82F6] dark:to-[#93C5FD] bg-clip-text text-transparent">
              logo nos primeiros cortes.
            </span>
          </h2>
          <p className="text-base md:text-lg text-slate-600 dark:text-slate-300/80 leading-relaxed">
            Sem contratos de fidelidade ou taxas escondidas. Escolha o plano perfeito para o momento do seu negócio e experimente com 7 dias grátis.
          </p>
        </BlurReveal>

        {/* Grade Responsiva de Cartões */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-7 items-stretch">
          {PLANS.map((plan, index) => {
            const Icon = plan.icon;
            const isMaster = plan.highlight;

            return (
              <BlurReveal
                key={plan.id}
                inView
                delay={index * 0.08}
                y={18}
                className={isMaster ? 'lg:-translate-y-3 z-10' : ''}
              >
                <div className="relative h-full">
                  {/* Badge Superior Destacado para o Plano Master */}
                  {isMaster && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                      <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] text-white text-[10px] md:text-[11px] font-extrabold uppercase tracking-wider shadow-lg shadow-blue-500/30 whitespace-nowrap">
                        <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <SpotlightCard
                    hoverLift={!isMaster}
                    spotlightColor={isMaster ? 'rgba(37, 99, 235, 0.14)' : 'rgba(37, 99, 235, 0.08)'}
                    className={`rounded-3xl h-full flex flex-col justify-between ${
                      isMaster
                        ? 'border-2 border-[#2563EB] dark:border-[#60A5FA] bg-gradient-to-b from-blue-50/90 via-white to-white dark:bg-none dark:bg-[#0A1124] shadow-[0_24px_60px_-16px_rgba(37,99,235,0.22)] dark:shadow-[0_24px_80px_rgba(37,99,235,0.30)]'
                        : 'bg-white dark:bg-[#0B1121]/85'
                    }`}
                  >
                    <div className="flex flex-col justify-between h-full">
                      {/* Linha de brilho superior interna no Master */}
                      {isMaster && (
                        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-[#2563EB]/60 dark:via-[#93C5FD] to-transparent pointer-events-none" />
                      )}

                      {/* Conteúdo Superior do Card */}
                      <div className="p-7 md:p-8 flex-1 flex flex-col">
                        {/* Topo: Ícone + Tag de Segmento */}
                        <div className="flex items-center justify-between mb-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            isMaster
                              ? 'bg-blue-100 text-[#1D4ED8] ring-1 ring-blue-300 dark:bg-[#2563EB]/20 dark:text-[#60A5FA] dark:ring-[#60A5FA]/40 shadow-inner'
                              : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-white/[0.05] dark:text-white/80 dark:ring-white/10'
                          }`}>
                            <Icon className="w-5 h-5" strokeWidth={1.75} />
                          </div>
                          <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg ${
                            isMaster
                              ? 'bg-blue-100 text-[#1D4ED8] border border-blue-200 dark:bg-[#2563EB]/25 dark:text-[#93C5FD] dark:border-[#60A5FA]/30'
                              : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-white/[0.04] dark:text-slate-300/80 dark:border-white/[0.08]'
                          }`}>
                            {plan.tag}
                          </span>
                        </div>

                        {/* Nome e Descrição */}
                        <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                          {plan.name}
                        </h3>
                        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300/80 leading-relaxed mb-6 min-h-[40px]">
                          {plan.desc}
                        </p>

                        {/* Bloco de Preço */}
                        <div className="pt-4 pb-6 border-y border-slate-200 dark:border-white/[0.08] mb-6">
                          {plan.originalPrice && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-slate-500 dark:text-slate-400 line-through tabular-nums">
                                De R$ {plan.originalPrice}
                              </span>
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 tabular-nums">
                                -33% OFF
                              </span>
                            </div>
                          )}
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">R$</span>
                            <span className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-none tabular-nums">
                              {plan.price}
                            </span>
                            <span className="text-lg font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                              {plan.cents}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
                              {plan.billing}
                            </span>
                          </div>
                          <p className={`text-[11px] font-medium mt-2 leading-tight tabular-nums ${
                            isMaster ? 'text-[#1D4ED8] dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'
                          }`}>
                            {plan.periodNote}
                          </p>
                        </div>

                        {/* Catálogo de Recursos em Cards Comerciais */}
                        <div className="space-y-2.5 flex-1 mb-6">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                            {isMaster ? 'Catálogo Comercial — Recursos do Plano Master:' : 'Recursos comerciais inclusos:'}
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                            {plan.features.map((feature) => {
                              const fTitle = typeof feature === 'string' ? feature : feature.title;
                              const fDesc = typeof feature === 'string' ? '' : feature.desc;
                              const fTag = typeof feature === 'string' ? plan.name : feature.tag;
                              return (
                                <div
                                  key={fTitle}
                                  data-testid={`pricing-feature-card-${plan.key}`}
                                  className={`rounded-xl border p-2.5 transition-colors duration-150 ${
                                    isMaster
                                      ? 'border-blue-200/80 bg-white/95 hover:border-blue-400 dark:border-[#60A5FA]/25 dark:bg-white/[0.04] dark:hover:border-[#60A5FA]/50'
                                      : 'border-slate-200/90 bg-slate-50/75 hover:border-slate-300 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/20'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2">
                                      <div
                                        className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                          isMaster ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300' : 'bg-slate-200/90 text-slate-700 dark:bg-white/10 dark:text-white/80'
                                        }`}
                                      >
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      </div>
                                      <span className="text-xs md:text-[13px] font-bold text-slate-900 dark:text-white leading-snug">
                                        {fTitle}
                                      </span>
                                    </div>
                                    {fTag && (
                                      <span
                                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${
                                          isMaster
                                            ? 'bg-blue-50 text-[#1D4ED8] border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/30'
                                            : 'bg-white text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-200 dark:border-white/15'
                                        }`}
                                      >
                                        {fTag}
                                      </span>
                                    )}
                                  </div>
                                  {fDesc && (
                                    <p className="text-[11px] text-slate-600 dark:text-slate-300/80 leading-snug mt-1 pl-6">
                                      {fDesc}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Rodapé do Card com CTA */}
                      <div className="p-7 md:p-8 pt-0">
                        {isMaster ? (
                          <GlowButton to={plan.ctaLink} className="w-full h-12 text-sm font-extrabold justify-center shadow-lg shadow-blue-600/30">
                            {plan.ctaText}
                          </GlowButton>
                        ) : (
                          <Link
                            to={plan.ctaLink}
                            className="w-full h-12 rounded-xl text-sm font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 dark:text-white/95 dark:bg-white/[0.05] dark:hover:bg-white/[0.10] dark:border-white/15 dark:hover:border-white/30 transition-all duration-[180ms] flex items-center justify-center gap-2 group cursor-pointer"
                          >
                            <span>{plan.ctaText}</span>
                            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:translate-x-1 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white transition-all" />
                          </Link>
                        )}

                        <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-slate-600 dark:text-slate-400">
                          <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400/80" />
                          <span>7 dias grátis para testar</span>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
              </BlurReveal>
            );
          })}
        </div>

        {/* Barra de Confiança e Garantias Inferior */}
        <BlurReveal inView delay={0.1} y={12}>
          <SpotlightCard
            hoverLift={false}
            className="mt-16 md:mt-20 p-6 rounded-2xl max-w-4xl mx-auto"
          >
            <div className="flex flex-col sm:flex-row items-center justify-around gap-5 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-400 flex items-center justify-center">
                  <Shield className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Garantia Incondicional</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300/80">Experimente 7 dias sem cobrança</p>
                </div>
              </div>

              <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-white/10" />

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/25 dark:text-blue-400 flex items-center justify-center">
                  <Lock className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Sem Fidelidade ou Multas</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300/80">Cancele quando desejar em 1 clique</p>
                </div>
              </div>

              <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-white/10" />

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 dark:bg-purple-500/10 dark:border-purple-500/25 dark:text-purple-400 flex items-center justify-center">
                  <Zap className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Ativação Imediata</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300/80">Configure sua barbearia em 2 minutos</p>
                </div>
              </div>
            </div>
          </SpotlightCard>
        </BlurReveal>
      </div>
    </section>
  );
}
