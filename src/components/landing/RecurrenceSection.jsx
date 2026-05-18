// Seção recorrência — MRR/ARR/churn com gráfico animado.
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Repeat, TrendingUp, Users } from 'lucide-react';
import SectionBadge from './SectionBadge';
import GlowButton from './GlowButton';

export default function RecurrenceSection() {
  return (
    <section id="recorrencia" className="relative py-24 md:py-32 px-5 md:px-8">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="order-2 lg:order-1 relative"
        >
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-md p-6 shadow-[0_24px_80px_rgba(37,99,235,0.25)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Receita recorrente mensal</div>
                <div className="text-3xl font-black bg-gradient-to-r from-white to-[#93C5FD] bg-clip-text text-transparent mt-1">R$ 18.420</div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20">
                +42% / mês
              </span>
            </div>

            {/* Gráfico SVG animado */}
            <svg viewBox="0 0 400 140" className="w-full">
              <defs>
                <linearGradient id="rec-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="rec-line" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#93C5FD" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {[0, 35, 70, 105].map((y) => (
                <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="rgba(255,255,255,0.05)" />
              ))}
              <motion.path
                d="M0,110 L50,98 L100,90 L150,80 L200,65 L250,52 L300,38 L350,25 L400,15 L400,140 L0,140 Z"
                fill="url(#rec-grad)"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.3 }}
              />
              <motion.path
                d="M0,110 L50,98 L100,90 L150,80 L200,65 L250,52 L300,38 L350,25 L400,15"
                stroke="url(#rec-line)"
                strokeWidth="2.5"
                fill="none"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
              />
              {/* Dots */}
              {[
                [50, 98], [150, 80], [250, 52], [350, 25],
              ].map(([x, y], i) => (
                <motion.circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#60A5FA"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 + i * 0.15 }}
                />
              ))}
            </svg>

            {/* Métricas inferiores */}
            <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/5">
              {[
                { label: 'MRR', value: 'R$ 18,4k', icon: Repeat },
                { label: 'ARR', value: 'R$ 220k', icon: TrendingUp },
                { label: 'Churn', value: '1.8%', icon: Users },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-1">
                    <m.icon className="w-3 h-3" /> {m.label}
                  </div>
                  <div className="text-base font-black text-white">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Texto */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="order-1 lg:order-2"
        >
          <div className="mb-5"><SectionBadge icon={Repeat}>Recorrência</SectionBadge></div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-[-0.025em] leading-[1.02] mb-6">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Receita previsível
            </span>
            <br />
            <span className="bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] bg-clip-text text-transparent">
              todo dia 1.
            </span>
          </h2>
          <p className="text-white/55 text-base md:text-lg leading-relaxed mb-8">
            Crie planos mensais (corte ilimitado, combos, premium) e cobre no automático via Stripe.
            Sua barbearia para de depender da movimentação do dia.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-9">
            {[
              { value: '3.2x', label: 'Mais previsibilidade' },
              { value: '+ 47%', label: 'Ticket por cliente' },
              { value: '< 2%', label: 'Churn mensal' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <div className="text-2xl font-black bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">{s.value}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <Link to="/checkout">
            <GlowButton>Quero faturar todo mês</GlowButton>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}