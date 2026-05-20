// Hero cinematográfico — headline gigante + mockup glowing flutuante.
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Calendar, TrendingUp, Users, Zap } from 'lucide-react';
import GlowButton from './GlowButton';
import SectionBadge from './SectionBadge';

export default function PremiumHero() {
  return (
    <section className="relative pt-36 md:pt-40 pb-20 px-5 md:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Conteúdo central */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="flex justify-center mb-7">
            <SectionBadge icon={Sparkles}>Plataforma com IA · Live agora</SectionBadge>
          </div>

          <h1 className="text-[42px] sm:text-6xl md:text-7xl lg:text-[88px] font-black leading-[0.95] tracking-[-0.03em] mb-6">
            <span className="block bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">
              Transforme sua barbearia
            </span>
            <span className="block bg-gradient-to-r from-[#60A5FA] via-[#93C5FD] to-[#3B82F6] bg-clip-text text-transparent">
              numa máquina de recorrência.
            </span>
          </h1>

          <p className="text-base md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed mb-10">
            Agenda, financeiro, planos mensais e uma <span className="text-white/90 font-semibold">IA que detecta clientes sumindo</span> e
            recupera receita automaticamente. Tudo num só lugar.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <Link to="/checkout">
              <GlowButton className="w-full sm:w-auto">Começar agora — 7 dias grátis</GlowButton>
            </Link>
            <Link to="/demo/dashboard">
              <GlowButton variant="ghost" className="w-full sm:w-auto">Ver a plataforma</GlowButton>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-white/40">
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] animate-pulse" /> Setup em 5 minutos</span>
            <span className="hidden sm:flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] animate-pulse" /> Suporte 24/7</span>
          </div>
        </motion.div>

        {/* Mockup principal flutuante */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="relative mt-16 md:mt-20"
        >
          {/* Glow atrás do mockup */}
          <div className="absolute -inset-x-20 -top-10 -bottom-20 bg-gradient-to-b from-[#2563EB]/30 via-[#60A5FA]/10 to-transparent blur-3xl" />

          <div className="relative max-w-5xl mx-auto">
            {/* Reflexo gradient na borda */}
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-white/20 via-white/5 to-transparent" />

            <div className="relative rounded-2xl border border-white/10 bg-[#0A1124] overflow-hidden shadow-[0_30px_120px_rgba(37,99,235,0.35)]">
              {/* Topbar fake */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="ml-3 text-[11px] text-white/40 font-mono">app.ocorte.com/dashboard</span>
              </div>

              {/* Dashboard fake */}
              <div className="p-5 md:p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white/95 font-bold text-base">Boa noite, João</div>
                    <div className="text-white/40 text-xs mt-0.5">Domingo, 18 de maio · O CORTE</div>
                  </div>
                  <div className="hidden md:flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20">
                      ● AO VIVO
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { icon: TrendingUp, label: 'Faturamento', value: 'R$ 12.480', tone: 'from-emerald-500/20 to-emerald-500/0', text: 'text-emerald-300' },
                    { icon: Calendar, label: 'Agendamentos', value: '47', tone: 'from-blue-500/20 to-blue-500/0', text: 'text-blue-300' },
                    { icon: Users, label: 'Clientes ativos', value: '892', tone: 'from-violet-500/20 to-violet-500/0', text: 'text-violet-300' },
                    { icon: Zap, label: 'MRR ativo', value: 'R$ 8.7k', tone: 'from-amber-500/20 to-amber-500/0', text: 'text-amber-300' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="relative rounded-xl border border-white/8 bg-white/[0.02] p-4 overflow-hidden">
                      <div className={`absolute inset-0 bg-gradient-to-br ${kpi.tone} opacity-60`} />
                      <div className="relative">
                        <kpi.icon className={`w-4 h-4 ${kpi.text} mb-2`} />
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{kpi.label}</div>
                        <div className="text-lg md:text-xl font-black text-white mt-0.5">{kpi.value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Gráfico fake */}
                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Receita últimos 30 dias</div>
                    <span className="text-emerald-300 text-xs font-bold">+34%</span>
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
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}