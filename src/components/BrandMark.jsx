// BrandMark — composição oficial: logo + texto "O CORTE".
// Use nos headers do sistema. Tamanho controlado pelo prop `size`
// (altura do logo em px). O texto cresce proporcionalmente.
//
// Variantes:
//  - tone="dark"  → texto branco (sidebars escuras)
//  - tone="light" → texto #0F172A (headers claros)
//  - showText=false → só o ícone (mobile compacto)

import Logo from '@/components/Logo';

export default function BrandMark({
  size = 40,
  tone = 'light',
  showText = true,
  subtitle = null,
  className = '',
}) {
  const textColor = tone === 'dark' ? 'text-white' : 'text-[#0F172A]';
  const subtitleColor = tone === 'dark' ? 'text-gray-400' : 'text-gray-500';
  // Tamanho do texto proporcional à altura do logo
  const textPx = Math.max(14, Math.round(size * 0.42));

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <Logo size={size} className="flex-shrink-0" />
      {showText && (
        <div className="min-w-0 leading-tight">
          <div
            className={`font-black tracking-[0.14em] truncate ${textColor}`}
            style={{ fontSize: textPx }}
          >
            O CORTE
          </div>
          {subtitle && (
            <div className={`text-[11px] font-medium ${subtitleColor} truncate mt-0.5`}>
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}