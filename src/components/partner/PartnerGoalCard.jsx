// Cartão "Meta do mês" com barra de progresso.
import { Target, TrendingUp } from 'lucide-react';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

export default function PartnerGoalCard({ goal, generated, progress }) {
  const hit = progress >= 100;
  const remaining = Math.max(0, (goal || 0) - (generated || 0));
  return (
    <div className={`rounded-2xl border ${hit ? 'border-emerald-400/35 bg-emerald-500/[0.08]' : 'border-[#60A5FA]/25 bg-gradient-to-br from-[#2563EB]/10 via-white/[0.03] to-[#60A5FA]/10'} backdrop-blur-md p-5`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl ${hit ? 'bg-emerald-400/15 ring-1 ring-emerald-400/30' : 'bg-blue-400/15 ring-1 ring-blue-400/30'} flex items-center justify-center`}>
            {hit ? <TrendingUp className="w-4 h-4 text-emerald-300" /> : <Target className="w-4 h-4 text-[#93C5FD]" />}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-white/55">Meta do mês</div>
            <div className="text-[11px] text-white/45">{hit ? '🎉 Meta atingida!' : `Falta ${brl(remaining)}`}</div>
          </div>
        </div>
        <div className={`text-2xl font-black ${hit ? 'text-emerald-300' : 'text-white'}`}>{progress}%</div>
      </div>

      <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden border border-white/8">
        <div
          className={`h-full rounded-full transition-all duration-700 ${hit ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-[#1D4ED8] to-[#60A5FA]'}`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2.5 text-xs">
        <span className="text-white/65">{brl(generated)} gerado</span>
        <span className="text-white/45">/ {brl(goal)} meta</span>
      </div>
    </div>
  );
}