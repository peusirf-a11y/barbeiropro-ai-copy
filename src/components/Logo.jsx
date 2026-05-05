// Logo oficial "O CORTE" — SVG inline puro fornecido pelo usuário.
// Sem dependência de PNG/JPG. Vetor 100%, escalável.
//
// Variantes:
//   variant="full"      (default) → SVG completo: símbolo + texto "O CORTE".
//   variant="icon"               → apenas o símbolo (círculo + clipper),
//                                   recortado e centralizado em um quadrado.
//   variant="icon-bare"          → mesmo do icon, mas sem fundo/moldura.
//
// Props:
//   size  (number)         altura em px (default 44).
//   tone  ('dark'|'light') ignorado neste SVG (texto já é branco com O azul);
//                          mantido por compatibilidade de API.

function FullLogo({ height = 44 }) {
  // Mantém proporção 400x120 do SVG fornecido.
  return (
    <svg
      height={height}
      viewBox="0 0 400 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="O CORTE"
      className="block select-none"
      style={{ width: 'auto', display: 'block' }}
    >
      <path d="M80 20C46.8629 20 20 46.8629 20 80C20 113.137 46.8629 140 80 140" stroke="url(#oc-paint0)" strokeWidth="12" strokeLinecap="round" transform="translate(0, -20)" />
      <path d="M80 20C113.137 20 140 46.8629 140 80C140 95 130 110 115 120" stroke="#FFFFFF" strokeWidth="12" strokeLinecap="round" transform="translate(0, -20)" />

      <path d="M10 90L150 40" stroke="url(#oc-paint1)" strokeWidth="4" strokeLinecap="round" />

      <rect x="65" y="45" width="30" height="50" rx="5" fill="white" transform="rotate(-15 80 70)" />
      <path d="M62 42L98 35L102 45L66 52Z" fill="#2563EB" transform="rotate(-15 80 70)" />

      <text x="160" y="85" fill="white" style={{ fontFamily: 'Arial, sans-serif', fontWeight: 'bold', fontSize: '52px', letterSpacing: '2px' }}>
        <tspan fill="#2563EB">O</tspan> CORTE
      </text>

      <defs>
        <linearGradient id="oc-paint0" x1="20" y1="80" x2="140" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E40AF" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="oc-paint1" x1="10" y1="90" x2="150" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="white" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Apenas o símbolo (círculo + linha + clipper) — recorta a parte de 0..150 do SVG.
function IconOnly({ size = 48 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 150 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="O CORTE"
      className="block select-none"
      preserveAspectRatio="xMidYMid meet"
    >
      <path d="M80 20C46.8629 20 20 46.8629 20 80C20 113.137 46.8629 140 80 140" stroke="url(#oci-paint0)" strokeWidth="12" strokeLinecap="round" transform="translate(0, -20)" />
      <path d="M80 20C113.137 20 140 46.8629 140 80C140 95 130 110 115 120" stroke="#FFFFFF" strokeWidth="12" strokeLinecap="round" transform="translate(0, -20)" />
      <path d="M10 90L150 40" stroke="url(#oci-paint1)" strokeWidth="4" strokeLinecap="round" />
      <rect x="65" y="45" width="30" height="50" rx="5" fill="white" transform="rotate(-15 80 70)" />
      <path d="M62 42L98 35L102 45L66 52Z" fill="#2563EB" transform="rotate(-15 80 70)" />
      <defs>
        <linearGradient id="oci-paint0" x1="20" y1="80" x2="140" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E40AF" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="oci-paint1" x1="10" y1="90" x2="150" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="white" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Logo({ size = 44, variant = 'full', className = '' }) {
  if (variant === 'icon') {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[22%] ${className}`}
        style={{ width: size, height: size, background: '#2563EB' }}
      >
        <IconOnly size={size * 0.82} />
      </span>
    );
  }

  if (variant === 'icon-bare') {
    return (
      <span className={`inline-flex ${className}`} style={{ width: size, height: size }}>
        <IconOnly size={size} />
      </span>
    );
  }

  // FULL — texto já está embutido no SVG; ignora `tone`.
  return (
    <span className={`inline-flex items-center ${className}`} aria-label="O CORTE" role="img">
      <FullLogo height={size} />
    </span>
  );
}