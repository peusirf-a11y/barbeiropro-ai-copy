// PricingSection — Secção pública de preços e planos da Landing Page (ocorte.app)
// Apresenta os 3 planos comerciais: Clássico (R$ 69/mês), Master (R$ 79/mês - Oferta de Lançamento) e Exclusivo (R$ 249/mês).

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Zap, Sparkles, Shield, ArrowRight, Lock, Crown, Scissors } from 'lucide-react';
import SectionBadge from './SectionBadge';
import GlowButton from './GlowButton';

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
      '1 barbeiro cadastrado',
      'Agendamentos online ilimitados',
      'Link público e exclusivo da barbearia',
      'Recebimento via PIX e cartões integrado',
      'Painel financeiro com fechamento de caixa',
      'Lembretes automáticos no WhatsApp',
      'Cadastro e histórico de clientes',
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
      'Barbeiros e profissionais ilimitados',
      'Agendamentos online ilimitados',
      'Todos os recursos do Plano Clássico',
      'CRM de retenção inteligente (IA anti-churn)',
      'Clientes VIP e clubes de assinatura recorrente',
      'Cálculo e conciliação automática de comissões',
      'Automação de mensagens e pós-atendimento',
      'Relatórios avançados de faturamento e ticket médio',
      'Suporte prioritário humanizado no WhatsApp',
    ],
  },
  {
    id: 'exclusivo',
    key: 'exclusivo',
    name: 'Plano Exclusivo',
    tag: 'Redes & Franquias',
    icon: Crown,
    desc: 'Para redes, franquias e estabelecimentos de grande porte que necessitam de governança e multi-unidades.',
    price: '249',
    cents: ',00',
    billing: '/mês',
    periodNote: 'Gestão multi-unidade unificada',
    highlight: false,
    badge: null,
    ctaText: 'Escolher Exclusivo',
    ctaLink: '/register?plan=exclusivo',
    features: [
      'Multi-unidade integrada (matriz e filiais)',
      'Barbeiros, unidades e agendamentos ilimitados',
      'Todos os recursos do Plano Master incluídos',
      'Painel executivo consolidado com DRE por unidade',
      'White-label e personalização completa da marca',
      'Exportação contábil e auditoria financeira',
      'Onboarding assistido e migração de dados',
      'SLA de atendimento VIP e consultor dedicado',
    ],
  },
];

export default function PricingSection() {
  return (
    <section id="precos" className="relative py-24 md:py-32 px-5 md:px-8 overflow-hidden">
      {/* Luz ambiente de fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[520px] bg-gradient-to-tr from-[#1D4ED8]/15 to-[#3B82F6]/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="relative max-w-7xl mx-auto">
        {/* Cabeçalho da Seção */}
        <div className="text-center mb-16 md:mb-20 max-w-3xl mx-auto">
          <div className="flex justify-center mb-5">
            <SectionBadge icon={Sparkles}>Planos Transparentes</SectionBadge>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-[-0.02em] mb-5 leading-tight">
            <span className="bg-gradient-to-b from-white via-white to-white/70 bg-clip-text text-transparent">
              O investimento que se paga
            </span>{' '}
            <span className="bg-gradient-to-r from-[#60A5FA] via-[#3B82F6] to-[#93C5FD] bg-clip-text text-transparent">
              logo nos primeiros cortes.
            </span>
          </h2>
          <p className="text-base md:text-lg text-white/60 leading-relaxed">
            Sem contratos de fidelidade ou taxas escondidas. Escolha o plano perfeito para o momento do seu negócio e experimente com 7 dias grátis.
          </p>
        </div>

        {/* Grade Responsiva de Cartões (1 coluna em mobile, 3 colunas em desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-7 items-stretch">
          {PLANS.map((plan, index) => {
            const Icon = plan.icon;
            const isMaster = plan.highlight;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.12 }}
                className={`relative rounded-3xl flex flex-col justify-between transition-all duration-300 ${
                  isMaster
                    ? 'border-2 border-[#60A5FA] bg-[#0A1124] shadow-[0_20px_80px_rgba(37,99,235,0.28)] lg:-translate-y-3 z-10'
                    : 'border border-white/10 bg-white/[0.03] backdrop-blur-md hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                {/* Badge Superior Destacado para o Plano Master */}
                {isMaster && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] text-white text-[10px] md:text-[11px] font-black uppercase tracking-wider shadow-lg shadow-blue-500/30 whitespace-nowrap">
                      <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Linha de brilho superior interna no Master */}
                {isMaster && (
                  <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-[#60A5FA] to-transparent" />
                )}

                {/* Conteúdo Superior do Card */}
                <div className="p-7 md:p-8 flex-1 flex flex-col">
                  {/* Topo: Ícone + Tag de Segmento */}
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      isMaster
                        ? 'bg-[#2563EB]/20 text-[#60A5FA] ring-1 ring-[#60A5FA]/40 shadow-inner'
                        : 'bg-white/[0.05] text-white/70 ring-1 ring-white/10'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                      isMaster
                        ? 'bg-[#2563EB]/25 text-[#93C5FD] border border-[#60A5FA]/30'
                        : 'bg-white/[0.04] text-white/50 border border-white/5'
                    }`}>
                      {plan.tag}
                    </span>
                  </div>

                  {/* Nome e Descrição */}
                  <h3 className="text-2xl font-black text-white tracking-tight mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-xs md:text-sm text-white/60 leading-relaxed mb-6 min-h-[40px]">
                    {plan.desc}
                  </p>

                  {/* Bloco de Preço */}
                  <div className="pt-4 pb-6 border-y border-white/8 mb-6">
                    {plan.originalPrice && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-white/40 line-through">
                          De R$ {plan.originalPrice}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          -33% OFF
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-white/50">R$</span>
                      <span className="text-5xl md:text-6xl font-black text-white tracking-tight leading-none">
                        {plan.price}
                      </span>
                      <span className="text-lg font-bold text-white/60">
                        {plan.cents}
                      </span>
                      <span className="text-xs font-semibold text-white/40 ml-1">
                        {plan.billing}
                      </span>
                    </div>
                    <p className={`text-[11px] font-medium mt-2 leading-tight ${
                      isMaster ? 'text-blue-300' : 'text-white/45'
                    }`}>
                      {plan.periodNote}
                    </p>
                  </div>

                  {/* Lista de Recursos (Features) */}
                  <div className="space-y-3 flex-1 mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-3">
                      {isMaster ? 'Tudo que sua barbearia precisa:' : 'Recursos inclusos:'}
                    </p>
                    <ul className="space-y-2.5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isMaster
                              ? 'bg-emerald-400/20 text-emerald-300'
                              : 'bg-white/10 text-white/70'
                          }`}>
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                          <span className={`text-xs md:text-[13px] leading-snug ${
                            isMaster && (feature.includes('ilimitados') || feature.includes('CRM') || feature.includes('VIP'))
                              ? 'text-white font-semibold'
                              : 'text-white/75'
                          }`}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Rodapé do Card com CTA */}
                <div className="p-7 md:p-8 pt-0">
                  <Link to={plan.ctaLink} className="block w-full">
                    {isMaster ? (
                      <GlowButton className="w-full h-12 text-sm font-black justify-center shadow-lg shadow-blue-600/30">
                        {plan.ctaText}
                      </GlowButton>
                    ) : (
                      <button className="w-full h-12 rounded-xl text-sm font-bold text-white/90 bg-white/[0.05] hover:bg-white/[0.10] border border-white/15 hover:border-white/30 transition-all flex items-center justify-center gap-2 group cursor-pointer">
                        <span>{plan.ctaText}</span>
                        <ArrowRight className="w-4 h-4 text-white/50 group-hover:translate-x-1 group-hover:text-white transition-all" />
                      </button>
                    )}
                  </Link>

                  <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-white/40">
                    <Shield className="w-3.5 h-3.5 text-emerald-400/70" />
                    <span>7 dias grátis para testar</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Barra de Confiança e Garantias Inferior */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 md:mt-20 p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-around gap-5 text-center sm:text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Garantia Incondicional</p>
              <p className="text-[11px] text-white/50">Experimente 7 dias sem cobrança</p>
            </div>
          </div>

          <div className="hidden sm:block w-px h-8 bg-white/10" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Sem Fidelidade ou Multas</p>
              <p className="text-[11px] text-white/50">Cancele quando desejar em 1 clique</p>
            </div>
          </div>

          <div className="hidden sm:block w-px h-8 bg-white/10" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Ativação Imediata</p>
              <p className="text-[11px] text-white/50">Configure sua barbearia em 2 minutos</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
