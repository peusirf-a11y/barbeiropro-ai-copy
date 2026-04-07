import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { Calendar, Users, DollarSign, CheckCircle, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfMonth, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const statusConfig = {
  agendado: { label: 'Agendado', color: 'bg-blue-100 text-blue-700' },
  confirmado: { label: 'Confirmado', color: 'bg-green-100 text-green-700' },
  em_atendimento: { label: 'Na Cadeira', color: 'bg-yellow-100 text-yellow-700' },
  concluido: { label: 'Concluído', color: 'bg-gray-100 text-gray-600' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-600' },
  faltou: { label: 'Faltou', color: 'bg-orange-100 text-orange-600' },
};

export default function AppDashboard() {
  const { company, companyId, isLoading: loadingCompany } = useCompany();

  const { data: appointments = [], isLoading: loadingAppts } = useQuery({
    queryKey: ['appointments', companyId],
    queryFn: () => base44.entities.Appointment.filter({ company_id: companyId }, '-scheduled_at', 200),
    enabled: !!companyId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: () => base44.entities.Customer.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: financial = [] } = useQuery({
    queryKey: ['financial', companyId],
    queryFn: () => base44.entities.FinancialEntry.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const now = new Date();
  const todayStr = now.toDateString();

  const todayAppts = appointments.filter(a => new Date(a.scheduled_at).toDateString() === todayStr);
  const upcomingToday = todayAppts
    .filter(a => new Date(a.scheduled_at) >= now && !['cancelado', 'concluido', 'faltou'].includes(a.status))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  const monthStart = startOfMonth(now);
  const monthAppts = appointments.filter(a => new Date(a.scheduled_at) >= monthStart);
  const completedMonth = monthAppts.filter(a => a.status === 'concluido');
  const revenue = financial.filter(f => f.type === 'entrada' && new Date(f.date) >= monthStart).reduce((s, f) => s + (f.amount || 0), 0);
  const avgTicket = completedMonth.length > 0 ? revenue / completedMonth.length : 0;

  // Top services
  const serviceMap = {};
  completedMonth.forEach(a => {
    if (!a.service_name) return;
    serviceMap[a.service_name] = (serviceMap[a.service_name] || 0) + 1;
  });
  const topServices = Object.entries(serviceMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Top professionals
  const proMap = {};
  completedMonth.forEach(a => {
    if (!a.professional_name) return;
    proMap[a.professional_name] = (proMap[a.professional_name] || 0) + 1;
  });
  const topPros = Object.entries(proMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Alerts
  const alerts = [];
  const activeToday = todayAppts.filter(a => !['cancelado', 'faltou'].includes(a.status));
  if (activeToday.length === 0) alerts.push({ msg: 'Sem agendamentos para hoje', type: 'info' });

  const isLoading = loadingCompany || loadingAppts;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[#1B3A4B]/20 border-t-[#1B3A4B] rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#1B1C1E]">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{format(now, "EEEE, d 'de' MMMM", { locale: ptBR })} · {company?.name || 'Sua barbearia'}</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Agendamentos hoje', value: todayAppts.length, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Faturamento (mês)', value: `R$${revenue.toFixed(0)}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Total clientes', value: customers.length, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Ticket médio', value: `R$${avgTicket.toFixed(0)}`, icon: TrendingUp, color: 'text-[#1B3A4B]', bg: 'bg-[#1B3A4B]/10' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-black/8 p-5">
              <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className="text-2xl font-black text-[#1B1C1E]">{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Agenda do dia */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-black/8 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#1B1C1E]">Agenda de hoje</h2>
              <Link to="/app/agenda" className="text-xs text-[#1B3A4B] font-medium hover:underline">Ver agenda →</Link>
            </div>
            {todayAppts.length > 0 ? (
              <div className="space-y-2 max-h-[340px] overflow-y-auto">
                {todayAppts.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)).map(appt => (
                  <div key={appt.id} className="flex items-center gap-4 p-3 rounded-xl bg-[#F8F7F3]">
                    <div className="w-14 text-center flex-shrink-0">
                      <div className="font-bold text-sm text-[#1B1C1E]">{format(new Date(appt.scheduled_at), 'HH:mm')}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[#1B1C1E] truncate">{appt.customer_name || 'Cliente'}</div>
                      <div className="text-xs text-gray-400">{appt.service_name} · {appt.professional_name}</div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0 ${statusConfig[appt.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                      {statusConfig[appt.status]?.label || appt.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nenhum agendamento hoje</p>
                <Link to="/app/agenda" className="text-xs text-[#1B3A4B] font-medium mt-2 inline-block hover:underline">Criar agendamento →</Link>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Próximos horários */}
            {upcomingToday.length > 0 && (
              <div className="bg-white rounded-2xl border border-black/8 p-5">
                <h3 className="font-bold text-[#1B1C1E] mb-3 text-sm">Próximos horários</h3>
                <div className="space-y-2">
                  {upcomingToday.slice(0, 4).map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <Clock className="w-3.5 h-3.5 text-[#1B3A4B] flex-shrink-0" />
                      <span className="font-semibold text-[#1B1C1E]">{format(new Date(a.scheduled_at), 'HH:mm')}</span>
                      <span className="text-gray-500 truncate">{a.customer_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top serviços */}
            {topServices.length > 0 && (
              <div className="bg-white rounded-2xl border border-black/8 p-5">
                <h3 className="font-bold text-[#1B1C1E] mb-3 text-sm">Serviços mais vendidos (mês)</h3>
                <div className="space-y-2">
                  {topServices.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 truncate">{name}</span>
                      <span className="text-sm font-bold text-[#1B3A4B]">{count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top profissionais */}
            {topPros.length > 0 && (
              <div className="bg-white rounded-2xl border border-black/8 p-5">
                <h3 className="font-bold text-[#1B1C1E] mb-3 text-sm">Profissionais ativos (mês)</h3>
                <div className="space-y-2">
                  {topPros.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 truncate">{name}</span>
                      <span className="text-sm font-bold text-[#1B3A4B]">{count} atend.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ações rápidas */}
            <div className="bg-white rounded-2xl border border-black/8 p-5">
              <h3 className="font-bold text-[#1B1C1E] mb-3 text-sm">Ações rápidas</h3>
              <div className="space-y-2">
                {[
                  { label: '+ Novo agendamento', href: '/app/agenda' },
                  { label: '+ Novo cliente', href: '/app/clientes' },
                  { label: '+ Lançamento financeiro', href: '/app/financeiro' },
                ].map(item => (
                  <Link key={item.href} to={item.href}
                    className="block text-sm font-medium text-[#1B3A4B] hover:underline py-1">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}