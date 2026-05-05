// Logo oficial "O CORTE".
//
// Três variantes:
//   variant="full"      (default) → logo completo com texto "O CORTE".
//                                   Use em headers grandes, sidebar, landing.
//   variant="icon"               → ícone quadrado clarinho (cantos arredondados).
//                                   Use em mobile/contextos claros pequenos.
//   variant="icon-dark"          → ícone quadrado azul (cantos arredondados).
//                                   Use em favicons e contextos escuros.
//
// API: <Logo size={40} />                   → full, height=40px, width auto
//      <Logo variant="icon" size={32}/>     → icon claro 32x32
//      <Logo variant="icon-dark" size={32}/>→ icon azul 32x32
//
// Fallback automático: se a imagem falhar, mostra círculo azul "OC".

import { useState } from 'react';

const LOGO_FULL_URL      = 'https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/0b36a7ed8_IMG_20260505_192944.png';
const LOGO_ICON_LIGHT    = 'https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/6379bc864_IMG_20260505_193020.png';
const LOGO_ICON_DARK     = 'https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/fe3daa542_IMG_20260505_193002.png';

export default function Logo({ size = 40, variant = 'full', className = '' }) {
  const [error, setError] = useState(false);
  const isIcon = variant === 'icon' || variant === 'icon-dark';

  if (error) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-[#2563EB] text-white font-black tracking-tight ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
        aria-label="O CORTE"
        role="img"
      >
        OC
      </span>
    );
  }

  let src;
  if (variant === 'icon') src = LOGO_ICON_LIGHT;
  else if (variant === 'icon-dark') src = LOGO_ICON_DARK;
  else src = LOGO_FULL_URL;

  // Icon: quadrado fixo. Full: altura controlada, largura automática.
  const style = isIcon
    ? { width: size, height: size, objectFit: 'contain' }
    : { height: size, width: 'auto', objectFit: 'contain' };

  return (
    <img
      src={src}
      alt="O CORTE"
      onError={() => setError(true)}
      loading="eager"
      className={`block ${className}`}
      style={style}
    />
  );
}