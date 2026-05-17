/**
 * DemoRelatorios — Réplica exata do AppRelatorios com dados demo.
 * Mesmos gráficos, mesmos KPIs, mesma estrutura visual.
 */
import DemoLayout from '@/components/layout/DemoLayout.jsx';
import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { BarChart2 } from 'lucide-react';
import AppPageHeader from '@/components/app/AppPageHeader';
import FilterSelect from '@/components/ui/filter-select';
import { demoAppointments, demoFinancial, demoCustomers } from '@/lib/demoData';

const COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];

export default function DemoRelatorios() {
  const [period, setPeriod] = useState('this_month');

  const now = new Date();

  const filterByPeriod = (item, dateField = 'scheduled_at') => {
    const d = new Date(item[dateField]);
    if (period === 'this_month') return d >= startOfMonth(now) && d <= endOfMonth(now);
    if (period === 'last_month') {
      const lm = subMonths(now, 1);
      return d >= startOfMonth(lm) && d <= endOfMonth(lm);
    }
    return true;
  };

  const periodAppts = demoAppointments.filter(a => filterByPeriod(a));
  const completedAppts = periodAppts.filter(a => a.status === 'concluido');
  const periodFinancial = demoFinancial.filter(f => filterByPeriod(f, 'date'));

  const totalRevenue = periodFinancial.filter(f => f.type === 'entrada').reduce((s, f) => s + (f.amount || 0), 0);
  const apptRevenue = completedAppts.reduce((s, a) => s + (a.price || 0), 0);
  const effectiveRevenue = totalRevenue || apptRevenue;
  const avgTicket = completedAppts.length > 0 ? effectiveRevenue / completedAppts.length : 0;
  const cancelledRate = periodAppts.length > 0
    ? ((periodAppts.filter(a => a.status === 'cancelado').length / periodAppts.length) * 100).toFixed(0)
    : 0;

  const serviceData = useMemo(() => {
    const map = {};
    completedAppts.forEach(a => {
      if (!a.service_name) return;
      map[a.service_name] = (map[a.service_name] || 0) + 1;
    });
    return Object.entries(map).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [completedAppts]);

  const proData = useMemo(() => {
    const map = {};
    completedAppts.forEach(a => {
      if (!a.professional_name) return;
      map[a.professional_name] = (map[a.professional_name] || 0) + 1;
    });
    return Object.entries(map).map(([name, atendimentos]) => ({ name, atendimentos })).sort((a, b) => b.atendimentos - a.atendimentos);
  }, [completedAppts]);

  const customerMap = {};
  completedAppts.forEach(a => { if (a.customer_id) customerMap[a.customer_id] = (customerMap[a.customer_id] || 0) + 1; });
  const recurringCount = Object.values(customerMap).filter(v => v >= 2).length;

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
        <AppPageHeader
          title="Relatórios"
          subtitle="Análise da operação Studio 47"
          icon={BarChart2}
        >
          <FilterSelect value={period} onChange={setPeriod} aria-label="Período">
            <option value="this_month">Este mês</option>
            <option value="last_month">Mês passado</option>
            <option value="all">Todo o período</option>
          </FilterSelect>
        </AppPageHeader>

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mb-6">
          {[
            { label: 'Total agendamentos', value: periodAppts.length },
            { label: 'Concluídos', value: completedAppts.length },
            { label: 'Receita', value: `R$${effectiveRevenue.toFixed(0)}` },
            { label: 'Ticket médio', value: `R$${avgTicket.toFixed(0)}` },
            { label: 'Taxa cancelamento', value: `${cancelledRate}%` },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-black/5 p-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all">
              <div className="text-xl lg:text-2xl font-black text-[#111827] tracking-tight">{s.value}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-5 mb-5">
          <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
            <h2 className="font-bold text-[#111827] mb-4">Serviços mais vendidos</h2>
            {serviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serviceData} margin={{ left: -10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#2563EB" radius={[4, 4, 0, 0]} name="Vendas" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-[#6B7280] text-sm">
                Sem atendimentos concluídos no período
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
            <h2 className="font-bold text-[#111827] mb-4">Profissionais mais ativos</h2>
            {proData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={proData} margin={{ left: -10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="atendimentos" fill="#60A5FA" radius={[4, 4, 0, 0]} name="Atendimentos" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-[#6B7280] text-sm">
                Sem dados no período
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {serviceData.length > 0 && (
            <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
              <h2 className="font-bold text-[#111827] mb-4">Distribuição de serviços</h2>
              <div className="flex items-center gap-6">
                <PieChart width={140} height={140}>
                  <Pie data={serviceData} dataKey="total" cx={65} cy={65} outerRadius={60} innerRadius={30}>
                    {serviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
                <div className="space-y-2 flex-1">
                  {serviceData.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-[#6B7280] truncate max-w-[100px]">{s.name}</span>
                      </div>
                      <span className="text-xs font-bold text-[#111827]">{s.total}x</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-[var(--shadow-sm)]">
            <h2 className="font-bold text-[#111827] mb-4">Indicadores de clientes</h2>
            <div className="space-y-4">
              {[
                { label: 'Total de clientes cadastrados', value: demoCustomers.length },
                { label: 'Clientes recorrentes no período', value: recurringCount },
                { label: 'Novos agendamentos no período', value: periodAppts.length },
                { label: 'Taxa de conclusão', value: periodAppts.length > 0 ? `${((completedAppts.length / periodAppts.length) * 100).toFixed(0)}%` : '–' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                  <span className="text-sm text-[#6B7280]">{item.label}</span>
                  <span className="text-sm font-bold text-[#2563EB]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DemoLayout>
  );
}