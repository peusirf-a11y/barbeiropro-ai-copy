// Ranking pessoal entre parceiros ativos.
import { Trophy, Award } from 'lucide-react';

export default function PartnerRankCard({ rank, total }) {
  const isTop3 = rank && rank <= 3;
  const isTop10 = rank && rank <= 10;
  const Icon = isTop3 ? Trophy : Award;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <div className={`rounded-2xl border ${isTop3 ? 'border-amber-400/35 bg-amber-500/[0.08]' : isTop10 ? 'border-violet-400/30 bg-violet-500/[0.06]' : 'border-white/8 bg-white/[0.025]'} backdrop-blur-md p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isTop3 ? 'bg-amber-400/15 ring-1 ring-amber-400/30' : 'bg-violet-400/15 ring-1 ring-violet-400/30'}`}>
          {medal ? <span className="text-lg">{medal}</span> : <Icon className={`w-4 h-4 ${isTop3 ? 'text-amber-300' : 'text-violet-300'}`} />}
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Sua posição</div>
      </div>
      {rank ? (
        <>
          <div className="text-2xl font-black text-white">#{rank}</div>
          <div className="text-[11px] text-white/45 mt-0.5">de {total} parceiros ativos</div>
        </>
      ) : (
        <>
          <div className="text-sm font-bold text-white/65">Sem ranking ainda</div>
          <div className="text-[11px] text-white/45 mt-0.5">Faça sua primeira conversão para entrar.</div>
        </>
      )}
    </div>
  );
}