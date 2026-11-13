// KpiCard.jsx — Indicador Executivo de BI do Tenant (Barbearia)
// Superfície: #FFFFFF | Borda: #E5E7EF | Tipografia: tabular-nums | Ícones: Lucide strokeWidth=1.75
import { TrendingUp, TrendingDown } from 'lucide-react';

const TONES = {
  blue: {
    iconBg: 'bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 border border-[#DBEAFE] dark:border-blue-800/40',
    delta: 'bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE] dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/30',
  },
  green: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40',
    delta: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/30',
  },
  amber: {
    iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40',
    delta: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/30',
  },
  red: {
    iconBg: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-800/40',
    delta: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/30',
  },
  gray: {
    iconBg: 'bg-slate-100 dark:bg-slate-800 text-[#59658F] dark:text-slate-300 border border-[#E5E7EF] dark:border-slate-700',
    delta: 'bg-slate-100 text-[#55596A] border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
};

export default function KpiCard({ label, value, sub, icon: Icon, tone = 'blue', delta }) {
  const t = TONES[tone] || TONES.blue;
  const isPositive = typeof delta === 'number' && delta >= 0;

  return (
    <div className="group relative rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-[#B5D7E8] dark:hover:border-[#59658F] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
      {/* Top Header do Card */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${t.iconBg}`}>
          {Icon && <Icon className="w-5 h-5" strokeWidth={1.75} />}
        </div>

        {typeof delta === 'number' && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border tabular-nums ${
              isPositive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/30'
                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/30'
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
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#55596A] dark:text-[#8F9BBF] mb-1 truncate">
          {label}
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171827] dark:text-white leading-none tabular-nums">
          {value}
        </div>
        {sub && (
          <div className="text-xs font-medium text-[#59658F] dark:text-[#7E8BAF] mt-2 flex items-center gap-1.5 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-[#59658F]/60 flex-shrink-0" />
            <span className="truncate">{sub}</span>
          </div>
        )}
      </div>
    </div>
  );
}