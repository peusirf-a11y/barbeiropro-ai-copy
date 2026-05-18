// ThemeToggle — pill switch premium (sol/lua) com animação fluida.
// Usa o ThemeProvider global. Tema é trocado instantaneamente, sem reload.

import { useTheme } from '@/theme/ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
      className={`relative inline-flex items-center w-[58px] h-[30px] rounded-full p-0.5 transition-colors duration-300 ring-1 focus:outline-none focus:ring-2 focus:ring-[#60A5FA]/40
        ${isDark
          ? 'bg-white/[0.06] ring-white/15 hover:bg-white/[0.1]'
          : 'bg-slate-200/80 ring-slate-300 hover:bg-slate-200'}
        ${className}`}
    >
      {/* Trilho — ícones de fundo */}
      <span className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
        <Sun className={`w-3.5 h-3.5 transition-opacity duration-300 ${isDark ? 'opacity-30 text-white/50' : 'opacity-0'}`} />
        <Moon className={`w-3.5 h-3.5 transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-40 text-slate-500'}`} />
      </span>

      {/* Knob deslizante */}
      <span
        className={`relative z-10 w-[24px] h-[24px] rounded-full flex items-center justify-center shadow-lg ring-1 transition-all duration-300 ease-out
          ${isDark
            ? 'translate-x-[28px] bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] ring-white/20 shadow-[0_2px_12px_rgba(37,99,235,0.55)]'
            : 'translate-x-0 bg-gradient-to-br from-white to-amber-50 ring-amber-200/60 shadow-[0_2px_10px_rgba(245,158,11,0.35)]'}`}
      >
        {isDark
          ? <Moon className="w-3 h-3 text-white" strokeWidth={2.5} />
          : <Sun className="w-3 h-3 text-amber-500" strokeWidth={2.5} />}
      </span>
    </button>
  );
}