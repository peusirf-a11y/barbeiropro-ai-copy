// Hero da launch landing — headline + contador de vagas dinâmico + CTAs.
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket, CheckCircle2, Users, Sparkles } from 'lucide-react';
import GlowButton from '@/components/landing/GlowButton';
import SectionBadge from '@/components/landing/SectionBadge';

const HIGHLIGHTS = [
  'Configuração rápida',
  'Agendamento online',
  'Controle financeiro',
  'Gestão de barbeiros',
  'Relatórios inteligentes',
  'Pagamentos integrados',
];

export default function LaunchHero({ vagasRestantes, vagasTotais }) {
  const percent = Math.max(0, Math.min(100, ((vagasTotais - vagasRestantes) / vagasTotais) * 100));

  return (
    <section className="relative pt-36 md:pt-40 pb-20 px-5 md:px-8 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="flex justify-center mb-7">
            <SectionBadge icon={Rocket}>Oferta de lançamento · R$ 49/mês</SectionBadge>
          </div>

          <h1 className="text-[40px] sm:text-6xl md:text-7xl lg:text-[80px] font-black leading-[0.97] tracking-[-0.03em] mb-6">
            <span className="block bg-gradient-to-b from-white via-white to-white/70 bg-clip-text text-transparent">
              O sistema completo
            </span>
            <span className="block bg-gradient-to-r from-[#60A5FA] via-[#93C5FD] to-[#3B82F6] bg-clip-text text-transparent">
              para modernizar sua barbearia.
            </span>
          </h1>

          <p className="text-base md:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed mb-10">
            Agendamentos online, controle financeiro, equipe, clientes e pagamentos em um único lugar.
          </p>

          {/* Highlights checkmark grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-w-3xl mx-auto mb-10">
            {HIGHLIGHTS.map((h) => (
              <div
                key={h}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/8 text-left"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <span className="text-[13px] font-semibold text-white/85">{h}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Link to="/checkout?promo=lancamento">
              <GlowButton className="w-full sm:w-auto">Quero garantir minha vaga</GlowButton>
            </Link>
            <Link to="/demo/dashboard">
              <GlowButton variant="ghost" className="w-full sm:w-auto">Ver demonstração</GlowButton>
            </Link>
          </div>

          {/* Contador de vagas */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative max-w-md mx-auto rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/[0.08] to-amber-500/[0.02] backdrop-blur-md p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-amber-400 blur-md opacity-60" />
                  <Users className="relative w-4 h-4 text-amber-200" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-100">
                  Oferta para os {vagasTotais} primeiros clientes
                </span>
              </div>
              <span className="text-[11px] font-bold text-amber-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Restam {vagasRestantes}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-amber-300 rounded-full shadow-[0_0_12px_rgba(251,191,36,0.6)] transition-all duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-[10px] text-amber-100/70 mt-2 text-left">
              {vagasTotais - vagasRestantes} de {vagasTotais} vagas preenchidas
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}