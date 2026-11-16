// Seção recorrência — MRR/ARR/churn com gráfico animado, SpotlightCard e BlurReveal.
import { motion } from 'framer-motion';
import { Repeat, TrendingUp, Users } from 'lucide-react';
import SectionBadge from './SectionBadge';
import GlowButton from './GlowButton';
import { BlurReveal, SpotlightCard, EXPO_EASE } from '@/components/motion/MotionPrimitives';

export default function RecurrenceSection() {
  return (
    <section id="recorrencia" className="relative py-24 md:py-32 px-5 md:px-8">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
        {/* Visual */}
        <BlurReveal inView y={16} className="order-2 lg:order-1 relative">
          <SpotlightCard hoverLift={false} className="rounded-3xl p-6 shadow-lg dark:shadow-[0_24px_80px_rgba(37,99,235,0.22)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Receita recorrente mensal
                </div>
                <div className="text-3xl font-extrabold bg-gradient-to-r from-slate-900 to-[#1D4ED8] dark:from-white dark:to-[#93C5FD] bg-clip-text text-transparent mt-1 tabular-nums">
                  R$ 18.420
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25 tabular-nums">
                +42% / mês
              </span>
            </div>

            {/* Gráfico SVG animado */}
            <svg viewBox="0 0 400 140" className="w-full">
              <defs>
                <linearGradient id="rec-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="rec-line" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="100%" stopColor="#60A5FA" />
                </linearGradient>
              </defs>
              {[0, 35, 70, 105].map((y) => (
                <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="currentColor" className="text-slate-200 dark:text-white/[0.06]" />
              ))}
              <motion.path
                d="M0,110 L50,98 L100,90 L150,80 L200,65 L250,52 L300,38 L350,25 L400,15 L400,140 L0,140 Z"
                fill="url(#rec-grad)"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: 0.2, ease: EXPO_EASE }}
              />
              <motion.path
                d="M0,110 L50,98 L100,90 L150,80 L200,65 L250,52 L300,38 L350,25 L400,15"
                stroke="url(#rec-line)"
                strokeWidth="2.5"
                fill="none"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: EXPO_EASE }}
              />
              {[
                [50, 98], [150, 80], [250, 52], [350, 25],
              ].map(([x, y], i) => (
                <motion.circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#2563EB"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 + i * 0.12, ease: EXPO_EASE }}
                />
              ))}
            </svg>

            {/* Métricas inferiores */}
            <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-200 dark:border-white/[0.06]">
              {[
                { label: 'MRR', value: 'R$ 18,4k', icon: Repeat },
                { label: 'ARR', value: 'R$ 220k', icon: TrendingUp },
                { label: 'Churn', value: '1.8%', icon: Users },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    <m.icon className="w-3 h-3" strokeWidth={1.75} /> {m.label}
                  </div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">{m.value}</div>
                </div>
              ))}
            </div>
          </SpotlightCard>
        </BlurReveal>

        {/* Texto */}
        <BlurReveal inView delay={0.08} y={14} className="order-1 lg:order-2">
          <div className="mb-5"><SectionBadge icon={Repeat}>Recorrência</SectionBadge></div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-[-0.025em] leading-[1.02] mb-6">
            <span className="bg-gradient-to-b from-slate-900 to-slate-700 dark:from-white dark:to-white/70 bg-clip-text text-transparent">
              Receita previsível
            </span>
            <br />
            <span className="bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] dark:from-[#60A5FA] dark:to-[#3B82F6] bg-clip-text text-transparent">
              todo dia 1.
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-300/80 text-base md:text-lg leading-relaxed mb-8">
            Crie planos mensais (corte ilimitado, combos, premium) e cobre no automático via Asaas.
            Sua barbearia para de depender da movimentação do dia.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-9">
            {[
              { value: '3.2x', label: 'Mais previsibilidade' },
              { value: '+ 47%', label: 'Ticket por cliente' },
              { value: '< 2%', label: 'Churn mensal' },
            ].map((s) => (
              <SpotlightCard key={s.label} className="rounded-xl p-4">
                <div className="text-2xl font-extrabold bg-gradient-to-b from-slate-900 to-[#1D4ED8] dark:from-white dark:to-[#93C5FD] bg-clip-text text-transparent tabular-nums">
                  {s.value}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mt-1">
                  {s.label}
                </div>
              </SpotlightCard>
            ))}
          </div>

          <GlowButton to="/checkout">Quero faturar todo mês</GlowButton>
        </BlurReveal>
      </div>
    </section>
  );
}