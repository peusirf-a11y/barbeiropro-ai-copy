// Logo oficial "O CORTE" — versões em fundo escuro (alta presença visual).
//
// Variantes:
//   variant="full"      (default) → logo completo: símbolo + texto "O CORTE".
//                                   Use em sidebars dark, landing, headers grandes.
//   variant="icon"               → ícone quadrado app-style (cantos arredondados).
//                                   Use em favicons, mobile compacto.
//   variant="icon-bare"          → símbolo isolado (sem moldura). Use em
//                                   contextos onde já existe um container.
//
// API: <Logo size={44} />                    → full, height=44px, width auto
//      <Logo variant="icon" size={32} />     → icon 32x32
//      <Logo variant="icon-bare" size={36}/> → símbolo bare 36x36
//
// Tamanhos recomendados:
//   Desktop sidebar/header:  40–44px
//   Mobile header:           28–32px
//   Favicon:                 32px (icon)
//
// Fallback automático: se a imagem falhar, mostra círculo azul "OC".

import { useState } from 'react';

const LOGO_FULL_URL  = 'https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/ba7649f34_generated_image.png';
const LOGO_ICON_URL  = 'https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/c93bed24f_generated_image.png';
const LOGO_BARE_URL  = 'https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/979797c5f_generated_image.png';

export default function Logo({ size = 44, variant = 'full', className = '' }) {
  const [error, setError] = useState(false);
  const isSquare = variant === 'icon' || variant === 'icon-bare';

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
  if (variant === 'icon') src = LOGO_ICON_URL;
  else if (variant === 'icon-bare') src = LOGO_BARE_URL;
  else src = LOGO_FULL_URL;

  // Square (icon/bare): área quadrada fixa.
  // Full: altura controlada, largura automática — preserva proporção.
  const style = isSquare
    ? { width: size, height: size, objectFit: 'contain' }
    : { height: size, width: 'auto', objectFit: 'contain' };

  return (
    <img
      src={src}
      alt="O CORTE"
      onError={() => setError(true)}
      loading="eager"
      className={`block select-none ${className}`}
      style={style}
      draggable={false}
    />
  );
}