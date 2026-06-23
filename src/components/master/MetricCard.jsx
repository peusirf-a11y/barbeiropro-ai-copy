// MetricCard — card premium reutilizável para KPIs do painel master.
// Suporta: valor monetário, delta percentual, ícone, cor temática e estado de loading.
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

const fmtNumber = (v) => Number(v || 0).toLocaleString('pt-BR');

const COLORS = {
  emerald: 'text-emerald-700 bg-emerald-50 ring-emerald-100',
  red: 'text-red-600 bg-red-50 ring-red-100',
  blue: 'text-[#2563EB] bg-[#EFF6FF] ring-[#DBEAFE]',
  amber: 'text-amber-600 bg-amber-50 ring-amber-100',
  gray: 'text-gray-700 bg-gray-100 ring-gray-200',
  violet: 'text-violet-700 bg-violet-50 ring-violet-100',
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
    : money ? fmtMoney(value) : `${fmtNumber(value)}${suffix}`;

  const deltaIcon = delta == null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaColor = delta == null ? '' : delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-gray-500';
  const DeltaIcon = deltaIcon;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${COLORS[color] || COLORS.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
        {delta != null && !loading && (
          <div className={`flex items-center gap-1 text-xs font-bold ${deltaColor}`}>
            <DeltaIcon className="w-3.5 h-3.5" />
            {delta > 0 ? '+' : ''}{delta}%
          </div>
        )}
      </div>
      <div className={`font-black text-foreground tracking-tight leading-none ${money ? 'text-2xl' : 'text-[28px]'}`}>
        {displayValue}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-2">{label}</div>
      {(hint || deltaLabel) && !loading && (
        <div className="text-[11px] text-muted-foreground mt-1 font-medium">{hint || deltaLabel}</div>
      )}
    </div>
  );
}