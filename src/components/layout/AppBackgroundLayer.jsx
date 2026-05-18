// AppBackgroundLayer — fundo cinematográfico global do app.
// Adapta automaticamente ao tema (dark = preto azulado + glow neon,
// light = branco gelo + glow azul suave estilo Stripe/Linear).
//
// Renderizado uma vez no AppLayout (fixed, -z-10, pointer-events-none).

import { useTheme } from '@/theme/ThemeProvider';

export default function AppBackgroundLayer() {
  const { isDark } = useTheme();

  if (isDark) {
    return (
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#050816] transition-colors duration-300">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 40% at 50% -10%, rgba(37,99,235,0.20), transparent 60%), radial-gradient(ellipse 50% 35% at 90% 20%, rgba(96,165,250,0.10), transparent 60%)',
          }}
        />
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
        <div className="absolute top-0 -left-32 w-96 h-96 rounded-full bg-[#2563EB]/12 blur-[120px]" />
        <div className="absolute bottom-0 -right-32 w-[420px] h-[420px] rounded-full bg-[#60A5FA]/8 blur-[140px]" />
      </div>
    );
  }

  // LIGHT premium — branco gelo com profundidade, glow azul muito suave (estilo Stripe/Linear)
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#F4F7FB] transition-colors duration-300">
      {/* Gradient principal: tons quase brancos com azul muito suave */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 40% at 50% -10%, rgba(37,99,235,0.10), transparent 60%), radial-gradient(ellipse 50% 35% at 90% 20%, rgba(124,58,237,0.05), transparent 60%)',
        }}
      />
      {/* Grid sutil cinza */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,23,42,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 20%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 20%, black 30%, transparent 80%)',
        }}
      />
      {/* Glow suave */}
      <div className="absolute top-0 -left-32 w-96 h-96 rounded-full bg-[#2563EB]/8 blur-[120px]" />
      <div className="absolute bottom-0 -right-32 w-[420px] h-[420px] rounded-full bg-[#7C3AED]/5 blur-[140px]" />
    </div>
  );
}