// Seção benefícios — números grandes destacados
import { motion } from 'framer-motion';
import { TrendingDown, LayoutDashboard, Award, Clock, Sparkles } from 'lucide-react';
import SectionBadge from '@/components/landing/SectionBadge';

const BENEFITS = [
  { icon: TrendingDown, value: '70%', label: 'Menos faltas', desc: 'Lembretes automáticos por WhatsApp reduzem ausências.' },
  { icon: LayoutDashboard, value: '100%', label: 'Mais organização', desc: 'Agenda, finanças e equipe num só lugar.' },
  { icon: Award, value: '+1', label: 'Nível de profissionalismo', desc: 'Sua barbearia opera como uma rede grande.' },
  { icon: Clock, value: '5h', label: 'Por semana economizadas', desc: 'Menos tempo administrando, mais tempo atendendo.' },
];

export default function LaunchBenefits() {
  return (
    <section className="relative py-24 px-5 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="flex justify-center mb-5">
            <SectionBadge icon={Sparkles}>O que muda no seu dia a dia</SectionBadge>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-4">
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Resultados que aparecem na primeira semana
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {BENEFITS.map((b, i) => (
            <motion.div
              key={b.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="relative rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 sm:p-6 overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#60A5FA]/10 blur-3xl" />
              <div className="relative">
                <b.icon className="w-5 h-5 text-[#93C5FD] mb-3" />
                <div className="text-4xl sm:text-5xl font-black bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent leading-none">
                  {b.value}
                </div>
                <div className="text-sm font-bold text-white mt-2">{b.label}</div>
                <p className="text-[12px] text-white/55 leading-relaxed mt-1">{b.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}