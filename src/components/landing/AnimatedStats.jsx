// Banda de números premium — usado abaixo do hero. Brilho azul em cada métrica.
import { motion } from 'framer-motion';

const STATS = [
  { value: '+R$ 55k', label: 'Faturamento médio/mês' },
  { value: '3.2x', label: 'Aumento de recorrência' },
  { value: '98%', label: 'Retenção mensal' },
  { value: '2.4k+', label: 'Barbearias ativas' },
];

export default function AnimatedStats() {
  return (
    <section className="relative py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-md overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#2563EB]/10 via-transparent to-[#60A5FA]/10" />
          <div className="relative grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="text-center py-8 px-4"
              >
                <div className="text-3xl md:text-4xl font-black bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">
                  {s.value}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mt-2">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}