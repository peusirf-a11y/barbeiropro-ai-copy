// Card read-only que mostra o ciclo de vida automático do cliente.
// Lifecycle NÃO é editável — calculado pelo sistema baseado em agendamentos concluídos.

import { Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LIFECYCLE_LABELS = {
  primeira_visita: { label: 'Visitante',  icon: '✦', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  fiel:            { label: 'Fiel',       icon: '✓', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  em_risco:        { label: 'Em risco',   icon: '⚠️', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  inativo:         { label: 'Inativo',    icon: '💤', tone: 'bg-gray-100 text-gray-700 border-gray-200' },
  perdido:         { label: 'Perdido',    icon: '🚫', tone: 'bg-red-50 text-red-700 border-red-200' },
};

export default function LifecycleStatusCard({ customer }) {
  const status = customer?.lifecycle_status;
  const meta = status ? LIFECYCLE_LABELS[status] : null;
  const updatedAt = customer?.lifecycle_updated_at;

  return (
    <div className="rounded-xl border border-black/5 bg-[#FAFBFC] p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
          <span className="text-[11px] font-bold text-[#111827] uppercase tracking-wider">Ciclo de vida</span>
        </div>
        <span className="text-[10px] font-medium text-[#6B7280] uppercase tracking-wide">Automático</span>
      </div>
      {meta ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${meta.tone}`}>
            <span>{meta.icon}</span>
            {meta.label}
          </span>
          {updatedAt && (
            <span className="text-[10px] text-[#6B7280]">
              Atualizado em {format(new Date(updatedAt), "d MMM yyyy", { locale: ptBR })}
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-[#6B7280]">
          Ainda sem dados — o ciclo de vida é calculado após o primeiro atendimento concluído.
        </p>
      )}
      <p className="text-[11px] text-[#6B7280] mt-2 leading-snug">
        Calculado pelo sistema com base nos atendimentos concluídos. Não pode ser alterado manualmente.
      </p>
    </div>
  );
}