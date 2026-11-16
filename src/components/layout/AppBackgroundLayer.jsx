// AppBackgroundLayer.jsx — Fundo obsidiana arquitetônico (TasteSkill) & claro corporativo
import { useTheme } from '@/theme/ThemeProvider';

export default function AppBackgroundLayer() {
  const { isDark } = useTheme();

  if (isDark) {
    return (
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#070B16] transition-colors duration-300">
        {/* Glow atmosférico sutil no topo */}
        <div
          className="absolute -top-24 right-[-10%] w-[640px] h-[380px] rounded-full opacity-55"
          style={{
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.16) 0%, rgba(96, 165, 250, 0.04) 45%, transparent 72%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute bottom-[-15%] left-[-10%] w-[520px] h-[320px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.10) 0%, transparent 70%)',
            filter: 'blur(72px)',
          }}
        />
        {/* Grade arquitetônica mascarada */}
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(148, 163, 184, 0.6) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 50% 25%, black 35%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 25%, black 35%, transparent 100%)',
          }}
        />
      </div>
    );
  }

  // LIGHT Premium Business SaaS — #F1F2F7 neutro, limpo e corporativo
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#F1F2F7] transition-colors duration-300">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(23, 24, 39, 0.35) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 20%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 20%, black 30%, transparent 100%)',
        }}
      />
      <div className="absolute top-0 right-0 w-[520px] h-[320px] bg-[#B5D7E8]/20 blur-[130px]" />
    </div>
  );
}