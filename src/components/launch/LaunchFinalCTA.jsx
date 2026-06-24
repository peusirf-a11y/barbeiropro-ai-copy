// Bloco final de conversão
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket } from 'lucide-react';
import GlowButton from '@/components/landing/GlowButton';
import SectionBadge from '@/components/landing/SectionBadge';

export default function LaunchFinalCTA() {
  return (
    <section className="relative py-28 px-5 md:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl border border-[#60A5FA]/25 bg-gradient-to-br from-[#0B1E3D] via-[#0A1124] to-[#0B1E3D] p-10 md:p-16 text-center overflow-hidden shadow-[0_30px_120px_rgba(37,99,235,0.3)]"
        >
          {/* Glows */}
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#2563EB]/30 blur-[120px]" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#60A5FA]/20 blur-[120px]" />
          {/* Grid sutil */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(96,165,250,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.5) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 80%)',
            }}
          />

          <div className="relative">
            <div className="flex justify-center mb-6">
              <SectionBadge icon={Rocket}>Última chamada</SectionBadge>
            </div>

            <h2 className="text-4xl md:text-6xl font-black tracking-[-0.03em] mb-5">
              <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                Pronto para profissionalizar
              </span>
              <br />
              <span className="bg-gradient-to-r from-[#60A5FA] via-[#93C5FD] to-[#3B82F6] bg-clip-text text-transparent">
                sua barbearia?
              </span>
            </h2>

            <p className="text-base md:text-lg text-white/65 max-w-xl mx-auto mb-10 leading-relaxed">
              Garanta sua condição especial de lançamento. R$ 49/mês pelos primeiros 6 meses.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/checkout?promo=lancamento">
                <GlowButton className="w-full sm:w-auto">Começar agora</GlowButton>
              </Link>
              <Link to="/demo/dashboard">
                <GlowButton variant="ghost" className="w-full sm:w-auto">Ver demonstração</GlowButton>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}