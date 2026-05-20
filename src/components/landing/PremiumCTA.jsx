// CTA final cinematográfico — botão gigante com glow.
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import GlowButton from './GlowButton';

export default function PremiumCTA() {
  return (
    <section className="relative py-28 md:py-36 px-5 md:px-8 overflow-hidden">
      {/* Glow gigante */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-gradient-radial from-[#2563EB]/40 via-[#60A5FA]/20 to-transparent blur-[100px]" />

      <div className="relative max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md mb-7">
            <Sparkles className="w-3.5 h-3.5 text-[#93C5FD]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">Última chance · 7 dias grátis</span>
          </div>

          <h2 className="text-5xl md:text-7xl lg:text-[88px] font-black tracking-[-0.03em] leading-[0.95] mb-7">
            <span className="bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
              Pronto pra escalar?
            </span>
          </h2>

          <p className="text-white/55 text-base md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Junte-se a <span className="text-white font-bold">2.400+ barbearias</span> que decidiram parar de operar no improviso
            e começar a faturar como um SaaS.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Link to="/checkout">
              <GlowButton className="h-14 px-9 text-base">Começar agora — 7 dias grátis</GlowButton>
            </Link>
            <Link to="/demo/dashboard">
              <GlowButton variant="ghost" className="h-14 px-9 text-base">Explorar a demo</GlowButton>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-5 text-xs text-white/40">
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] animate-pulse" /> Cancele quando quiser</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}