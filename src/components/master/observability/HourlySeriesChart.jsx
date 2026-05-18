// HourlySeriesChart — barra simples 24h via recharts (lightweight).
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function HourlySeriesChart({ data, color = '#60A5FA', height = 140 }) {
  if (!data || data.length === 0) {
    return <div className="text-xs text-white/40 py-6 text-center">Sem dados na janela.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.45)' }}
          tickLine={false}
          axisLine={false}
          interval={3}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.45)' }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: '#0A1124',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#fff' }}
          itemStyle={{ color }}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}