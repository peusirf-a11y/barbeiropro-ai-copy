// Card de KPI compacto e premium para o painel do parceiro.
const TONES = {
  blue: { bg: 'bg-blue-400/12', ring: 'ring-blue-400/25', text: 'text-blue-200' },
  emerald: { bg: 'bg-emerald-400/12', ring: 'ring-emerald-400/25', text: 'text-emerald-200' },
  amber: { bg: 'bg-amber-400/12', ring: 'ring-amber-400/25', text: 'text-amber-200' },
  violet: { bg: 'bg-violet-400/12', ring: 'ring-violet-400/25', text: 'text-violet-200' },
  rose: { bg: 'bg-rose-400/12', ring: 'ring-rose-400/25', text: 'text-rose-200' },
};

export default function PartnerKpiCard({ label, value, sub, icon: Icon, tone = 'blue', highlight }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <div className={`rounded-2xl border ${highlight ? 'border-blue-400/35 bg-blue-500/[0.06]' : 'border-white/8 bg-white/[0.025]'} backdrop-blur-md p-4 transition-all hover:border-white/15`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className={`w-9 h-9 rounded-xl ${t.bg} ring-1 ${t.ring} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${t.text}`} />
        </div>
      </div>
      <div className="text-xl lg:text-2xl font-black text-white tracking-tight">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-white/45 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}