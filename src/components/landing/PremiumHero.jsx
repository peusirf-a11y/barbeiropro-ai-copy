// Hero cinematográfico — BlurReveal, tipografia display refinada e mockup com SpotlightCard.
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Calendar, TrendingUp, Users, Zap, ShieldCheck, Clock } from 'lucide-react';
import GlowButton from './GlowButton';
import SectionBadge from './SectionBadge';
import { BlurReveal, SpotlightCard, EXPO_EASE } from '@/components/motion/MotionPrimitives';

export default function PremiumHero() {
  return (
    <section className="relative pt-32 md:pt-40 pb-20 px-5 md:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Conteúdo central */}
        <div className="text-center max-w-4xl mx-auto">
          <BlurReveal delay={0} y={8} className="flex justify-center mb-7">
            <SectionBadge icon={Sparkles}>Plataforma com IA · Gestão em Tempo Real</SectionBadge>
          </BlurReveal>

          <BlurReveal delay={0.06} y={14}>
            <h1 className="text-[40px] sm:text-6xl md:text-7xl lg:text-[84px] font-extrabold leading-[0.96] tracking-[-0.03em] mb-6">
              <span className="block bg-gradient-to-b from-white via-white to-white/70 bg-clip-text text-transparent">
                Transforme sua barbearia
              </span>
              <span className="block bg-gradient-to-r from-[#60A5FA] via-[#93C5FD] to-[#3B82F6] bg-clip-text text-transparent">
                numa máquina de recorrência.
              </span>
            </h1>
          </BlurReveal>

          <BlurReveal delay={0.12} y={12}>
            <p className="text-base md:text-xl text-slate-300/80 max-w-2xl mx-auto leading-relaxed mb-7">
              Agenda, financeiro, planos mensais e uma{' '}
              <span className="text-white font-semibold">IA que detecta clientes sumindo</span> e
              recupera receita automaticamente. Tudo num só lugar.
            </p>
          </BlurReveal>

          <BlurReveal delay={0.16} y={10}>
            <Link
              to="/checkout?promo=lancamento"
              className="block max-w-2xl mx-auto mb-8 rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-amber-500/5 backdrop-blur-md p-4 text-left hover:border-amber-400/65 hover:-translate-y-0.5 transition-[transform,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer group"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-12 transition-transform" />
                OFERTA DE LANÇAMENTO ATIVA · Clique para aproveitar
              </div>
              <p className="text-xs sm:text-sm text-amber-100 font-medium leading-relaxed">
                Plano <strong className="font-bold">Master</strong> com condição especial:{' '}
                <strong className="font-bold tabular-nums">R$ 79,00/mês nos primeiros 3 meses</strong>. Depois,{' '}
                <span className="tabular-nums">R$ 119,00/mês</span>. Experimente com 7 dias grátis →
              </p>
            </Link>
          </BlurReveal>

          <BlurReveal delay={0.2} y={10}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
              <GlowButton to="/checkout?promo=lancamento" className="w-full sm:w-auto">
                Começar agora — 7 dias grátis
              </GlowButton>
              <GlowButton to="/login" variant="ghost" className="w-full sm:w-auto border border-white/20 bg-white/5 hover:bg-white/10">
                Entrar na minha conta
              </GlowButton>
              <GlowButton to="/demo/dashboard" variant="ghost" className="w-full sm:w-auto text-white/75 hover:text-white">
                Ver a plataforma
              </GlowButton>
            </div>
          </BlurReveal>

          <BlurReveal delay={0.24} y={6}>
            <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#60A5FA]" strokeWidth={1.75} />
                Setup em 5 minutos
              </span>
              <span className="hidden sm:flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#60A5FA]" strokeWidth={1.75} />
                Suporte 24/7
              </span>
            </div>
          </BlurReveal>
        </div>

        {/* Mockup principal flutuante */}
        <motion.div
          initial={{ opacity: 0, y: 32, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, delay: 0.25, ease: EXPO_EASE }}
          className="relative mt-16 md:mt-20"
        >
          {/* Glow atrás do mockup */}
          <div className="absolute -inset-x-16 -top-8 -bottom-16 bg-gradient-to-b from-[#2563EB]/25 via-[#60A5FA]/10 to-transparent blur-3xl pointer-events-none" />

          <div className="relative max-w-5xl mx-auto">
            <SpotlightCard
              hoverLift={false}
              spotlightColor="rgba(96, 165, 250, 0.12)"
              className="rounded-2xl border-white/[0.10] bg-[#0A1124]/95 shadow-[0_30px_110px_rgba(37,99,235,0.28)]"
            >
              {/* Topbar fake */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-white/[0.02]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="ml-3 text-[11px] text-slate-400 font-mono">app.ocorte.com/dashboard</span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300/90 hidden sm:inline">
                  Sessão Segura · Sync Ativo
                </span>
              </div>

              {/* Dashboard preview */}
              <div className="p-5 md:p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-bold text-base">Boa noite, João</div>
                    <div className="text-slate-400 text-xs mt-0.5">Domingo, 18 de maio · O CORTE</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { icon: TrendingUp, label: 'Faturamento', value: 'R$ 12.480', tone: 'from-emerald-500/20 to-emerald-500/0', text: 'text-emerald-300' },
                    { icon: Calendar, label: 'Agendamentos', value: '47', tone: 'from-blue-500/20 to-blue-500/0', text: 'text-blue-300' },
                    { icon: Users, label: 'Clientes ativos', value: '892', tone: 'from-violet-500/20 to-violet-500/0', text: 'text-violet-300' },
                    { icon: Zap, label: 'MRR ativo', value: 'R$ 8.7k', tone: 'from-amber-500/20 to-amber-500/0', text: 'text-amber-300' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="relative rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 overflow-hidden">
                      <div className={`absolute inset-0 bg-gradient-to-br ${kpi.tone} opacity-60`} />
                      <div className="relative">
                        <kpi.icon className={`w-4 h-4 ${kpi.text} mb-2`} strokeWidth={1.75} />
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</div>
                        <div className="text-lg md:text-xl font-extrabold text-white mt-0.5 tabular-nums">{kpi.value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Gráfico preview */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Receita últimos 30 dias</div>
                    <span className="text-emerald-300 text-xs font-bold tabular-nums">+34%</span>
                  </div>
                  <svg viewBox="0 0 400 80" className="w-full h-16">
                    <defs>
                      <linearGradient id="hero-grad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,60 L40,52 L80,55 L120,42 L160,46 L200,30 L240,34 L280,22 L320,26 L360,12 L400,18 L400,80 L0,80 Z"
                      fill="url(#hero-grad)"
                    />
                    <path
                      d="M0,60 L40,52 L80,55 L120,42 L160,46 L200,30 L240,34 L280,22 L320,26 L360,12 L400,18"
                      stroke="#60A5FA"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                </div>
              </div>
            </SpotlightCard>
          </div>
        </motion.div>
      </div>
    </section>
  );
}