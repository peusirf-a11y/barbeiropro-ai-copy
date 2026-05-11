// Lista de caixas fechados com drill-down e exportação individual em PDF.
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function HistoryTable({ summaries, onSelect, onExport }) {
  if (!summaries.length) {
    return (
      <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-sm text-[#6B7280] shadow-[var(--shadow-sm)]">
        Nenhum caixa fechado encontrado neste período.
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="px-5 py-3 border-b border-black/5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] bg-[#FAFBFC] flex items-center justify-between">
        <span>Caixas fechados</span>
        <span className="text-[10px] font-medium normal-case tracking-normal">{summaries.length} no período</span>
      </div>
      <div className="divide-y divide-black/5 max-h-[560px] overflow-y-auto">
        {summaries.map(s => {
          const r = s.register;
          const t = s.totals;
          const hasDiff = t.difference != null && t.difference !== 0;
          return (
            <div key={r.id} className="flex items-center gap-3 p-4 hover:bg-[#FAFBFC] transition-colors group">
              <button
                onClick={() => onSelect(s)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-[#111827]">
                    {format(new Date(r.opened_at), "d MMM yyyy", { locale: ptBR })}
                  </span>
                  <span className="text-xs text-[#6B7280]">
                    {format(new Date(r.opened_at), "HH:mm")} → {r.closed_at ? format(new Date(r.closed_at), "HH:mm") : '–'}
                  </span>
                  {hasDiff ? (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                      t.difference > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      <AlertTriangle className="w-3 h-3" />
                      {t.difference > 0 ? `+${fmt(t.difference)}` : fmt(t.difference)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />Sem divergência
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#6B7280] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Entradas <b className="text-emerald-600">{fmt(t.totalIn)}</b></span>
                  <span>Saídas <b className="text-red-500">{fmt(t.totalOut)}</b></span>
                  <span>{s.dre.appointment_count} atend.</span>
                  {r.closed_by && <span>por {r.closed_by}</span>}
                </div>
              </button>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onExport(s)}
                  className="p-2 rounded-lg hover:bg-[#EFF6FF] text-[#6B7280] hover:text-[#2563EB] transition-colors"
                  aria-label="Exportar PDF deste caixa"
                  title="Exportar PDF"
                >
                  <FileText className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onSelect(s)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-[#6B7280] hover:text-[#111827] transition-colors"
                  aria-label="Ver detalhes"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}