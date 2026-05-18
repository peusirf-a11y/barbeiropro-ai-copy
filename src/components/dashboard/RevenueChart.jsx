// Gráfico de receita 7 dias — dark fintech premium com gradiente glow.

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';

function buildSeries(financial, days = 7) {
  const today = startOfDay(new Date());
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(today, i);
    const dayStr = format(day, 'yyyy-MM-dd');
    const total = financial
      .filter(f => f.type === 'entrada' && (f.date || '').startsWith(dayStr))
      .reduce((s, f) => s + (f.amount || 0), 0);
    series.push({
      day: format(day, 'dd MMM', { locale: ptBR }),
      label: format(day, 'EEE', { locale: ptBR }),
      total: Number(total.toFixed(2)),
    });
  }
  return series;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value || 0;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A1124]/95 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] px-3 py-2 text-xs">
      <div className="text-white/50 font-medium">{payload[0].payload.day}</div>
      <div className="text-white font-bold mt-0.5">R$ {v.toFixed(2).replace('.', ',')}</div>
    </div>
  );
}

export default function RevenueChart({ financial = [] }) {
  const data = buildSeries(financial, 7);
  const total = data.reduce((s, d) => s + d.total, 0);
  const hasData = data.some(d => d.total > 0);

  return (
    <div className="relative rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 sm:p-6 overflow-hidden">
      {/* Glow sutil no topo */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-3/4 h-40 bg-[#2563EB]/15 blur-3xl pointer-events-none" />

      <div className="relative flex items-start justify-between mb-1">
        <div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-md bg-[#60A5FA]/40 blur-md" />
              <TrendingUp className="relative w-4 h-4 text-[#93C5FD]" />
            </div>
            <h2 className="font-bold text-white text-base">Faturamento</h2>
          </div>
          <p className="text-xs text-white/50 mt-0.5">Últimos 7 dias</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-white/45">Total</div>
          <div className="text-xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
            R$ {total.toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>

      <div className="relative h-[220px] mt-4">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#60A5FA" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="revLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#93C5FD" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" stroke="rgba(148,163,184,0.6)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(148,163,184,0.6)" fontSize={11} tickLine={false} axisLine={false} width={50}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#60A5FA', strokeOpacity: 0.25, strokeWidth: 2 }} />
              <Area type="monotone" dataKey="total" stroke="url(#revLine)" strokeWidth={2.5} fill="url(#revGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-center text-white/45 text-sm">
            Sem faturamento registrado nos últimos 7 dias.
          </div>
        )}
      </div>
    </div>
  );
}