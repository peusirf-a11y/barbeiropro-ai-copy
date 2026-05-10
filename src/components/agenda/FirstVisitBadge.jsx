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
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-sky-100 ring-1 ring-blue-200/80 shadow-[0_0_0_2px_rgba(59,130,246,0.06)] animate-fade-in flex-shrink-0 ${
        isXs ? 'w-3.5 h-3.5' : 'w-4 h-4'
      }`}
    >
      <Sparkles className={`${isXs ? 'w-2 h-2' : 'w-2.5 h-2.5'} text-blue-600`} strokeWidth={2.5} />
    </span>
  );
}