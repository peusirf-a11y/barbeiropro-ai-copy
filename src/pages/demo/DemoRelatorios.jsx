/**
 * DemoRelatorios — Gráficos e KPIs idênticos ao AppRelatorios.
 */
import DemoLayout from '@/components/layout/DemoLayout';
import { demoAppointments, demoServices, demoProfessionals, demoFinancial, demoCustomers } from '@/lib/demoData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import KpiCard from '@/components/dashboard/KpiCard';
import { DollarSign, Users, Calendar, TrendingUp } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];

function buildMonthlyData() {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    return {
      label: format(d, 'MMM', { locale: ptBR }),
      month: format(d, 'yyyy-MM'),
      receita: 0,
      atendimentos: 0,
    };
  });
  demoFinancial.filter(f => f.type === 'entrada').forEach(f => {
    const m = months.find(x => f.date?.startsWith(x.month));
    if (m) m.receita += f.amount;
  });
  demoAppointments.filter(a => a.status === 'concluido').forEach(a => {
    const month = a.scheduled_at?.slice(0, 7);
    const m = months.find(x => x.month === month);
    if (m) m.atendimentos += 1;
  });
  return months;
}

export default function DemoRelatorios() {
  const serviceData = demoServices.map(s => ({
    name: s.name,
    total: demoAppointments.filter(a => a.service_id === s.id).length,
    receita: demoAppointments.filter(a => a.service_id === s.id && a.status === 'concluido').length * s.price,
  })).sort((a, b) => b.total - a.total);

  const profData = demoProfessionals.map(p => ({
    name: p.name.split(' ')[0],
    atendimentos: demoAppointments.filter(a => a.professional_id === p.id && a.status === 'concluido').length,
  }));

  const totalRevenue = demoFinancial.filter(f => f.type === 'entrada').reduce((s, f) => s + f.amount, 0);
  const completedCount = demoAppointments.filter(a => a.status === 'concluido').length;
  const avgTicket = completedCount > 0 ? totalRevenue / completedCount : 0;
  const conclusionRate = demoAppointments.length > 0
    ? Math.round(completedCount / demoAppointments.length * 100)
    : 0;
  const retentionRate = Math.round(demoCustomers.filter(c => c.total_appointments >= 3).length / demoCustomers.length * 100);

  const monthlyData = buildMonthlyData();

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#1B1C1E]">Relatórios</h1>
          <p className="text-gray-500 text-sm mt-1">Visão geral do período</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard label="Agendamentos"   value={demoAppointments.length}                                   icon={Calendar}   tone="blue"  sub="total" />
          <KpiCard label="Receita total"  value={`R$ ${totalRevenue.toFixed(0)}`}                           icon={DollarSign} tone="green" sub="período" />
          <KpiCard label="Ticket médio"   value={`R$ ${avgTicket.toFixed(0)}`}                              icon={TrendingUp} tone="amber" sub="por cliente" />
          <KpiCard label="Taxa conclusão" value={`${conclusionRate}%`}                                      icon={Users}      tone="blue"  sub="dos agend." />
        </div>

        {/* Gráfico de linha: receita mensal */}
        <div className="bg-white rounded-2xl border border-black/5 p-6 mb-6 shadow-[var(--shadow-sm)]">
          <h2 className="font-bold text-[#1B1C1E] mb-5">Faturamento mensal (últimos 6 meses)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} />
              <Tooltip formatter={(v) => `R$ ${Number(v).toFixed(2)}`} />
              <Legend />
              <Line type="monotone" dataKey="receita" name="Receita" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="atendimentos" name="Atendimentos" stroke="#60A5FA" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Serviços mais vendidos */}
          <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
            <h2 className="font-bold text-[#1B1C1E] mb-5">Serviços mais vendidos</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={serviceData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Atendimentos por profissional */}
          <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
            <h2 className="font-bold text-[#1B1C1E] mb-5">Atendimentos por profissional</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={profData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="atendimentos" fill="#60A5FA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição de receita */}
        <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
          <h2 className="font-bold text-[#1B1C1E] mb-4">Distribuição de receita por serviço</h2>
          <div className="flex flex-wrap gap-4">
            {serviceData.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-4 py-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <div>
                  <div className="text-sm font-semibold text-[#1B1C1E]">{s.name}</div>
                  <div className="text-xs text-gray-500">R$ {s.receita} · {s.total} vendas</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DemoLayout>
  );
}