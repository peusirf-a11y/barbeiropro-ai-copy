// HourlySeriesChart — barra simples 24h via recharts (lightweight).
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useTheme } from '@/theme/ThemeProvider';

export default function HourlySeriesChart({ data, color = '#60A5FA', height = 140 }) {
  const { isDark } = useTheme();
  if (!data || data.length === 0) {
    return <div className="text-xs text-slate-400 dark:text-white/40 py-6 text-center">Sem dados na janela.</div>;
  }
  const tickColor = isDark ? 'rgba(255,255,255,0.50)' : '#55596A';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: tickColor }}
          tickLine={false}
          axisLine={false}
          interval={3}
        />
        <YAxis
          tick={{ fontSize: 10, fill: tickColor }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: isDark ? '#0A1124' : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EF'}`,
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: isDark ? '#fff' : '#0F172A' }}
          itemStyle={{ color }}
          cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}
        />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}