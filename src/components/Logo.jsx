// Logo oficial "O CORTE" — SVG inline puro (sem dependência de PNG/JPG).
// Garante nitidez perfeita em qualquer resolução e tema (claro/escuro).
//
// Variantes:
//   variant="full"      (default) → símbolo circular + texto "O CORTE".
//   variant="icon"               → ícone quadrado app-style (cantos arredondados),
//                                   símbolo sobre fundo azul. Para favicon/mobile.
//   variant="icon-bare"          → apenas o emblema circular branco, sem moldura.
//
// API: <Logo size={48} />                    → full, altura=48px, largura auto
//      <Logo variant="icon" size={48} />     → icon 48x48
//      <Logo variant="icon-bare" size={48}/> → emblema 48x48
//
// Cores fixas:
//   Fundo do emblema:  #FFFFFF
//   Símbolo interno:   #2563EB (azul O CORTE)
//   Texto "O CORTE":   tone="dark" → #FFFFFF | tone="light" → #0F172A
//
// Sem <img>, sem fallback de rede — vetor 100% inline.

const BLUE = '#2563EB';
const BLUE_DARK = '#1D4ED8';
const WHITE = '#FFFFFF';

// Emblema circular: círculo branco + tesoura/máquina estilizada em azul + linha de corte.
function Emblem({ size = 48 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="O CORTE"
      className="block"
    >
      {/* Base circular branca com leve borda azul */}
      <circle cx="50" cy="50" r="48" fill={WHITE} stroke={BLUE} strokeWidth="2" />

      {/* Linha horizontal de "corte" atravessando o círculo */}
      <path
        d="M 8 50 L 92 50"
        stroke={BLUE}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Símbolo central: máquina de corte estilizada (vertical) */}
      {/* Corpo principal */}
      <path
        d="M 42 28 L 58 28 L 58 64 L 50 72 L 42 64 Z"
        fill={BLUE}
      />
      {/* Lâmina superior */}
      <path
        d="M 40 24 L 60 24 L 60 30 L 40 30 Z"
        fill={BLUE_DARK}
      />
      {/* Detalhe central (botão) */}
      <circle cx="50" cy="46" r="3" fill={WHITE} />
      {/* Ponta inferior */}
      <path
        d="M 46 72 L 50 78 L 54 72 Z"
        fill={BLUE_DARK}
      />
    </svg>
  );
}

export default function Logo({ size = 44, variant = 'full', tone = 'dark', className = '' }) {
  // ICON: emblema sobre quadrado azul arredondado (estilo app icon)
  if (variant === 'icon') {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="O CORTE"
          className="block"
        >
          <rect width="100" height="100" rx="22" fill={BLUE} />
          <g transform="translate(14 14) scale(0.72)">
            <circle cx="50" cy="50" r="48" fill={WHITE} />
            <path d="M 8 50 L 92 50" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 42 28 L 58 28 L 58 64 L 50 72 L 42 64 Z" fill={BLUE} />
            <path d="M 40 24 L 60 24 L 60 30 L 40 30 Z" fill={BLUE_DARK} />
            <circle cx="50" cy="46" r="3" fill={WHITE} />
            <path d="M 46 72 L 50 78 L 54 72 Z" fill={BLUE_DARK} />
          </g>
        </svg>
      </span>
    );
  }

  // ICON-BARE: apenas o emblema isolado
  if (variant === 'icon-bare') {
    return (
      <span className={`inline-flex ${className}`} style={{ width: size, height: size }}>
        <Emblem size={size} />
      </span>
    );
  }

  // FULL: emblema + texto "O CORTE" ao lado
  const textColor = tone === 'light' ? '#0F172A' : '#FFFFFF';
  const subColor = tone === 'light' ? '#64748B' : 'rgba(255,255,255,0.7)';
  const fontSize = Math.round(size * 0.46);
  const subFontSize = Math.round(size * 0.20);

  return (
    <span
      className={`inline-flex items-center gap-2.5 ${className}`}
      aria-label="O CORTE"
      role="img"
    >
      <Emblem size={size} />
      <span className="flex flex-col leading-none select-none" style={{ height: size, justifyContent: 'center' }}>
        <span
          className="font-black tracking-tight"
          style={{ color: textColor, fontSize, letterSpacing: '-0.02em', lineHeight: 1 }}
        >
          O CORTE
        </span>
        <span
          className="font-semibold uppercase mt-1"
          style={{ color: subColor, fontSize: subFontSize, letterSpacing: '0.18em', lineHeight: 1 }}
        >
          Barbearia
        </span>
      </span>
    </span>
  );
}