// Lista de caixas fechados com drill-down e exportação individual em PDF.
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

const fmt = (v) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function HistoryTable({ summaries, onSelect, onExport }) {
  if (!summaries.length) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-10 text-center text-sm text-white/55">
        Nenhum caixa fechado encontrado neste período.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden">
      <div className="px-5 py-3 border-b border-white/8 text-[11px] font-semibold uppercase tracking-wider text-white/55 bg-white/[0.02] flex items-center justify-between">
        <span>Caixas fechados</span>
        <span className="text-[10px] font-medium normal-case tracking-normal">{summaries.length} no período</span>
      </div>
      <div className="divide-y divide-white/5 max-h-[560px] overflow-y-auto">
        {summaries.map(s => {
          const r = s.register;
          const t = s.totals;
          const hasDiff = t.difference != null && t.difference !== 0;
          return (
            <div key={r.id} className="flex items-center gap-3 p-4 hover:bg-white/[0.04] transition-colors group">
              <button
                onClick={() => onSelect(s)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-white">
                    {format(new Date(r.opened_at), "d MMM yyyy", { locale: ptBR })}
                  </span>
                  <span className="text-xs text-white/55">
                    {format(new Date(r.opened_at), "HH:mm")} → {r.closed_at ? format(new Date(r.closed_at), "HH:mm") : '–'}
                  </span>
                  {hasDiff ? (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                      t.difference > 0
                        ? 'bg-emerald-400/[0.12] text-emerald-200 border-emerald-400/30'
                        : 'bg-rose-400/[0.12] text-rose-200 border-rose-400/30'
                    }`}>
                      <AlertTriangle className="w-3 h-3" />
                      {t.difference > 0 ? `+${fmt(t.difference)}` : fmt(t.difference)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-400/[0.12] text-emerald-200 border-emerald-400/30">
                      <CheckCircle2 className="w-3 h-3" />Sem divergência
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/55 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Entradas <b className="text-emerald-300">{fmt(t.totalIn)}</b></span>
                  <span>Saídas <b className="text-rose-300">{fmt(t.totalOut)}</b></span>
                  <span>{s.dre.appointment_count} atend.</span>
                  {r.closed_by && <span>por {r.closed_by}</span>}
                </div>
              </button>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onExport(s)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/55 hover:text-[#93C5FD] transition-colors"
                  aria-label="Exportar PDF deste caixa"
                  title="Exportar PDF"
                >
                  <FileText className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onSelect(s)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/55 hover:text-white transition-colors"
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