// Seção oferta de lançamento — preço destacado + lista de inclusos
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Zap, Shield } from 'lucide-react';
import GlowButton from '@/components/landing/GlowButton';
import SectionBadge from '@/components/landing/SectionBadge';

const INCLUDED = [
  {
    title: 'Agendamento online com link público',
    desc: 'Página exclusiva /agendar/:slug 24h com confirmação imediata.',
    tag: 'Essencial · Plano Master',
  },
  {
    title: 'CRM de retenção & clientes VIP',
    desc: 'Histórico completo, alertas de retorno e fidelização inteligente.',
    tag: 'Plano Master · IA Retenção',
  },
  {
    title: 'Gestão financeira e caixa diário',
    desc: 'Abertura/fechamento de caixa, Pix Asaas e clubes de assinatura.',
    tag: 'Plano Master · Financeiro',
  },
  {
    title: 'Gestão da equipe e comissões',
    desc: 'Cálculo automático de percentuais por serviço e barbeiro.',
    tag: 'Plano Master · Equipe',
  },
  {
    title: 'Relatórios e indicadores em tempo real',
    desc: 'DRE operacional, ticket médio, horários de pico e exportação.',
    tag: 'Plano Master · BI',
  },
  {
    title: 'Automação de WhatsApp & Avaliações',
    desc: 'Lembretes anti-falta automáticos e coleta de reviews pós-corte.',
    tag: 'Plano Master · Automação',
  },
];

export default function LaunchOffer({ vagasRestantes }) {
  return (
    <section id="oferta" className="relative py-24 px-5 md:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-5">
            <SectionBadge icon={Zap}>OFERTA DE LANÇAMENTO ATIVA</SectionBadge>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] mb-4">
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Plano Master por R$ 79,00/mês nos primeiros 3 meses
            </span>
          </h2>
          <p className="text-base text-white/60 max-w-xl mx-auto">
            Plano Master com condição especial: R$ 79,00/mês nos primeiros 3 meses. Depois, R$ 119,00/mês. Experimente com 7 dias grátis.
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
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-[10px] font-bold uppercase tracking-wider text-amber-200 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                  OFERTA DE LANÇAMENTO ATIVA · Restam {vagasRestantes} vagas
                </div>

                <div className="text-xs font-semibold text-white/45 line-through mb-1">
                  De R$ 119,00/mês por
                </div>

                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/55">R$</span>
                  <span className="text-6xl md:text-7xl font-black bg-gradient-to-br from-white to-white/70 bg-clip-text text-transparent leading-none">
                    79,00
                  </span>
                  <span className="text-white/55 font-semibold">/mês</span>
                </div>

                <p className="text-sm text-white/65 mb-6 leading-relaxed">
                  Plano <span className="text-white font-semibold">Master</span> com condição especial: <span className="text-white font-semibold">R$ 79,00/mês nos primeiros 3 meses</span>. Depois, R$ 119,00/mês. Experimente com <span className="text-emerald-300 font-semibold">7 dias grátis</span>.
                </p>

                <Link to="/checkout?promo=lancamento">
                  <GlowButton className="w-full">Experimentar 7 dias grátis</GlowButton>
                </Link>

                <div className="flex items-center gap-2 mt-4 text-[11px] text-white/50">
                  <Shield className="w-3.5 h-3.5 text-emerald-300" />
                  7 dias grátis · Sem fidelidade · Cancele a qualquer momento
                </div>
              </div>

              {/* Coluna features em Cards Comerciais */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-3">
                  Catálogo Comercial — Recursos do Plano Master:
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {INCLUDED.map((item) => (
                    <div
                      key={item.title}
                      data-testid="launch-master-feature-card"
                      className="rounded-xl border border-white/10 bg-white/[0.04] p-3 hover:border-[#60A5FA]/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-emerald-300" />
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-white">{item.title}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 whitespace-nowrap">
                          {item.tag}
                        </span>
                      </div>
                      <p className="text-xs text-white/65 leading-relaxed pl-6">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}