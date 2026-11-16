// Seção IA cinematográfica — SpotlightCard + BlurReveal, sem pontos pulsantes decorativos.
import { Brain, AlertTriangle, TrendingUp, Crown, Sparkles, ArrowRight } from 'lucide-react';
import SectionBadge from './SectionBadge';
import GlowButton from './GlowButton';
import { BlurReveal, SpotlightCard } from '@/components/motion/MotionPrimitives';

const AI_CARDS = [
  {
    icon: AlertTriangle,
    tone: 'amber',
    title: '12 clientes em risco',
    desc: 'Última visita há +35 dias. Mensagem personalizada pronta.',
    badge: 'Prevenir churn',
  },
  {
    icon: Crown,
    tone: 'violet',
    title: '8 VIPs sumiram',
    desc: 'Gastaram +R$ 500 e não retornam há 21 dias. Prioridade máxima.',
    badge: 'Alta prioridade',
  },
  {
    icon: TrendingUp,
    tone: 'emerald',
    title: 'Oferte plano mensal pro João',
    desc: '6 cortes nos últimos 60 dias. Probabilidade de assinar: 87%.',
    badge: 'Recorrência',
  },
];

const TONES = {
  amber: { bg: 'from-amber-500/10 dark:from-amber-500/15 to-transparent', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-300/80 dark:ring-amber-500/25', spot: 'rgba(245, 158, 11, 0.12)' },
  violet: { bg: 'from-violet-500/10 dark:from-violet-500/15 to-transparent', text: 'text-violet-700 dark:text-violet-300', ring: 'ring-violet-300/80 dark:ring-violet-500/25', spot: 'rgba(139, 92, 246, 0.12)' },
  emerald: { bg: 'from-emerald-500/10 dark:from-emerald-500/15 to-transparent', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-300/80 dark:ring-emerald-500/25', spot: 'rgba(16, 185, 129, 0.12)' },
};

export default function AISection() {
  return (
    <section id="ia" className="relative py-24 md:py-32 px-5 md:px-8 overflow-hidden">
      {/* Glow de fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#2563EB]/5 dark:bg-[#2563EB]/10 blur-[140px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
        <BlurReveal inView y={14}>
          <div className="mb-5"><SectionBadge icon={Brain}>AI Growth Engine</SectionBadge></div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-[-0.025em] leading-[1.02] mb-6">
            <span className="bg-gradient-to-b from-slate-900 to-slate-700 dark:from-white dark:to-white/70 bg-clip-text text-transparent">
              Uma IA que trabalha
            </span>
            <br />
            <span className="bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] dark:from-[#60A5FA] dark:to-[#3B82F6] bg-clip-text text-transparent">
              enquanto você corta.
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-300/80 text-base md:text-lg leading-relaxed mb-8">
            Analisa o comportamento de cada cliente, prevê churn, sugere planos, identifica horários fracos
            e gera mensagens prontas. Tudo automático, 24/7.
          </p>

          <div className="space-y-3 mb-9">
            {[
              'Detecção preditiva de clientes sumindo',
              'Sugestão automática de planos por perfil',
              'Análise de horários com baixa demanda',
              'Mensagens personalizadas prontas pra enviar',
            ].map((f) => (
              <div key={f} className="flex items-center gap-3 text-sm">
                <span className="relative flex items-center justify-center w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-400/25">
                  <Sparkles className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#93C5FD]" strokeWidth={1.75} />
                </span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">{f}</span>
              </div>
            ))}
          </div>

          <GlowButton to="/demo/ai-growth">Ver IA em ação</GlowButton>
        </BlurReveal>

        <BlurReveal inView delay={0.1} y={16} className="relative">
          <SpotlightCard hoverLift={false} className="rounded-3xl p-5 shadow-lg dark:shadow-[0_24px_80px_rgba(37,99,235,0.22)]">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                <span className="text-xs font-semibold text-slate-800 dark:text-white/85">Diagnóstico inteligente</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">3 insights · agora</span>
            </div>

            <div className="space-y-3">
              {AI_CARDS.map((c, i) => {
                const t = TONES[c.tone];
                return (
                  <BlurReveal key={c.title} inView delay={0.12 + i * 0.06} y={8}>
                    <SpotlightCard
                      spotlightColor={t.spot}
                      className="rounded-2xl bg-slate-50/85 dark:bg-[#0A1124]/95 p-4"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${t.bg} opacity-75 pointer-events-none`} />
                      <div className="relative flex items-start gap-3">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-white dark:bg-white/[0.05] ring-1 ${t.ring} flex items-center justify-center shadow-xs dark:shadow-none`}>
                          <c.icon className={`w-4 h-4 ${t.text}`} strokeWidth={1.75} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="text-slate-900 dark:text-white font-semibold text-sm">{c.title}</div>
                            <span className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/90 dark:bg-white/[0.05] ring-1 ${t.ring} ${t.text}`}>
                              {c.badge}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300/80 text-xs leading-relaxed tabular-nums">{c.desc}</p>
                          <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1D4ED8] dark:text-white/85">
                            Aplicar sugestão <ArrowRight className="w-3 h-3" strokeWidth={1.75} />
                          </span>
                        </div>
                      </div>
                    </SpotlightCard>
                  </BlurReveal>
                );
              })}
            </div>
          </SpotlightCard>
        </BlurReveal>
      </div>
    </section>
  );
}