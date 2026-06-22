// Gráfico de evolução mensal (6 meses) — indicações + comissões geradas.
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

const brl = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/15 bg-[#0A1124]/95 backdrop-blur-md px-3 py-2 text-xs shadow-xl">
      <div className="font-bold text-white mb-1 capitalize">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-white/80">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.dataKey === 'commissions' ? 'Comissões' : p.dataKey === 'referrals' ? 'Indicações' : 'Convertidas'}:</span>
          <span className="font-bold">{p.dataKey === 'commissions' ? brl(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function PartnerEvolutionChart({ data = [] }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Evolução mensal</h3>
          <p className="text-[11px] text-white/45 mt-0.5">Últimos 6 meses</p>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="month" stroke="rgba(255,255,255,0.45)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="rgba(255,255,255,0.45)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(96,165,250,0.06)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} iconType="circle" />
            <Bar dataKey="referrals" name="Indicações" fill="#60A5FA" radius={[6, 6, 0, 0]} />
            <Bar dataKey="converted" name="Convertidas" fill="#34D399" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}