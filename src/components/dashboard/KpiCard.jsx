// Card de KPI premium — número grande, ícone colorido, delta opcional.
// Usado no topo do Dashboard. Tons sutis para não poluir.

import { TrendingUp, TrendingDown } from 'lucide-react';

const TONES = {
  blue:    { bg: 'bg-[#EFF6FF]', icon: 'text-[#2563EB]', ring: 'ring-[#DBEAFE]' },
  green:   { bg: 'bg-[#ECFDF5]', icon: 'text-emerald-600', ring: 'ring-emerald-100' },
  amber:   { bg: 'bg-[#FFFBEB]', icon: 'text-amber-600', ring: 'ring-amber-100' },
  red:     { bg: 'bg-[#FEF2F2]', icon: 'text-red-600', ring: 'ring-red-100' },
  violet:  { bg: 'bg-[#F5F3FF]', icon: 'text-violet-600', ring: 'ring-violet-100' },
};

export default function KpiCard({ label, value, sub, icon: Icon, tone = 'blue', delta }) {
  const t = TONES[tone] || TONES.blue;
  const isPositive = typeof delta === 'number' && delta >= 0;
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${t.bg} ring-1 ${t.ring} flex items-center justify-center`}>
          {Icon && <Icon className={`w-5 h-5 ${t.icon}`} />}
        </div>
        {typeof delta === 'number' && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">{label}</div>
      <div className="text-2xl lg:text-[28px] font-black text-[#111827] tracking-tight leading-none">{value}</div>
      {sub && <div className="text-xs text-[#6B7280] mt-2">{sub}</div>}
    </div>
  );
}