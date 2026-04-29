// Ranking de profissionais — top 5 por atendimentos no mês.
// Visual: avatar com inicial, barra de progresso fina azul.

import { Trophy } from 'lucide-react';

export default function ProfessionalRanking({ data = [] }) {
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6 shadow-[var(--shadow-sm)] h-full">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h3 className="font-bold text-[#111827] text-base">Ranking de barbeiros</h3>
      </div>
      <p className="text-xs text-[#6B7280] mb-4 -mt-2">Atendimentos concluídos no mês</p>

      {data.length === 0 ? (
        <div className="text-center py-8 text-[#6B7280] text-sm">
          Nenhum atendimento concluído ainda.
        </div>
      ) : (
        <div className="space-y-3.5">
          {data.map((p, i) => {
            const pct = (p.count / max) * 100;
            return (
              <div key={p.name} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-amber-100 text-amber-700' :
                  i === 1 ? 'bg-gray-100 text-gray-700' :
                  i === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-[#EFF6FF] text-[#2563EB]'
                }`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (p.name[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-[#111827] truncate">{p.name}</span>
                    <span className="text-xs font-bold text-[#2563EB] flex-shrink-0">{p.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] rounded-full transition-all duration-500"
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
  );
}