// Ranking pessoal entre parceiros ativos.
import { Trophy, Award } from 'lucide-react';

export default function PartnerRankCard({ rank, total }) {
  const isTop3 = rank && rank <= 3;
  const isTop10 = rank && rank <= 10;
  const Icon = isTop3 ? Trophy : Award;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        isTop3
          ? 'border-amber-400/40 bg-amber-500/[0.05] dark:bg-amber-500/10'
          : isTop10
          ? 'border-violet-400/30 bg-violet-500/[0.04] dark:bg-violet-500/10'
          : 'border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827]'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            isTop3
              ? 'bg-amber-500/15 border border-amber-400/30'
              : 'bg-violet-500/15 border border-violet-400/30'
          }`}
        >
          {medal ? <span className="text-lg">{medal}</span> : <Icon className={`w-4 h-4 ${isTop3 ? 'text-amber-500' : 'text-violet-500'}`} strokeWidth={1.75} />}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60">
          Sua posição
        </div>
      </div>
      {rank ? (
        <>
          <div className="text-2xl font-black text-[#171827] dark:text-white tabular-nums">#{rank}</div>
          <div className="text-[11px] text-[#55596A] dark:text-white/50 mt-0.5 tabular-nums">de {total} parceiros ativos</div>
        </>
      ) : (
        <>
          <div className="text-sm font-bold text-[#171827] dark:text-white/80">Sem ranking ainda</div>
          <div className="text-[11px] text-[#55596A] dark:text-white/50 mt-0.5">Faça sua primeira conversão para entrar.</div>
        </>
      )}
    </div>
  );
}