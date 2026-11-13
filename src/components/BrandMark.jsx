// BrandMark — wrapper do logo "O CORTE" com subtítulo opcional.
// Em fundos claros (tone="light"), usa a imagem `full` (que já inclui o wordmark escuro).
// Em fundos escuros (tone="dark"), usa o ícone azul (`icon-dark`) + wordmark branco
// explícito para garantir contraste máximo no modo escuro e em headers #171827/#050816.

import Logo from '@/components/Logo';

export default function BrandMark({
  size = 40,
  tone = 'light',
  subtitle = null,
  className = '',
}) {
  const isDarkSurface = tone === 'dark';
  const subtitleColor = isDarkSurface ? 'text-slate-300' : 'text-slate-600';

  if (isDarkSurface) {
    const iconSize = Math.max(24, Math.round(size * 0.85));
    const textSizeClass = size >= 38 ? 'text-base' : 'text-sm';

    return (
      <div className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}>
        <Logo variant="icon-dark" size={iconSize} className="flex-shrink-0" />
        <div className="min-w-0 leading-none">
          <span
            className={`block font-black tracking-tight ${textSizeClass} text-white whitespace-nowrap`}
            style={{ color: '#FFFFFF' }}
          >
            O CORTE
          </span>
          {subtitle && (
            <span className={`block text-[11px] font-medium ${subtitleColor} truncate hidden sm:block mt-0.5`}>
              {subtitle}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (!subtitle) {
    return <Logo size={size} className={className} />;
  }

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <Logo size={size} className="flex-shrink-0" />
      <div className={`text-[11px] font-medium ${subtitleColor} truncate hidden sm:block`}>
        {subtitle}
      </div>
    </div>
  );
}