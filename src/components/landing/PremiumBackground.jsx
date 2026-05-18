// Fundo premium cinematográfico — gradiente radial + grid sutil + glows azuis.
// Renderizado uma única vez no topo da landing, com pointer-events-none.
export default function PremiumBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#050816]">
      {/* Gradiente radial principal */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(37,99,235,0.35), transparent 60%), radial-gradient(ellipse 60% 40% at 80% 30%, rgba(96,165,250,0.18), transparent 60%), radial-gradient(ellipse 60% 40% at 10% 60%, rgba(124,58,237,0.15), transparent 60%)',
        }}
      />
      {/* Grid tecnológico */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(96,165,250,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 70% 50% at 50% 30%, black 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 50% at 50% 30%, black 40%, transparent 80%)',
        }}
      />
      {/* Glow flutuante 1 */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-[#2563EB]/30 blur-[120px] animate-pulse-slow" />
      {/* Glow flutuante 2 */}
      <div
        className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-[#60A5FA]/20 blur-[140px] animate-pulse-slow"
        style={{ animationDelay: '2s' }}
      />
      {/* Noise sutil */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>\")",
        }}
      />
    </div>
  );
}