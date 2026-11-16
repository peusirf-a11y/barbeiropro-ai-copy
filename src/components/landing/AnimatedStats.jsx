// Banda de números premium com CountUpValue (React Bits) e SpotlightCard (TasteSkill).
import { BlurReveal, CountUpValue, SpotlightCard, HairlineDivider } from '@/components/motion/MotionPrimitives';

const STATS = [
  { to: 55, prefix: '+R$ ', suffix: 'k', decimals: 0, label: 'Faturamento médio/mês' },
  { to: 3.2, prefix: '', suffix: 'x', decimals: 1, label: 'Aumento de recorrência' },
  { to: 98, prefix: '', suffix: '%', decimals: 0, label: 'Retenção mensal' },
  { to: 2.4, prefix: '', suffix: 'k+', decimals: 1, label: 'Barbearias ativas' },
];

export default function AnimatedStats() {
  return (
    <section className="relative py-14 px-6">
      <div className="max-w-6xl mx-auto">
        <HairlineDivider className="mb-10" />
        <SpotlightCard hoverLift={false} className="rounded-3xl border-white/[0.09] bg-[#0B1121]/80">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
            {STATS.map((s, i) => (
              <BlurReveal
                key={s.label}
                inView
                delay={i * 0.06}
                y={10}
                className="text-center py-8 px-4"
              >
                <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">
                  <CountUpValue
                    to={s.to}
                    prefix={s.prefix}
                    suffix={s.suffix}
                    decimals={s.decimals}
                  />
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-2">
                  {s.label}
                </div>
              </BlurReveal>
            ))}
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}