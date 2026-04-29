// Gráfico de área: evolução de faturamento dos últimos 7 dias.
// Visual limpo, gradiente azul suave, tooltip mínimo.

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
    <div className="bg-white border border-black/5 rounded-xl shadow-[var(--shadow-md)] px-3 py-2 text-xs">
      <div className="text-[#6B7280] font-medium">{payload[0].payload.day}</div>
      <div className="text-[#111827] font-bold mt-0.5">R$ {v.toFixed(2).replace('.', ',')}</div>
    </div>
  );
}

export default function RevenueChart({ financial = [] }) {
  const data = buildSeries(financial, 7);
  const total = data.reduce((s, d) => s + d.total, 0);
  const hasData = data.some(d => d.total > 0);

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#2563EB]" />
            <h2 className="font-bold text-[#111827] text-base">Faturamento</h2>
          </div>
          <p className="text-xs text-[#6B7280] mt-0.5">Últimos 7 dias</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#6B7280]">Total</div>
          <div className="text-xl font-black text-[#111827] tracking-tight">
            R$ {total.toFixed(2).replace('.', ',')}
          </div>
        </div>
      </div>

      <div className="h-[220px] mt-4">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} width={50}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2563EB', strokeOpacity: 0.15, strokeWidth: 2 }} />
              <Area type="monotone" dataKey="total" stroke="#2563EB" strokeWidth={2.5} fill="url(#revGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-center text-[#6B7280] text-sm">
            Sem faturamento registrado nos últimos 7 dias.
          </div>
        )}
      </div>
    </div>
  );
}