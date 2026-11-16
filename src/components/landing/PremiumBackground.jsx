// Fundo premium obsidiana (TasteSkill + React Bits) — grade arquitetônica mascarada + glows suaves.
export default function PremiumBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#050816]">
      {/* Gradiente radial principal */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(37,99,235,0.28), transparent 60%), radial-gradient(ellipse 55% 40% at 85% 28%, rgba(96,165,250,0.14), transparent 60%), radial-gradient(ellipse 55% 40% at 10% 62%, rgba(79,70,229,0.12), transparent 60%)',
        }}
      />
      {/* Grade de pontos arquitetônica mascarada */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(148, 163, 184, 0.45) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 75% 55% at 50% 25%, black 35%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 55% at 50% 25%, black 35%, transparent 85%)',
        }}
      />
      {/* Hairline vertical beam sutil no centro */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[420px] opacity-35"
        style={{
          background: 'radial-gradient(ellipse at top, rgba(96, 165, 250, 0.22), transparent 70%)',
          filter: 'blur(64px)',
        }}
      />
      {/* Glow ambiental lateral estático (compositor-friendly) */}
      <div
        aria-hidden="true"
        className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-[#2563EB]/20 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-1/4 -right-32 w-[480px] h-[480px] rounded-full bg-[#60A5FA]/15 blur-[140px]"
      />
    </div>
  );
}