// RevenueHistoryChart — gráfico de receita dos últimos 12 meses.
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-[var(--shadow-md)]">
      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-black text-foreground">{fmtMoney(data.mrr)}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{data.active} empresas ativas</div>
    </div>
  );
}

export default function RevenueHistoryChart({ history = [] }) {
  if (history.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-[var(--shadow-sm)]">
        <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <div className="text-sm font-semibold text-foreground">Sem histórico disponível</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-foreground text-lg tracking-tight">Receita histórica</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">MRR estimado dos últimos 12 meses</p>
        </div>
      </div>
      <div className="h-64 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="mrr" stroke="#2563EB" strokeWidth={2.5} fill="url(#mrrGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}