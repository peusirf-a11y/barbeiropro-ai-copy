// Logo do BarberTrimly — SVG inline, sem fundo nem borda.
// Herda a cor do container via `currentColor`, então pode ser colocado sobre qualquer fundo
// (escuro, claro, gradiente) e renderiza sempre nítido em qualquer tamanho.

export default function Logo({ size = 32, className = "", color = "currentColor" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-label="BarberTrimly"
      role="img"
    >
      {/* "B" estilizado com corte de tesoura — traço puro, sem fundo */}
      <path
        d="M18 12h16c6.627 0 12 4.477 12 10 0 3.6-2.3 6.7-5.7 8.4 4.5 1.4 7.7 5 7.7 9.6 0 6.075-5.82 11-13 11H18V12zm6 6v12h10c3.866 0 7-2.686 7-6s-3.134-6-7-6H24zm0 18v14h11c4.418 0 8-3.134 8-7s-3.582-7-8-7H24z"
        fill={color}
      />
      {/* Acento diagonal — referência sutil ao corte */}
      <path
        d="M50 14l-4 4M52 22l-3 3"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}