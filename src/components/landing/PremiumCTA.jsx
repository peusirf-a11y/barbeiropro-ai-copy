// CTA final cinematográfico — BlurReveal e tipografia display refinada sem pontos pulsantes.
import { Sparkles, ShieldCheck } from 'lucide-react';
import GlowButton from './GlowButton';
import { BlurReveal } from '@/components/motion/MotionPrimitives';

export default function PremiumCTA() {
  return (
    <section className="relative py-28 md:py-36 px-5 md:px-8 overflow-hidden">
      {/* Glow gigante */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-gradient-radial from-[#2563EB]/12 via-[#60A5FA]/8 dark:from-[#2563EB]/35 dark:via-[#60A5FA]/15 to-transparent blur-[110px] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto text-center">
        <BlurReveal inView y={16}>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-50/95 dark:bg-white/[0.04] border border-blue-200/90 dark:border-white/10 backdrop-blur-md mb-7 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#93C5FD]" strokeWidth={1.75} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1E3A8A] dark:text-slate-200">
              Última chance · 7 dias grátis
            </span>
          </div>

          <h2 className="text-5xl md:text-7xl lg:text-[84px] font-extrabold tracking-[-0.03em] leading-[0.96] mb-7">
            <span className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-700 dark:from-white dark:via-white dark:to-white/60 bg-clip-text text-transparent">
              Pronto pra escalar?
            </span>
          </h2>

          <p className="text-slate-600 dark:text-slate-300/80 text-base md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Junte-se a <span className="text-slate-900 dark:text-white font-bold tabular-nums">2.400+ barbearias</span> que decidiram parar de operar no improviso
            e começar a faturar como um SaaS.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <GlowButton to="/checkout" className="h-14 px-9 text-base">
              Começar agora — 7 dias grátis
            </GlowButton>
            <GlowButton to="/demo/dashboard" variant="ghost" className="h-14 px-9 text-base">
              Explorar a demo
            </GlowButton>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" strokeWidth={1.75} />
            <span>Cancele quando quiser · Sem fidelidade</span>
          </div>
        </BlurReveal>
      </div>
    </section>
  );
}