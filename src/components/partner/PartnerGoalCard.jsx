// Cartão "Meta do mês" com barra de progresso.
import { Target, TrendingUp } from 'lucide-react';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

export default function PartnerGoalCard({ goal, generated, progress }) {
  const hit = progress >= 100;
  const remaining = Math.max(0, (goal || 0) - (generated || 0));
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        hit
          ? 'border-emerald-500/30 bg-emerald-500/[0.04] dark:bg-emerald-500/10'
          : 'border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              hit
                ? 'bg-emerald-500/15 border border-emerald-500/30'
                : 'bg-[#2563EB]/10 dark:bg-[#2563EB]/20 border border-[#2563EB]/20'
            }`}
          >
            {hit ? (
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-300" strokeWidth={1.75} />
            ) : (
              <Target className="w-4 h-4 text-[#2563EB] dark:text-[#93C5FD]" strokeWidth={1.75} />
            )}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">
              Meta do mês
            </div>
            <div className="text-[11px] text-[#55596A] dark:text-white/50 tabular-nums">
              {hit ? 'Meta atingida' : `Falta ${brl(remaining)}`}
            </div>
          </div>
        </div>
        <div
          className={`text-2xl font-black tabular-nums ${
            hit ? 'text-emerald-600 dark:text-emerald-300' : 'text-[#171827] dark:text-white'
          }`}
        >
          {progress}%
        </div>
      </div>

      <div className="h-2.5 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden border border-[#E5E7EF] dark:border-[#232538]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            hit ? 'bg-emerald-500' : 'bg-[#2563EB]'
          }`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2.5 text-xs tabular-nums">
        <span className="text-[#171827] dark:text-white/70 font-semibold">{brl(generated)} gerado</span>
        <span className="text-[#55596A] dark:text-white/45">/ {brl(goal)} meta</span>
      </div>
    </div>
  );
}