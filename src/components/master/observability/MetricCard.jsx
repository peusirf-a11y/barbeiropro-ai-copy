// MetricCard — card compacto para KPIs operacionais do painel de observabilidade.
export default function MetricCard({ label, value, sub, tone = 'gray', icon: Icon }) {
  const TONES = {
    blue:    'ring-blue-400/25 text-blue-300',
    green:   'ring-emerald-400/25 text-emerald-300',
    amber:   'ring-amber-400/25 text-amber-300',
    red:     'ring-rose-400/25 text-rose-300',
    purple:  'ring-purple-400/25 text-purple-300',
    gray:    'ring-slate-400/20 text-slate-300',
  };
  const ring = TONES[tone] || TONES.gray;

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</div>
        {Icon && (
          <div className={`w-7 h-7 rounded-lg bg-white/[0.04] ring-1 flex items-center justify-center ${ring}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div className="text-2xl font-black tracking-tight text-white">{value}</div>
      {sub && <div className="text-xs text-white/50 mt-1">{sub}</div>}
    </div>
  );
}