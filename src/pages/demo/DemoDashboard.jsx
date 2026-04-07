import DemoLayout from '@/components/layout/DemoLayout';
import { demoAppointments, demoCustomers, demoFinancial, demoProfessionals } from '@/lib/demoData';
import { Calendar, Users, DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig = {
  agendado: { label: 'Agendado', color: 'bg-blue-100 text-blue-700' },
  confirmado: { label: 'Confirmado', color: 'bg-green-100 text-green-700' },
  em_atendimento: { label: 'Na Cadeira', color: 'bg-yellow-100 text-yellow-700' },
  concluido: { label: 'Concluído', color: 'bg-gray-100 text-gray-600' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-600' },
  faltou: { label: 'Faltou', color: 'bg-orange-100 text-orange-600' },
};

export default function DemoDashboard() {
  const todayStr = new Date().toDateString();
  const todayAppts = demoAppointments.filter(a => new Date(a.scheduled_at).toDateString() === todayStr);
  const revenue = demoFinancial.filter(f => f.type === 'entrada').reduce((sum, f) => sum + f.amount, 0);
  const completed = demoAppointments.filter(a => a.status === 'concluido').length;
  const activeCustomers = demoCustomers.filter(c => c.status !== 'inactive').length;

  return (
    <DemoLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-[#1B1C1E]">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Atendimentos hoje', value: todayAppts.length, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Receita do mês', value: `R$${revenue.toFixed(0)}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Clientes ativos', value: activeCustomers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
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

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Today's appointments */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-black/8 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-[#1B1C1E]">Agenda de hoje</h2>
              <span className="text-xs text-gray-400">{todayAppts.length} agendamentos</span>
            </div>
            <div className="space-y-3">
              {todayAppts.map(appt => (
                <div key={appt.id} className="flex items-center gap-4 p-3 rounded-xl bg-[#F8F7F3] hover:bg-gray-50 transition-colors">
                  <div className="text-center w-14">
                    <div className="font-bold text-sm text-[#1B1C1E]">
                      {format(new Date(appt.scheduled_at), 'HH:mm')}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[#1B1C1E] truncate">{appt.customer_name}</div>
                    <div className="text-xs text-gray-400">{appt.service_name} · {appt.professional_name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${statusConfig[appt.status].color}`}>
                      {statusConfig[appt.status].label}
                    </span>
                    <span className="text-sm font-bold text-[#1B3A4B]">R${appt.price}</span>
                  </div>
                </div>
              ))}
              {todayAppts.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum agendamento hoje</p>
                </div>
              )}
            </div>
          </div>

          {/* Professionals status */}
          <div className="bg-white rounded-2xl border border-black/8 p-6">
            <h2 className="font-bold text-[#1B1C1E] mb-5">Profissionais</h2>
            <div className="space-y-4">
              {demoProfessionals.map(pro => {
                const proAppts = todayAppts.filter(a => a.professional_id === pro.id);
                const inChair = proAppts.find(a => a.status === 'em_atendimento');
                return (
                  <div key={pro.id} className="flex items-center gap-3">
                    <img src={pro.photo_url} alt={pro.name} className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-[#1B1C1E]">{pro.name}</div>
                      <div className="text-xs text-gray-400">{proAppts.length} agendamentos</div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${inChair ? 'bg-yellow-400' : 'bg-green-400'}`} />
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-black/8">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">AI Growth Alerts</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600">12 clientes inativos detectados</span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600">Segunda 13h–15h sem agenda</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DemoLayout>
  );
}