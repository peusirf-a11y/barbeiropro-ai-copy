import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Users, DollarSign, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
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
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => base44.entities.Appointment.list('-scheduled_at', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: financial = [] } = useQuery({
    queryKey: ['financial'],
    queryFn: () => base44.entities.FinancialEntry.list(),
  });

  const todayStr = new Date().toDateString();
  const todayAppts = appointments.filter(a => new Date(a.scheduled_at).toDateString() === todayStr);
  const revenue = financial.filter(f => f.type === 'entrada').reduce((sum, f) => sum + f.amount, 0);
  const completed = appointments.filter(a => a.status === 'concluido').length;

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-[#1B1C1E]">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Agendamentos hoje', value: todayAppts.length, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Receita total', value: `R$${revenue.toFixed(0)}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Total clientes', value: customers.length, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Concluídos', value: completed, icon: CheckCircle, color: 'text-[#1B3A4B]', bg: 'bg-[#1B3A4B]/10' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-black/8 p-6">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-4`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="text-2xl font-black text-[#1B1C1E]">{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-black/8 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-[#1B1C1E]">Agenda de hoje</h2>
              <Link to="/app/agenda" className="text-xs text-[#1B3A4B] font-medium hover:underline">Ver tudo</Link>
            </div>
            {todayAppts.length > 0 ? (
              <div className="space-y-3">
                {todayAppts.slice(0, 6).map(appt => (
                  <div key={appt.id} className="flex items-center gap-4 p-3 rounded-xl bg-[#F8F7F3]">
                    <div className="w-14 text-center">
                      <div className="font-bold text-sm text-[#1B1C1E]">
                        {format(new Date(appt.scheduled_at), 'HH:mm')}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[#1B1C1E] truncate">{appt.customer_name || 'Cliente'}</div>
                      <div className="text-xs text-gray-400">{appt.service_name}</div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${statusConfig[appt.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                      {statusConfig[appt.status]?.label || appt.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nenhum agendamento hoje</p>
                <Link to="/app/agenda" className="text-xs text-[#1B3A4B] font-medium mt-2 inline-block hover:underline">
                  Criar agendamento
                </Link>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-black/8 p-6">
            <h2 className="font-bold text-[#1B1C1E] mb-5">Início rápido</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nova agenda', href: '/app/agenda', icon: Calendar },
                { label: 'Novo cliente', href: '/app/clientes', icon: Users },
                { label: 'Lançamento', href: '/app/financeiro', icon: DollarSign },
                { label: 'AI Growth', href: '/app/ai-growth', icon: TrendingUp },
              ].map(item => (
                <Link key={item.href} to={item.href}
                  className="flex items-center gap-3 p-4 bg-[#F8F7F3] rounded-xl hover:bg-[#1B3A4B]/5 transition-colors">
                  <item.icon className="w-4 h-4 text-[#1B3A4B]" />
                  <span className="text-sm font-medium text-[#1B1C1E]">{item.label}</span>
                </Link>
              ))}
            </div>

            {appointments.length === 0 && customers.length === 0 && (
              <div className="mt-5 p-4 bg-[#1B3A4B]/5 border border-[#1B3A4B]/20 rounded-xl">
                <p className="text-sm font-semibold text-[#1B3A4B] mb-1">Configure sua barbearia</p>
                <p className="text-xs text-gray-500 mb-3">Complete o onboarding para começar a receber agendamentos.</p>
                <Link to="/onboarding" className="text-xs font-semibold text-[#1B3A4B] hover:underline">
                  Ir para onboarding →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}