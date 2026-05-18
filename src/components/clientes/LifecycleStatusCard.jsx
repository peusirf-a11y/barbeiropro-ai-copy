// Card read-only que mostra o ciclo de vida automático do cliente.
// Lifecycle NÃO é editável — calculado pelo sistema baseado em agendamentos concluídos.
// Tema DARK glass.

import { Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LIFECYCLE_LABELS = {
  primeira_visita: { label: 'Visitante',  icon: '✦', tone: 'bg-blue-400/15 text-blue-200 border-blue-400/30' },
  fiel:            { label: 'Fiel',       icon: '✓', tone: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30' },
  em_risco:        { label: 'Em risco',   icon: '⚠️', tone: 'bg-amber-400/15 text-amber-200 border-amber-400/30' },
  inativo:         { label: 'Inativo',    icon: '💤', tone: 'bg-orange-400/15 text-orange-200 border-orange-400/30' },
  perdido:         { label: 'Perdido',    icon: '🚫', tone: 'bg-rose-400/15 text-rose-200 border-rose-400/30' },
};

export default function LifecycleStatusCard({ customer }) {
  const status = customer?.lifecycle_status;
  const meta = status ? LIFECYCLE_LABELS[status] : null;
  const updatedAt = customer?.lifecycle_updated_at;

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] backdrop-blur-sm p-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#93C5FD]" />
          <span className="text-[11px] font-bold text-white uppercase tracking-wider">Ciclo de vida</span>
        </div>
        <span className="text-[10px] font-medium text-white/45 uppercase tracking-wide">Automático</span>
      </div>
      {meta ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${meta.tone}`}>
            <span>{meta.icon}</span>
            {meta.label}
          </span>
          {updatedAt && (
            <span className="text-[10px] text-white/45">
              Atualizado em {format(new Date(updatedAt), "d MMM yyyy", { locale: ptBR })}
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-white/55">
          Ainda sem dados — o ciclo de vida é calculado após o primeiro atendimento concluído.
        </p>
      )}
      <p className="text-[11px] text-white/45 mt-2 leading-snug">
        Calculado pelo sistema com base nos atendimentos concluídos. Não pode ser alterado manualmente.
      </p>
    </div>
  );
}