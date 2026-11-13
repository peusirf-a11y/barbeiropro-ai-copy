// RevenueChart.jsx — Gráfico Executivo de Faturamento (Recharts)
// Customizado com os tokens: #171827, #2563EB, #59658F, #B5D7E8, #E5E7EF e tabular-nums
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, DollarSign } from 'lucide-react';

function buildSeries(financial, days = 7) {
  const today = startOfDay(new Date());
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(today, i);
    const dayStr = format(day, 'yyyy-MM-dd');
    const total = financial
      .filter((f) => f.type === 'entrada' && (f.date || '').startsWith(dayStr))
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
    <div className="rounded-xl border border-white/10 bg-[#171827] text-white shadow-xl px-3.5 py-2 text-xs">
      <div className="text-[#B5D7E8] font-bold uppercase tracking-wider text-[10px]">
        {payload[0].payload.day}
      </div>
      <div className="text-white font-extrabold text-sm mt-0.5 tabular-nums">
        R$ {v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

export default function RevenueChart({ financial = [] }) {
  const data = buildSeries(financial, 7);
  const total = data.reduce((s, d) => s + d.total, 0);
  const hasData = data.some((d) => d.total > 0);

  return (
    <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] p-4 sm:p-6 shadow-sm">
      {/* Header do Gráfico */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#DBEAFE] dark:border-blue-800/40 flex items-center justify-center font-bold">
            <TrendingUp className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-extrabold text-[#171827] dark:text-white text-base tracking-tight">
              Faturamento Recente
            </h2>
            <p className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-medium mt-0.5">
              Receita consolidada dos últimos 7 dias
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#59658F] dark:text-[#7E8BAF]">
            Volume Total
          </div>
          <div className="text-xl sm:text-2xl font-black tracking-tight text-[#171827] dark:text-white tabular-nums">
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Área Recharts */}
      <div className="h-[230px] mt-4">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="biRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#B5D7E8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EF" vertical={false} opacity={0.7} />
              <XAxis
                dataKey="label"
                stroke="#55596A"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                className="tabular-nums font-medium"
              />
              <YAxis
                stroke="#55596A"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={55}
                className="tabular-nums font-medium"
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#59658F', strokeWidth: 1.5, strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#2563EB"
                strokeWidth={2.5}
                fill="url(#biRevenueGradient)"
                activeDot={{ r: 5, fill: '#171827', stroke: '#B5D7E8', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#55596A] dark:text-[#8F9BBF] text-xs">
            <DollarSign className="w-8 h-8 text-[#59658F]/40 mb-1" strokeWidth={1.75} />
            <span>Sem faturamento registrado nos últimos 7 dias.</span>
          </div>
        )}
      </div>
    </div>
  );
}