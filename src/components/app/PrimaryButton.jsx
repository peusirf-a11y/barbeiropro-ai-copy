// Botão primário padrão — versão DARK com gradient azul + glow.
// API mantida (icon, onClick, disabled, etc).

import { Plus } from 'lucide-react';

export default function PrimaryButton({ icon: Icon = Plus, children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white text-sm font-semibold px-4 py-2.5 rounded-xl ring-1 ring-white/15 hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 shadow-[0_8px_24px_rgba(37,99,235,0.4)] hover:shadow-[0_12px_32px_rgba(37,99,235,0.55)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:brightness-75 ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}