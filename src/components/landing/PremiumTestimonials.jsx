// Depoimentos premium com fotos grandes e resultados financeiros.
import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import SectionBadge from './SectionBadge';

const TESTIMONIALS = [
  {
    name: 'Marcos Vieira',
    role: 'Dono · Sherman Cuts Center',
    photo: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop',
    quote: 'Em 90 dias somos outra barbearia. Sai do caderninho e fui pra R$ 55 mil de faturamento. A IA recupera cliente que eu nem sabia que tinha sumido.',
    metric: '+R$ 55 mil/mês',
    rating: 5,
  },
  {
    name: 'Rafael Costa',
    role: 'Dono · The Barber Co.',
    photo: 'https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=400&h=400&fit=crop',
    quote: 'Os planos mensais mudaram tudo. Hoje recebo R$ 18 mil todo dia 1 antes de cortar o primeiro cliente. Isso é outro patamar de negócio.',
    metric: 'R$ 18k MRR',
    rating: 5,
  },
  {
    name: 'Lucas Almeida',
    role: 'Dono · Don Barber Studio',
    photo: 'https://images.unsplash.com/photo-1503443207922-dff7d543fd0e?w=400&h=400&fit=crop',
    quote: 'Reduzi 70% das faltas só com a confirmação automática. E os relatórios me mostram tudo: quem some, quem volta, quanto cada barbeiro fatura.',
    metric: '−70% faltas',
    rating: 5,
  },
];

export default function PremiumTestimonials() {
  return (
    <section className="relative py-24 md:py-32 px-5 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <div className="flex justify-center mb-5"><SectionBadge>Quem usa</SectionBadge></div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-5">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Barbearias que decidiram crescer.
            </span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-md overflow-hidden group hover:border-[#60A5FA]/30 transition-colors"
            >
              {/* Foto */}
              <div className="relative h-56 overflow-hidden">
                <img
                  src={t.photo}
                  alt={t.name}
                  className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-[#050816]/40 to-transparent" />
                {/* Métrica destaque */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <div className="text-xs font-semibold text-white/70">{t.role}</div>
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30 backdrop-blur">
                    {t.metric}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <Quote className="w-6 h-6 text-[#60A5FA]/40 mb-3" />
                <p className="text-white/80 text-sm leading-relaxed mb-4">"{t.quote}"</p>
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div>
                    <div className="text-white font-bold text-sm">{t.name}</div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}