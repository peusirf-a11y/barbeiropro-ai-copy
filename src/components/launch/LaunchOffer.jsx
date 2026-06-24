// Seção oferta de lançamento — preço destacado + lista de inclusos
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Zap, Shield } from 'lucide-react';
import GlowButton from '@/components/landing/GlowButton';
import SectionBadge from '@/components/landing/SectionBadge';

const INCLUDED = [
  'Agendamento online com link público',
  'Gestão completa de clientes e histórico',
  'Gestão financeira e caixa diário',
  'Gestão da equipe e comissões',
  'Relatórios e indicadores em tempo real',
  'Atualizações inclusas para sempre',
];

export default function LaunchOffer({ vagasRestantes }) {
  return (
    <section id="oferta" className="relative py-24 px-5 md:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-5">
            <SectionBadge icon={Zap}>Oferta exclusiva de lançamento</SectionBadge>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-4">
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Garanta R$ 49/mês por 6 meses
            </span>
          </h2>
          <p className="text-base text-white/60 max-w-xl mx-auto">
            Preço promocional travado pelos primeiros 6 meses. Depois disso, migra para o valor oficial vigente — sem surpresas.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          {/* Glow externo */}
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-[#2563EB] via-[#60A5FA] to-[#3B82F6] opacity-30 blur-2xl" />

          <div className="relative rounded-3xl border border-[#60A5FA]/30 bg-[#0A1124] p-8 md:p-10 overflow-hidden shadow-[0_30px_120px_rgba(37,99,235,0.35)]">
            {/* Linha gradient topo */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-[#60A5FA] to-transparent" />
            {/* Glow interno */}
            <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-[#2563EB]/30 blur-3xl" />

            <div className="relative grid md:grid-cols-2 gap-10 items-center">
              {/* Coluna preço */}
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-[10px] font-bold uppercase tracking-wider text-amber-200 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                  Restam {vagasRestantes} vagas
                </div>

                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/55">R$</span>
                  <span className="text-7xl md:text-8xl font-black bg-gradient-to-br from-white to-white/70 bg-clip-text text-transparent leading-none">
                    49
                  </span>
                  <span className="text-white/55 font-semibold">/mês</span>
                </div>

                <p className="text-sm text-white/65 mb-6 leading-relaxed">
                  Pelos primeiros <span className="text-white font-semibold">6 meses</span>. Depois, o preço oficial vigente.
                  Cancele quando quiser.
                </p>

                <Link to="/checkout?promo=lancamento">
                  <GlowButton className="w-full">Quero entrar agora</GlowButton>
                </Link>

                <div className="flex items-center gap-2 mt-4 text-[11px] text-white/50">
                  <Shield className="w-3.5 h-3.5 text-emerald-300" />
                  Sem fidelidade · Cancele a qualquer momento
                </div>
              </div>

              {/* Coluna features */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-4">
                  Tudo isso incluso:
                </div>
                <ul className="space-y-2.5">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                        <Check className="w-3 h-3 text-emerald-300" />
                      </span>
                      <span className="text-sm text-white/85">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}