// MetricCard.jsx — Card de Indicador Executivo (Business Intelligence)
// Superfície: #FFFFFF | Borda: #E5E7EF | Tipografia: tabular-nums | Ícones: Lucide strokeWidth=1.75
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const fmtNumber = (v) => Number(v || 0).toLocaleString('pt-BR');

const ACCENTS = {
  emerald: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40',
    badge: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/30',
  },
  red: {
    iconBg: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-800/40',
    badge: 'text-red-700 dark:text-red-300 bg-red-50/80 dark:bg-red-950/30',
  },
  blue: {
    iconBg: 'bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 border border-[#DBEAFE] dark:border-blue-800/40',
    badge: 'text-[#2563EB] dark:text-blue-300 bg-[#EFF6FF]/80 dark:bg-blue-950/30',
  },
  amber: {
    iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40',
    badge: 'text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/30',
  },
  gray: {
    iconBg: 'bg-slate-100 dark:bg-slate-800 text-[#59658F] dark:text-slate-300 border border-[#E5E7EF] dark:border-slate-700',
    badge: 'text-[#55596A] dark:text-slate-300 bg-slate-100',
  },
  violet: {
    iconBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/40',
    badge: 'text-purple-700 dark:text-purple-300 bg-purple-50/80 dark:bg-purple-950/30',
  },
};

export default function MetricCard({
  label,
  value,
  icon: Icon,
  color = 'blue',
  money = false,
  suffix = '',
  delta = null,        // número: +12.5 → verde ↑, -8 → vermelho ↓
  deltaLabel = '',     // texto descritivo: "vs 30d anteriores"
  loading = false,
  hint = null,         // texto auxiliar abaixo do valor
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
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/30'
      : delta < 0
      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/30'
      : 'text-[#55596A] dark:text-[#8F9BBF] bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';

  const DeltaIcon = deltaIcon;
  const accentCfg = ACCENTS[color] || ACCENTS.blue;

  return (
    <div className="bg-[#FFFFFF] dark:bg-[#171827] rounded-2xl border border-[#E5E7EF] dark:border-[#232538] p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-[#B5D7E8] dark:hover:border-[#59658F] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
      {/* Top Header do Card: Ícone e Delta */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accentCfg.iconBg}`}>
          <Icon className="w-5 h-5" strokeWidth={1.75} />
        </div>

        {delta != null && !loading && (
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border tabular-nums ${deltaColor}`}>
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
        <div className={`font-extrabold text-[#171827] dark:text-white tracking-tight leading-none tabular-nums ${money ? 'text-2xl sm:text-3xl' : 'text-2xl sm:text-3xl'}`}>
          {displayValue}
        </div>

        {/* Rótulo do Indicador */}
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#55596A] dark:text-[#8F9BBF] mt-2 truncate">
          {label}
        </div>

        {/* Informação secundária / hint */}
        {(hint || deltaLabel) && !loading && (
          <div className="text-[11px] font-medium text-[#59658F] dark:text-[#7E8BAF] mt-1.5 flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-[#59658F]/60 flex-shrink-0" />
            <span className="truncate">{hint || deltaLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}