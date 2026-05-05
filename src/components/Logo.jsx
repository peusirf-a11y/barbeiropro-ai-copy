// Logo "O CORTE" — usa a imagem oficial enviada pelo dono.
// Com fallback SVG (letra "O" estilizada) caso a imagem falhe ao carregar.
// Mantém a API antiga (size, className) para não quebrar quem já importava.

import { useState } from 'react';

const LOGO_URL = 'https://media.base44.com/images/public/69edf956c00a8a48c1e17cd6/8070fa479_IMG_20260505_175914.png';

export default function Logo({ size = 32, className = "" }) {
  const [error, setError] = useState(false);

  if (error) {
    // Fallback: "O" azul estilizado quando a imagem não carrega
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        aria-label="O CORTE"
        role="img"
      >
        <circle cx="32" cy="32" r="22" stroke="#2563EB" strokeWidth="6" fill="none" />
        <path d="M14 32 L50 32" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <img
      src={LOGO_URL}
      width={size}
      height={size}
      alt="O CORTE"
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
      onError={() => setError(true)}
      loading="eager"
    />
  );
}