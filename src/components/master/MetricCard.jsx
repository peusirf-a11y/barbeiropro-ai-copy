// MetricCard.jsx — Card de Indicador Executivo (Business Intelligence + Spotlight)
// Superfície adaptativa: #FFFFFF (light) / Obsidiana + Spotlight (dark) | Tipografia: tabular-nums
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SpotlightCard } from '@/components/motion/MotionPrimitives';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const fmtNumber = (v) => Number(v || 0).toLocaleString('pt-BR');

const ACCENTS = {
  emerald: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-500/25',
    spot: 'rgba(16, 185, 129, 0.14)',
  },
  red: {
    iconBg: 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200/70 dark:border-red-500/25',
    spot: 'rgba(244, 63, 94, 0.14)',
  },
  blue: {
    iconBg: 'bg-[#EFF6FF] dark:bg-blue-950/50 text-[#2563EB] dark:text-blue-400 border border-[#DBEAFE] dark:border-blue-500/25',
    spot: 'rgba(96, 165, 250, 0.15)',
  },
  amber: {
    iconBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/70 dark:border-amber-500/25',
    spot: 'rgba(245, 158, 11, 0.14)',
  },
  gray: {
    iconBg: 'bg-slate-100 dark:bg-white/[0.06] text-[#59658F] dark:text-slate-300 border border-[#E5E7EF] dark:border-white/[0.1]',
    spot: 'rgba(148, 163, 184, 0.12)',
  },
  violet: {
    iconBg: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200/70 dark:border-purple-500/25',
    spot: 'rgba(167, 139, 250, 0.14)',
  },
};

export default function MetricCard({
  label,
  value,
  icon: Icon,
  color = 'blue',
  money = false,
  suffix = '',
  delta = null,
  deltaLabel = '',
  loading = false,
  hint = null,
}) {
  const displayValue = loading
    ? '—'
    : money
    ? fmtMoney(value)
    : `${fmtNumber(value)}${suffix}`;

  const deltaIcon = delta == null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaColor =
    delta == null
      ? ''
      : delta > 0
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30'
      : delta < 0
      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-500/30'
      : 'text-[#55596A] dark:text-slate-300 bg-slate-100 dark:bg-white/[0.05] border-slate-200 dark:border-white/10';

  const DeltaIcon = deltaIcon;
  const accentCfg = ACCENTS[color] || ACCENTS.blue;

  return (
    <SpotlightCard
      variant="adaptive"
      spotlightColor={accentCfg.spot}
      className="rounded-2xl p-4 sm:p-5 h-full"
    >
      <div className="flex flex-col justify-between h-full">
        {/* Top Header do Card: Ícone e Delta */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accentCfg.iconBg}`}>
            <Icon className="w-5 h-5" strokeWidth={1.75} />
          </div>

          {delta != null && !loading && (
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border tabular-nums ${deltaColor}`}>
              <DeltaIcon className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
              <span>
                {delta > 0 ? '+' : ''}
                {delta}%
              </span>
            </div>
          )}
        </div>

        {/* Valor Numérico Principal em Tabular-nums */}
        <div>
          <div className="font-extrabold text-[#171827] dark:text-white tracking-tight leading-none tabular-nums text-2xl sm:text-3xl">
            {displayValue}
          </div>

          {/* Rótulo do Indicador */}
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#55596A] dark:text-slate-300/80 mt-2 truncate">
            {label}
          </div>

          {/* Informação secundária / hint sem ponto decorativo */}
          {(hint || deltaLabel) && !loading && (
            <div className="text-[11px] font-medium text-[#59658F] dark:text-slate-400 mt-1.5 truncate">
              {hint || deltaLabel}
            </div>
          )}
        </div>
      </div>
    </SpotlightCard>
  );
}