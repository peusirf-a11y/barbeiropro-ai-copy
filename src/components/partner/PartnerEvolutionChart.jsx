// Gráfico de evolução mensal (6 meses) — indicações + comissões geradas.
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#232538] bg-[#171827] px-3.5 py-2.5 text-xs shadow-xl text-white">
      <div className="font-bold text-white mb-1.5 capitalize">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-white/80 tabular-nums">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize text-white/60">{p.dataKey === 'commissions' ? 'Comissões' : p.dataKey === 'referrals' ? 'Indicações' : 'Convertidas'}:</span>
          <span className="font-bold text-white">{p.dataKey === 'commissions' ? brl(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function PartnerEvolutionChart({ data = [] }) {
  const hasData = data && data.length > 0 && data.some((d) => (Number(d.referrals) > 0 || Number(d.commissions) > 0 || Number(d.converted) > 0));

  return (
    <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-white dark:bg-[#171827] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#171827] dark:text-white">Evolução mensal</h3>
          <p className="text-[11px] text-[#55596A] dark:text-white/50 mt-0.5">Histórico de indicações e comissões</p>
        </div>
      </div>
      {!hasData ? (
        <div className="h-44 flex flex-col items-center justify-center rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-dashed border-[#E5E7EF] dark:border-[#232538] text-center p-6 space-y-1">
          <p className="text-xs font-semibold text-[#171827] dark:text-white/70">Sem histórico de indicações recente.</p>
          <p className="text-[11px] text-[#55596A] dark:text-white/40">Assim que você indicar novas barbearias, seu gráfico mensal aparecerá aqui.</p>
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} className="tabular-nums" />
              <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#59658F' }} iconType="circle" />
              <Bar dataKey="referrals" name="Indicações" fill="#2563EB" radius={[6, 6, 0, 0]} />
              <Bar dataKey="converted" name="Convertidas" fill="#10B981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}