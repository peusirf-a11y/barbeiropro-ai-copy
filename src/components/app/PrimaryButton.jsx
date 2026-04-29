// Botão primário padrão — usado em todas as páginas para criar/salvar/agir.
// Mantém shadow azul, rounded-xl e estados hover/disabled consistentes.

import { Plus } from 'lucide-react';

export default function PrimaryButton({ icon: Icon = Plus, children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`bg-[#2563EB] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1d4ed8] active:scale-[0.98] transition-all flex items-center gap-2 shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}