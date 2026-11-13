// AppBackgroundLayer.jsx — Fundo executivo corporativo do sistema
// Design System: Premium Business SaaS + Business Intelligence (#F1F2F7 / #0F101A)
import { useTheme } from '@/theme/ThemeProvider';

export default function AppBackgroundLayer() {
  const { isDark } = useTheme();

  if (isDark) {
    return (
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#0F101A] transition-colors duration-300">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-[#171827] blur-[120px] opacity-70" />
      </div>
    );
  }

  // LIGHT Premium Business SaaS — #F1F2F7 neutro, limpo e corporativo
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#F1F2F7] transition-colors duration-300">
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(23,24,39,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(23,24,39,0.3) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-[#B5D7E8]/20 blur-[140px]" />
    </div>
  );
}