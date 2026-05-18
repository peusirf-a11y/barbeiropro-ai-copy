// Badge premium para clientes em "primeira visita".
// Substitui o emoji 🆕 nos cards de agenda por um ícone Sparkles refinado,
// com fundo gradiente sutil e glow leve.
//
// Compacto (cabe em cards de horário) e harmonioso com VIP/PAGO/PLANO.

import { Sparkles } from 'lucide-react';

export default function FirstVisitBadge({ size = 'sm' }) {
  const isXs = size === 'xs';
  return (
    <span
      title="Primeira visita"
      aria-label="Primeira visita"
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-[#1D4ED8]/40 to-[#60A5FA]/30 ring-1 ring-blue-400/50 shadow-[0_0_8px_rgba(96,165,250,0.4)] animate-fade-in flex-shrink-0 ${
        isXs ? 'w-3.5 h-3.5' : 'w-4 h-4'
      }`}
    >
      <Sparkles className={`${isXs ? 'w-2 h-2' : 'w-2.5 h-2.5'} text-[#BFDBFE]`} strokeWidth={2.5} />
    </span>
  );
}