// Comparação com métodos antigos — SpotlightCard + BlurReveal + contraste limpo.
import { Check, X } from 'lucide-react';
import SectionBadge from './SectionBadge';
import { BlurReveal, SpotlightCard } from '@/components/motion/MotionPrimitives';

const ROWS = [
  { feature: 'Agenda online 24/7', old: false, oc: true },
  { feature: 'IA detectando clientes sumindo', old: false, oc: true },
  { feature: 'Confirmação automática no WhatsApp', old: false, oc: true },
  { feature: 'Planos mensais com cobrança automática', old: false, oc: true },
  { feature: 'Relatórios de faturamento em tempo real', old: false, oc: true },
  { feature: 'Multi-unidade integrada', old: false, oc: true },
  { feature: 'Caderninho na recepção', old: true, oc: false },
  { feature: 'Cliente ligando pra agendar', old: true, oc: false },
];

export default function ComparisonTable() {
  return (
    <section className="relative py-24 md:py-32 px-5 md:px-8">
      <div className="max-w-5xl mx-auto">
        <BlurReveal inView className="text-center mb-12 max-w-2xl mx-auto">
          <div className="flex justify-center mb-5"><SectionBadge>Antes vs depois</SectionBadge></div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.025em] mb-5">
            <span className="bg-gradient-to-b from-slate-900 to-slate-700 dark:from-white dark:to-white/75 bg-clip-text text-transparent">
              Pare de operar como em 2010.
            </span>
          </h2>
        </BlurReveal>

        <BlurReveal inView delay={0.08} y={14}>
          <SpotlightCard hoverLift={false} className="rounded-3xl overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto]">
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Recurso</span>
              </div>
              <div className="px-3 md:px-6 py-5 border-b border-l border-slate-200 dark:border-white/[0.06] text-center min-w-[90px] md:min-w-[120px]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Método antigo</span>
              </div>
              <div className="px-3 md:px-6 py-5 border-b border-l border-slate-200 dark:border-white/[0.06] text-center min-w-[90px] md:min-w-[120px] bg-blue-50/75 dark:bg-[#2563EB]/10">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] dark:from-[#60A5FA] dark:to-[#3B82F6] bg-clip-text text-transparent whitespace-nowrap">
                  O CORTE
                </span>
              </div>

              {/* Rows */}
              {ROWS.map((r, i) => (
                <div key={r.feature} className="contents">
                  <div className={`px-6 py-4 text-sm font-medium text-slate-800 dark:text-slate-200 ${i < ROWS.length - 1 ? 'border-b border-slate-100 dark:border-white/[0.05]' : ''}`}>
                    {r.feature}
                  </div>
                  <div className={`px-3 md:px-6 py-4 border-l border-slate-100 dark:border-white/[0.05] flex items-center justify-center ${i < ROWS.length - 1 ? 'border-b' : ''}`}>
                    {r.old ? (
                      <Check className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                    ) : (
                      <X className="w-4 h-4 text-rose-500 dark:text-rose-400/75" strokeWidth={1.75} />
                    )}
                  </div>
                  <div className={`px-3 md:px-6 py-4 border-l border-slate-100 dark:border-white/[0.05] flex items-center justify-center bg-blue-50/60 dark:bg-[#2563EB]/10 ${i < ROWS.length - 1 ? 'border-b' : ''}`}>
                    {r.oc ? (
                      <span className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/15 dark:border-emerald-400/30 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.25} />
                      </span>
                    ) : (
                      <X className="w-4 h-4 text-slate-400 dark:text-slate-400/50" strokeWidth={1.75} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SpotlightCard>
        </BlurReveal>
      </div>
    </section>
  );
}