// Banda de resultados premium — SpotlightCard + CountUpValue + BlurReveal.
import SectionBadge from './SectionBadge';
import { BlurReveal, CountUpValue, SpotlightCard } from '@/components/motion/MotionPrimitives';

const RESULTS = [
  { to: 55, prefix: '+R$ ', suffix: ' mil', decimals: 0, label: 'Faturamento médio em 90 dias', spot: 'rgba(16, 185, 129, 0.14)', tone: 'from-emerald-500/15' },
  { to: 3, prefix: '', suffix: 'x', decimals: 0, label: 'Mais recorrência mensal', spot: 'rgba(96, 165, 250, 0.16)', tone: 'from-blue-500/15' },
  { to: 68, prefix: '−', suffix: '%', decimals: 0, label: 'Faltas e no-shows', spot: 'rgba(167, 139, 250, 0.14)', tone: 'from-violet-500/15' },
  { to: 92, prefix: '', suffix: '%', decimals: 0, label: 'Agendamentos online', spot: 'rgba(245, 158, 11, 0.14)', tone: 'from-amber-500/15' },
];

export default function ResultsBand() {
  return (
    <section id="resultados" className="relative py-24 md:py-32 px-5 md:px-8">
      <div className="max-w-7xl mx-auto">
        <BlurReveal inView className="text-center mb-14 max-w-2xl mx-auto">
          <div className="flex justify-center mb-5"><SectionBadge>Resultados reais</SectionBadge></div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.025em] mb-5">
            <span className="bg-gradient-to-b from-white to-white/75 bg-clip-text text-transparent">
              Números que mudam o jogo.
            </span>
          </h2>
          <p className="text-slate-300/75 text-base md:text-lg">Média dos clientes em 90 dias usando O CORTE.</p>
        </BlurReveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {RESULTS.map((r, i) => (
            <BlurReveal key={r.label} inView delay={i * 0.06} y={12}>
              <SpotlightCard spotlightColor={r.spot} className="rounded-2xl p-6 md:p-8 h-full">
                <div className={`absolute inset-0 bg-gradient-to-br ${r.tone} to-transparent opacity-60 pointer-events-none`} />
                <div className="relative">
                  <div className="text-3xl md:text-5xl font-extrabold bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">
                    <CountUpValue to={r.to} prefix={r.prefix} suffix={r.suffix} decimals={r.decimals} />
                  </div>
                  <div className="text-xs md:text-sm text-slate-300/80 mt-2 leading-snug">{r.label}</div>
                </div>
              </SpotlightCard>
            </BlurReveal>
          ))}
        </div>
      </div>
    </section>
  );
}