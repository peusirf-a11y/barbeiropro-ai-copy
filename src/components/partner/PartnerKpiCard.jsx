// Card de KPI compacto e premium para o painel do parceiro.
const TONES = {
  blue: { bg: 'bg-[#2563EB]/10 dark:bg-[#2563EB]/20', border: 'border-[#2563EB]/20', text: 'text-[#2563EB] dark:text-[#93C5FD]' },
  emerald: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', border: 'border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-300' },
  amber: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', border: 'border-amber-500/20', text: 'text-amber-600 dark:text-amber-300' },
  violet: { bg: 'bg-violet-500/10 dark:bg-violet-500/20', border: 'border-violet-500/20', text: 'text-violet-600 dark:text-violet-300' },
  rose: { bg: 'bg-rose-500/10 dark:bg-rose-500/20', border: 'border-rose-500/20', text: 'text-rose-600 dark:text-rose-300' },
};

export default function PartnerKpiCard({ label, value, sub, icon: Icon, tone = 'blue', highlight }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <div
      className={`rounded-2xl border transition-all p-4 shadow-sm ${
        highlight
          ? 'border-[#2563EB]/40 bg-[#2563EB]/5 dark:bg-[#2563EB]/10'
          : 'border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827]'
      }`}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className={`w-9 h-9 rounded-xl ${t.bg} border ${t.border} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${t.text}`} strokeWidth={1.75} />
        </div>
      </div>
      <div className="text-xl lg:text-2xl font-black text-[#171827] dark:text-white tracking-tight tabular-nums">
        {value}
      </div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#59658F] dark:text-white/60 mt-0.5">
        {label}
      </div>
      {sub && <div className="text-[11px] text-[#55596A] dark:text-white/45 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}