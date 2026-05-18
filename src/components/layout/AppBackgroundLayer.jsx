// AppBackgroundLayer — fundo dark cinematográfico global do app.
// Renderizado uma vez no AppLayout (fixed, -z-10, pointer-events-none).
// Suaviza para não competir com leitura de dados densos (KPIs, tabelas).

export default function AppBackgroundLayer() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#050816]">
      {/* Gradiente radial principal — bem sutil pra área operacional */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 40% at 50% -10%, rgba(37,99,235,0.20), transparent 60%), radial-gradient(ellipse 50% 35% at 90% 20%, rgba(96,165,250,0.10), transparent 60%)',
        }}
      />
      {/* Grid tecnológico discreto */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(96,165,250,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 20%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 20%, black 30%, transparent 80%)',
        }}
      />
      {/* Glow estático lateral */}
      <div className="absolute top-0 -left-32 w-96 h-96 rounded-full bg-[#2563EB]/12 blur-[120px]" />
      <div className="absolute bottom-0 -right-32 w-[420px] h-[420px] rounded-full bg-[#60A5FA]/8 blur-[140px]" />
    </div>
  );
}