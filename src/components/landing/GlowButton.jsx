// Botão premium com glow animado azul. Variant: primary (gradient + glow) | ghost (border).
// Suporta navegação direta via prop `to` (Link) ou `href` (a) para evitar botões aninhados dentro de links.
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
        className={`group relative inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl text-sm font-semibold text-white/90 border border-white/15 bg-white/[0.03] backdrop-blur-md hover:bg-white/[0.08] hover:border-white/30 transition-all duration-300 cursor-pointer select-none ${className}`}
      >
        <span>{children}</span>
        {icon && <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 group-hover:opacity-100 transition-all" strokeWidth={1.75} />}
      </Component>
    );
  }

  return (
    <Component
      {...elementProps}
      className={`btn-glow-primary group relative inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl text-sm font-bold text-white overflow-hidden transition-all duration-300 cursor-pointer select-none ${className}`}
    >
      {/* Glow externo */}
      <span className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#2563EB] via-[#60A5FA] to-[#3B82F6] opacity-60 blur-xl group-hover:opacity-90 transition-opacity duration-500 pointer-events-none" />
      {/* Background sólido */}
      <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] pointer-events-none" />
      {/* Shine */}
      <span className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/20 via-transparent to-transparent pointer-events-none" />
      {/* Border interna */}
      <span className="absolute inset-0 rounded-xl ring-1 ring-white/20 pointer-events-none" />
      {/* Conteúdo */}
      <span className="relative z-10 flex items-center gap-2 text-white pointer-events-none">
        <span>{children}</span>
        {icon && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" strokeWidth={1.75} />}
      </span>
    </Component>
  );
}