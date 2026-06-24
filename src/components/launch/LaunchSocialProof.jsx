// Seção prova social — placeholders elegantes enquanto não há depoimentos reais
import { motion } from 'framer-motion';
import { Quote, Users } from 'lucide-react';
import SectionBadge from '@/components/landing/SectionBadge';

// Slots intencionalmente vazios — preenchidos quando houver depoimentos reais
const SLOTS = [1, 2, 3];

export default function LaunchSocialProof() {
  return (
    <section className="relative py-24 px-5 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="flex justify-center mb-5">
            <SectionBadge icon={Users}>Quem está chegando primeiro</SectionBadge>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-4">
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Seja uma das primeiras barbearias a participar
            </span>
          </h2>
          <p className="text-base text-white/60">
            O CORTE está em fase de lançamento. Os depoimentos das primeiras barbearias parceiras aparecem aqui em breve.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {SLOTS.map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="relative rounded-2xl border border-dashed border-white/12 bg-white/[0.02] backdrop-blur-md p-6 overflow-hidden"
            >
              <Quote className="w-7 h-7 text-white/15 mb-4" />

              {/* Skeleton de texto */}
              <div className="space-y-2 mb-5">
                <div className="h-2.5 rounded-full bg-white/[0.06] w-full" />
                <div className="h-2.5 rounded-full bg-white/[0.06] w-[92%]" />
                <div className="h-2.5 rounded-full bg-white/[0.06] w-[78%]" />
              </div>

              {/* Skeleton de autor */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/8">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-white/[0.03] border border-white/8" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 rounded-full bg-white/[0.08] w-24" />
                  <div className="h-2 rounded-full bg-white/[0.05] w-32" />
                </div>
              </div>

              <div className="absolute top-4 right-4 text-[9px] font-bold uppercase tracking-wider text-white/30">
                Em breve
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}