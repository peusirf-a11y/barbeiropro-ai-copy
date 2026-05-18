// Seção IA cinematográfica — sugestões da AI em cards live.
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Brain, AlertTriangle, TrendingUp, Crown, Sparkles, ArrowRight } from 'lucide-react';
import SectionBadge from './SectionBadge';
import GlowButton from './GlowButton';

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
  amber: { bg: 'from-amber-500/15 to-amber-500/0', text: 'text-amber-300', ring: 'ring-amber-500/20' },
  violet: { bg: 'from-violet-500/15 to-violet-500/0', text: 'text-violet-300', ring: 'ring-violet-500/20' },
  emerald: { bg: 'from-emerald-500/15 to-emerald-500/0', text: 'text-emerald-300', ring: 'ring-emerald-500/20' },
};

export default function AISection() {
  return (
    <section id="ia" className="relative py-24 md:py-32 px-5 md:px-8 overflow-hidden">
      {/* Glow de fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#2563EB]/10 blur-[140px]" />

      <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-5"><SectionBadge icon={Brain}>AI Growth Engine</SectionBadge></div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-[-0.025em] leading-[1.02] mb-6">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Uma IA que trabalha
            </span>
            <br />
            <span className="bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] bg-clip-text text-transparent">
              enquanto você corta.
            </span>
          </h2>
          <p className="text-white/55 text-base md:text-lg leading-relaxed mb-8">
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
                <span className="relative flex items-center justify-center w-5 h-5">
                  <span className="absolute inset-0 rounded-full bg-[#60A5FA]/30 blur-sm" />
                  <Sparkles className="relative w-3.5 h-3.5 text-[#93C5FD]" />
                </span>
                <span className="text-white/75">{f}</span>
              </div>
            ))}
          </div>

          <Link to="/demo/ai-growth">
            <GlowButton>Ver IA em ação</GlowButton>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative"
        >
          {/* Card container */}
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-md p-5 shadow-[0_24px_80px_rgba(37,99,235,0.25)]">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-xs font-semibold text-white/70">IA analisando agora</span>
              </div>
              <span className="text-[10px] font-mono text-white/30">3 insights · agora</span>
            </div>

            <div className="space-y-3">
              {AI_CARDS.map((c, i) => {
                const t = TONES[c.tone];
                return (
                  <motion.div
                    key={c.title}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="relative rounded-2xl border border-white/8 bg-[#0A1124] p-4 overflow-hidden group hover:border-white/15 transition-colors"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${t.bg} opacity-70`} />
                    <div className="relative flex items-start gap-3">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 ring-1 ${t.ring} flex items-center justify-center`}>
                        <c.icon className={`w-4 h-4 ${t.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div className="text-white font-semibold text-sm">{c.title}</div>
                          <span className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 ring-1 ${t.ring} ${t.text}`}>
                            {c.badge}
                          </span>
                        </div>
                        <p className="text-white/55 text-xs leading-relaxed">{c.desc}</p>
                        <button className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-white/80 hover:text-white transition-colors">
                          Aplicar sugestão <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Decoração lateral */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-[#60A5FA]/20 blur-2xl" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-[#2563EB]/20 blur-2xl" />
        </motion.div>
      </div>
    </section>
  );
}