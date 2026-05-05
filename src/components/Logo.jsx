// Logo oficial "O CORTE" — SVG inline puro (vetor 100%, sem PNG/JPG).
// Recriação fiel à arte original: emblema circular cromado/branco com clipper
// vertical (máquina de cortar cabelo) ao centro, atravessado por uma linha
// horizontal de "corte". Texto "O CORTE" ao lado.
//
// Variantes:
//   variant="full"      (default) → emblema + texto "O CORTE".
//   variant="icon"               → ícone quadrado app-style (fundo azul).
//   variant="icon-bare"          → apenas o emblema circular, sem moldura.
//
// Props:
//   size  (number)   altura do emblema em px (default 44).
//   tone  ('dark'|'light')  cor do texto. dark→branco (sobre fundo escuro/azul);
//                                          light→preto (sobre fundo claro).
//
// Cores oficiais:
//   Base do emblema:  branco com gradiente cromado sutil
//   Borda do emblema: #2563EB
//   Clipper:          gradiente azul (#1D4ED8 → #2563EB → #60A5FA)
//   Linha de corte:   #2563EB

const BLUE = '#2563EB';
const BLUE_DARK = '#1D4ED8';
const BLUE_LIGHT = '#60A5FA';
const WHITE = '#FFFFFF';
const SILVER = '#E5E7EB';

// Gera IDs únicos por instância para evitar conflito de <defs> em múltiplas logos na mesma página.
let _uid = 0;
const nextUid = () => `oc-${++_uid}`;

// Emblema: círculo branco/cromado + clipper vertical azul + linha horizontal de corte.
function Emblem({ size = 48 }) {
  const id = nextUid();
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
      <defs>
        {/* Gradiente cromado do círculo base */}
        <radialGradient id={`${id}-chrome`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#E5E7EB" />
        </radialGradient>
        {/* Gradiente azul do clipper */}
        <linearGradient id={`${id}-blue`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={BLUE_LIGHT} />
          <stop offset="50%" stopColor={BLUE} />
          <stop offset="100%" stopColor={BLUE_DARK} />
        </linearGradient>
        {/* Brilho prateado da lâmina/pente */}
        <linearGradient id={`${id}-silver`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>

      {/* Base circular cromada */}
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-chrome)`} stroke={BLUE} strokeWidth="2" />

      {/* CLIPPER VERTICAL — geometria fiel à referência */}
      {/* Lâmina/pente superior (dentes do pente) */}
      <g>
        <rect x="38" y="18" width="24" height="4" rx="1" fill={`url(#${id}-silver)`} />
        {/* Dentes do pente */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect
            key={i}
            x={39 + i * 2.8}
            y="14"
            width="1.6"
            height="5"
            rx="0.4"
            fill="#CBD5E1"
          />
        ))}
        {/* Suporte da lâmina */}
        <rect x="40" y="22" width="20" height="3" rx="0.5" fill={BLUE_DARK} />
      </g>

      {/* Corpo principal do clipper (retangular com cantos arredondados) */}
      <rect
        x="36"
        y="25"
        width="28"
        height="42"
        rx="3"
        fill={`url(#${id}-blue)`}
        stroke={BLUE_DARK}
        strokeWidth="0.8"
      />

      {/* Botão/chave de regulagem central */}
      <circle cx="50" cy="38" r="3.2" fill={WHITE} stroke={BLUE_DARK} strokeWidth="0.6" />
      <circle cx="50" cy="38" r="1.4" fill={BLUE_DARK} />

      {/* Detalhe horizontal abaixo do botão */}
      <rect x="40" y="46" width="20" height="1.5" rx="0.5" fill={BLUE_DARK} opacity="0.5" />
      <rect x="40" y="50" width="20" height="1.5" rx="0.5" fill={BLUE_DARK} opacity="0.4" />

      {/* Cabo inferior afilado */}
      <path
        d="M 40 67 L 60 67 L 56 80 L 44 80 Z"
        fill={`url(#${id}-blue)`}
        stroke={BLUE_DARK}
        strokeWidth="0.6"
      />
      {/* Ponta do cabo */}
      <path d="M 46 80 L 50 84 L 54 80 Z" fill={BLUE_DARK} />

      {/* LINHA HORIZONTAL DE CORTE — atravessa todo o círculo, por cima de tudo */}
      <line
        x1="4"
        y1="50"
        x2="96"
        y2="50"
        stroke={BLUE}
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Brilho sutil no topo do círculo (highlight cromado) */}
      <ellipse cx="42" cy="22" rx="18" ry="6" fill="#FFFFFF" opacity="0.45" />
    </svg>
  );
}

export default function Logo({ size = 44, variant = 'full', tone = 'dark', className = '' }) {
  // ICON: emblema sobre quadrado azul arredondado (estilo app icon)
  if (variant === 'icon') {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[22%] ${className}`}
        style={{ width: size, height: size, background: BLUE }}
      >
        <span style={{ width: size * 0.78, height: size * 0.78 }}>
          <Emblem size={size * 0.78} />
        </span>
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

  // FULL: emblema + texto "O CORTE"
  const textColor = tone === 'light' ? '#0F172A' : '#FFFFFF';
  const subColor = tone === 'light' ? '#64748B' : 'rgba(255,255,255,0.7)';
  const fontSize = Math.round(size * 0.46);
  const subFontSize = Math.max(9, Math.round(size * 0.20));

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