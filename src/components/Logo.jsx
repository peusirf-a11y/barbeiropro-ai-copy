// Logo "O CORTE" — imagem oficial sem container.
// Renderiza apenas a imagem com altura controlada e largura automática.
// Fallback: círculo azul com "OC" quando a imagem falha.
// API: <Logo size={40} /> → height=40px, width=auto, object-contain.

import { useState } from 'react';

const LOGO_URL = 'https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/8070fa479_IMG_20260505_175914.png';

export default function Logo({ size = 40, className = '' }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-[#2563EB] text-white font-black tracking-tight ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.round(size * 0.42),
          boxShadow: '0 0 8px rgba(37,99,235,0.35)',
        }}
        aria-label="O CORTE"
        role="img"
      >
        OC
      </span>
    );
  }

  return (
    <img
      src={LOGO_URL}
      alt="O CORTE"
      onError={() => setError(true)}
      loading="eager"
      className={`block ${className}`}
      style={{ height: size, width: 'auto', objectFit: 'contain' }}
    />
  );
}