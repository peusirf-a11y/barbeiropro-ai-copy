// KpiCard.jsx — Indicador Executivo de BI do Tenant (Barbearia + Spotlight)
// Superfície adaptativa: #FFFFFF (light) / Obsidiana + Spotlight (dark) | Tipografia: tabular-nums
import { TrendingUp, TrendingDown } from 'lucide-react';
import { SpotlightCard } from '@/components/motion/MotionPrimitives';

const TONES = {
  blue: {
    iconBg: 'bg-[#EFF6FF] dark:bg-blue-950/50 text-[#2563EB] dark:text-blue-400 border border-[#DBEAFE] dark:border-blue-500/25',
    spot: 'rgba(96, 165, 250, 0.15)',
  },
  green: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-500/25',
    spot: 'rgba(16, 185, 129, 0.14)',
  },
  amber: {
    iconBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-500/25',
    spot: 'rgba(245, 158, 11, 0.14)',
  },
  red: {
    iconBg: 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200/70 dark:border-red-500/25',
    spot: 'rgba(244, 63, 94, 0.14)',
  },
  gray: {
    iconBg: 'bg-slate-100 dark:bg-white/[0.06] text-[#59658F] dark:text-slate-300 border border-[#E5E7EF] dark:border-white/[0.1]',
    spot: 'rgba(148, 163, 184, 0.12)',
  },
};

export default function KpiCard({ label, value, sub, icon: Icon, tone = 'blue', delta }) {
  const t = TONES[tone] || TONES.blue;
  const isPositive = typeof delta === 'number' && delta >= 0;

  return (
    <SpotlightCard
      variant="adaptive"
      spotlightColor={t.spot}
      className="rounded-2xl p-4 sm:p-5 h-full"
    >
      <div className="flex flex-col justify-between h-full">
        {/* Top Header do Card */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${t.iconBg}`}>
            {Icon && <Icon className="w-5 h-5" strokeWidth={1.75} />}
          </div>

          {typeof delta === 'number' && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border tabular-nums ${
                isPositive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-500/30'
                  : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-500/30'
              }`}
            >
              {isPositive ? <TrendingUp className="w-3 h-3 flex-shrink-0" strokeWidth={2} /> : <TrendingDown className="w-3 h-3 flex-shrink-0" strokeWidth={2} />}
              <span>
                {isPositive ? '+' : ''}
                {delta}%
              </span>
            </span>
          )}
        </div>

        {/* Indicador Numérico em Tabular-nums */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#55596A] dark:text-slate-300/80 mb-1 truncate">
            {label}
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171827] dark:text-white leading-none tabular-nums">
            {value}
          </div>
          {sub && (
            <div className="text-xs font-medium text-[#59658F] dark:text-slate-400 mt-2 truncate tabular-nums">
              {sub}
            </div>
          )}
        </div>
      </div>
    </SpotlightCard>
  );
}