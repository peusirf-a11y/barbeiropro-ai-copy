// Logo oficial "O CORTE".
//
// Duas variantes:
//   variant="full" (default) → logo com texto "O CORTE" embutido na imagem.
//                              Usar em headers, sidebar, landing.
//   variant="icon"           → apenas o símbolo circular (sem texto).
//                              Usar em favicons, avatars, espaços pequenos.
//
// API: <Logo size={40} />              → full, height=40px, width auto
//      <Logo variant="icon" size={32}/> → icon quadrado 32x32
//
// Fallback automático: se a imagem falhar, mostra círculo azul "OC".

import { useState } from 'react';

const LOGO_FULL_URL = 'https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/2a4c01f86_file_00000000de3871fb98d9c4a5f18f4f63.png';
const LOGO_ICON_URL = 'https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/bd1d159ba_generated_image.png';

export default function Logo({ size = 40, variant = 'full', className = '' }) {
  const [error, setError] = useState(false);
  const isIcon = variant === 'icon';

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

  // Icon: quadrado fixo. Full: altura controlada, largura automática.
  const style = isIcon
    ? { width: size, height: size, objectFit: 'contain' }
    : { height: size, width: 'auto', objectFit: 'contain' };

  return (
    <img
      src={isIcon ? LOGO_ICON_URL : LOGO_FULL_URL}
      alt="O CORTE"
      onError={() => setError(true)}
      loading="eager"
      className={`block ${className}`}
      style={style}
    />
  );
}