// ProfessionalRanking.jsx — Ranking Executivo de Desempenho por Barbeiro
// Superfície: #FFFFFF | Borda: #E5E7EF | Tipografia: tabular-nums | Ícones: Lucide strokeWidth=1.75
import { Trophy } from 'lucide-react';

export default function ProfessionalRanking({ data = [] }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] p-4 sm:p-6 shadow-sm h-full">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center font-bold">
          <Trophy className="w-4 h-4" strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="font-extrabold text-[#171827] dark:text-white text-base tracking-tight">
            Desempenho da Equipe
          </h3>
          <p className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-medium">
            Atendimentos concluídos no ciclo mensal
          </p>
        </div>
      </div>

      <div className="mt-4">
        {data.length === 0 ? (
          <div className="text-center py-8 text-[#55596A] dark:text-[#8F9BBF] text-xs">
            Nenhum atendimento finalizado registrado neste período.
          </div>
        ) : (
          <div className="space-y-3.5">
            {data.map((p, i) => {
              const pct = (p.count / max) * 100;
              const medalStyles =
                i === 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
                  : i === 1
                  ? 'bg-slate-100 text-[#55596A] border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                  : i === 2
                  ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/40'
                  : 'bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE] dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40';

              return (
                <div key={p.name} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 border ${medalStyles}`}>
                    {i === 0 ? '1º' : i === 1 ? '2º' : i === 2 ? '3º' : `${i + 1}º`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-[#171827] dark:text-white truncate">
                        {p.name}
                      </span>
                      <span className="text-xs font-bold text-[#2563EB] dark:text-[#93C5FD] tabular-nums">
                        {p.count} {p.count === 1 ? 'corte' : 'cortes'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#F1F2F7] dark:bg-[#232538] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-[#2563EB] to-[#60A5FA]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}