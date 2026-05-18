// Banda de resultados premium — números fortes em cards glow.
import { motion } from 'framer-motion';
import SectionBadge from './SectionBadge';

const RESULTS = [
  { value: '+R$ 55 mil', label: 'Faturamento médio em 90 dias', tone: 'from-emerald-500/20' },
  { value: '3x', label: 'Mais recorrência mensal', tone: 'from-blue-500/20' },
  { value: '−68%', label: 'Faltas e no-shows', tone: 'from-violet-500/20' },
  { value: '92%', label: 'Agendamentos online', tone: 'from-amber-500/20' },
];

export default function ResultsBand() {
  return (
    <section id="resultados" className="relative py-24 md:py-32 px-5 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <div className="flex justify-center mb-5"><SectionBadge>Resultados reais</SectionBadge></div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-5">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Números que mudam o jogo.
            </span>
          </h2>
          <p className="text-white/50 text-base md:text-lg">Média dos clientes em 90 dias usando O CORTE.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {RESULTS.map((r, i) => (
            <motion.div
              key={r.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="relative rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6 md:p-8 overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${r.tone} to-transparent opacity-60`} />
              <div className="relative">
                <div className="text-3xl md:text-5xl font-black bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">
                  {r.value}
                </div>
                <div className="text-xs md:text-sm text-white/55 mt-2 leading-snug">{r.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}