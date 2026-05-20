// Comparação com métodos antigos — antes vs depois.
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import SectionBadge from './SectionBadge';

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
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <div className="flex justify-center mb-5"><SectionBadge>Antes vs depois</SectionBadge></div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-5">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Pare de operar como em 2010.
            </span>
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-white/[0.01] backdrop-blur-md overflow-hidden"
        >
          <div className="grid grid-cols-[1fr_auto_auto]">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Recurso</span>
            </div>
            <div className="px-3 md:px-6 py-5 border-b border-l border-white/5 text-center min-w-[90px] md:min-w-[120px]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Método antigo</span>
            </div>
            <div className="px-3 md:px-6 py-5 border-b border-l border-white/5 text-center min-w-[90px] md:min-w-[120px] bg-[#2563EB]/10">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] bg-clip-text text-transparent whitespace-nowrap">O CORTE</span>
            </div>

            {/* Rows */}
            {ROWS.map((r, i) => (
              <div key={r.feature} className="contents">
                <div className={`px-6 py-4 text-sm text-white/80 ${i < ROWS.length - 1 ? 'border-b border-white/5' : ''}`}>
                  {r.feature}
                </div>
                <div className={`px-3 md:px-6 py-4 border-l border-white/5 flex items-center justify-center ${i < ROWS.length - 1 ? 'border-b' : ''}`}>
                  {r.old ? (
                    <Check className="w-4 h-4 text-white/40" />
                  ) : (
                    <X className="w-4 h-4 text-rose-400/70" />
                  )}
                </div>
                <div className={`px-3 md:px-6 py-4 border-l border-white/5 flex items-center justify-center bg-[#2563EB]/10 ${i < ROWS.length - 1 ? 'border-b' : ''}`}>
                  {r.oc ? (
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-emerald-400/40 blur-md" />
                      <Check className="relative w-4 h-4 text-emerald-300" />
                    </div>
                  ) : (
                    <X className="w-4 h-4 text-white/30" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}