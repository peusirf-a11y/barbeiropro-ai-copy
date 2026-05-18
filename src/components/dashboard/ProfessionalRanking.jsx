// Ranking dark premium — barra de progresso com gradiente glow.

import { Trophy } from 'lucide-react';

export default function ProfessionalRanking({ data = [] }) {
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="relative rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 sm:p-6 h-full overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-md bg-amber-400/40 blur-md" />
          <Trophy className="relative w-4 h-4 text-amber-300" />
        </div>
        <h3 className="font-bold text-white text-base">Ranking de barbeiros</h3>
      </div>
      <p className="text-xs text-white/45 mb-4 -mt-2">Atendimentos concluídos no mês</p>

      {data.length === 0 ? (
        <div className="text-center py-8 text-white/50 text-sm">
          Nenhum atendimento concluído ainda.
        </div>
      ) : (
        <div className="space-y-3.5">
          {data.map((p, i) => {
            const pct = (p.count / max) * 100;
            const medalStyles = i === 0
              ? 'bg-amber-500/15 text-amber-300 ring-amber-400/30'
              : i === 1
                ? 'bg-slate-400/15 text-slate-200 ring-slate-300/30'
                : i === 2
                  ? 'bg-orange-500/15 text-orange-300 ring-orange-400/30'
                  : 'bg-blue-500/10 text-blue-300 ring-blue-400/25';
            return (
              <div key={p.name} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ring-1 ${medalStyles}`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (p.name[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-white/90 truncate">{p.name}</span>
                    <span className="text-xs font-bold text-[#93C5FD] flex-shrink-0">{p.count}</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-[#3B82F6] to-[#93C5FD]"
                      style={{ width: `${pct}%`, boxShadow: '0 0 12px rgba(96,165,250,0.5)' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}