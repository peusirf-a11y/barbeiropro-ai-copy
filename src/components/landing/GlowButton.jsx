// Botão premium com feixe especular no hover e resposta tátil de 180ms (TasteSkill + React Bits).
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function GlowButton({
  children,
  to,
  href,
  variant = 'primary',
  icon = true,
  className = '',
  as,
  type = 'button',
  ...props
}) {
  const Component = to ? Link : href ? 'a' : as || 'button';
  const elementProps = to
    ? { to, ...props }
    : href
    ? { href, ...props }
    : Component === 'button'
    ? { type, ...props }
    : props;

  if (variant === 'ghost') {
    return (
      <Component
        {...elementProps}
        className={`group relative inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl text-sm font-semibold text-slate-800 dark:text-white/90 border border-slate-300 dark:border-white/[0.16] bg-white/90 dark:bg-white/[0.04] backdrop-blur-md hover:bg-slate-100 dark:hover:bg-white/[0.09] hover:border-slate-400 dark:hover:border-white/30 active:scale-[0.98] transition-[transform,background-color,border-color,color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer select-none shadow-xs dark:shadow-none ${className}`}
      >
        <span>{children}</span>
        {icon && <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 group-hover:opacity-100 transition-transform duration-[180ms]" strokeWidth={1.75} />}
      </Component>
    );
  }

  return (
    <Component
      {...elementProps}
      className={`btn-glow-primary group relative inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl text-sm font-bold text-white overflow-hidden active:scale-[0.98] transition-[transform,box-shadow,filter] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer select-none shadow-[0_12px_36px_-10px_rgba(37,99,235,0.65)] hover:shadow-[0_16px_44px_-8px_rgba(59,130,246,0.75)] ${className}`}
    >
      {/* Background sólido */}
      <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] pointer-events-none" />
      {/* Shine superior */}
      <span className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/25 via-transparent to-transparent pointer-events-none" />
      {/* Feixe especular animado no hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-[360%] transition-transform duration-700 ease-out"
      />
      {/* Border interna */}
      <span className="absolute inset-0 rounded-xl ring-1 ring-white/25 pointer-events-none" />
      {/* Conteúdo */}
      <span className="relative z-10 flex items-center gap-2 text-white pointer-events-none">
        <span>{children}</span>
        {icon && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-[180ms]" strokeWidth={1.75} />}
      </span>
    </Component>
  );
}