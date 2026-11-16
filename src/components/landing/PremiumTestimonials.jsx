// Depoimentos premium com retratos locais gerados e SpotlightCard.
import { useState } from 'react';
import { Quote, Star } from 'lucide-react';
import SectionBadge from './SectionBadge';
import { BlurReveal, SpotlightCard } from '@/components/motion/MotionPrimitives';
import marcosPortrait from '@/assets/images/barber_owner_marcos_1794740517857.jpg';
import rafaelPortrait from '@/assets/images/barber_owner_rafael_1794740518793.jpg';
import lucasPortrait from '@/assets/images/barber_owner_lucas_1794740519124.jpg';

const TESTIMONIALS = [
  {
    name: 'Marcos Vieira',
    initials: 'MV',
    role: 'Dono · Sherman Cuts Center',
    photo: marcosPortrait,
    quote: 'Em 90 dias somos outra barbearia. Sai do caderninho e fui pra R$ 55 mil de faturamento. A IA recupera cliente que eu nem sabia que tinha sumido.',
    metric: '+R$ 55 mil/mês',
    rating: 5,
  },
  {
    name: 'Rafael Costa',
    initials: 'RC',
    role: 'Dono · The Barber Co.',
    photo: rafaelPortrait,
    quote: 'Os planos mensais mudaram tudo. Hoje recebo R$ 18 mil todo dia 1 antes de cortar o primeiro cliente. Isso é outro patamar de negócio.',
    metric: 'R$ 18k MRR',
    rating: 5,
  },
  {
    name: 'Lucas Almeida',
    initials: 'LA',
    role: 'Dono · Don Barber Studio',
    photo: lucasPortrait,
    quote: 'Reduzi 70% das faltas só com a confirmação automática. E os relatórios me mostram tudo: quem some, quem volta, quanto cada barbeiro fatura.',
    metric: '−70% faltas',
    rating: 5,
  },
];

function TestimonialPortrait({ src, alt, initials }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#172554] via-[#0F172A] to-[#050816] flex items-center justify-center">
        <span className="text-3xl font-extrabold tracking-tight text-blue-200/80">{initials}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover object-top grayscale-[15%] group-hover/spot:grayscale-0 group-hover/spot:scale-105 transition-[transform,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      loading="lazy"
    />
  );
}

export default function PremiumTestimonials() {
  return (
    <section className="relative py-24 md:py-32 px-5 md:px-8">
      <div className="max-w-7xl mx-auto">
        <BlurReveal inView className="text-center mb-14 max-w-2xl mx-auto">
          <div className="flex justify-center mb-5"><SectionBadge>Quem usa</SectionBadge></div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.025em] mb-5">
            <span className="bg-gradient-to-b from-white to-white/75 bg-clip-text text-transparent">
              Barbearias que decidiram crescer.
            </span>
          </h2>
        </BlurReveal>

        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <BlurReveal key={t.name} inView delay={i * 0.08} y={14}>
              <SpotlightCard className="rounded-3xl overflow-hidden h-full">
                <div className="flex flex-col h-full">
                  {/* Foto */}
                  <div className="relative h-56 overflow-hidden">
                    <TestimonialPortrait src={t.photo} alt={t.name} initials={t.initials} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-[#050816]/40 to-transparent pointer-events-none" />
                    {/* Métrica destaque */}
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-200 truncate">{t.role}</div>
                      <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30 backdrop-blur tabular-nums whitespace-nowrap">
                        {t.metric}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <Quote className="w-6 h-6 text-[#60A5FA]/45 mb-3" strokeWidth={1.75} />
                      <p className="text-slate-200 text-sm leading-relaxed mb-4">"{t.quote}"</p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                      <div className="text-white font-bold text-sm">{t.name}</div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: t.rating }).map((_, j) => (
                          <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            </BlurReveal>
          ))}
        </div>
      </div>
    </section>
  );
}