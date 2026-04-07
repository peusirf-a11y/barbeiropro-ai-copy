import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig = {
  agendado: { label: 'Agendado', color: 'border-l-blue-400 bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  confirmado: { label: 'Confirmado', color: 'border-l-green-400 bg-green-50', badge: 'bg-green-100 text-green-700' },
  em_atendimento: { label: 'Na Cadeira', color: 'border-l-yellow-400 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700' },
  concluido: { label: 'Concluído', color: 'border-l-gray-300 bg-gray-50', badge: 'bg-gray-100 text-gray-600' },
  cancelado: { label: 'Cancelado', color: 'border-l-red-300 bg-red-50', badge: 'bg-red-100 text-red-600' },
  faltou: { label: 'Faltou', color: 'border-l-orange-300 bg-orange-50', badge: 'bg-orange-100 text-orange-600' },
};

const hours = Array.from({ length: 13 }, (_, i) => i + 8);

export default function AppAgenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState(null);
  const queryClient = useQueryClient();

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => base44.entities.Appointment.list('-scheduled_at', 200),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Appointment.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#1B1C1E]">Agenda</h1>
            <p className="text-gray-500 text-sm mt-1">Visualização semanal</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white border border-black/10 rounded-lg p-1">
              <button onClick={() => setCurrentDate(d => addDays(d, -7))} className="p-1.5 hover:bg-gray-100 rounded">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium px-2">
                {format(weekStart, "d MMM", { locale: ptBR })} — {format(addDays(weekStart, 5), "d MMM", { locale: ptBR })}
              </span>
              <button onClick={() => setCurrentDate(d => addDays(d, 7))} className="p-1.5 hover:bg-gray-100 rounded">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
          <div className="grid border-b border-black/8" style={{ gridTemplateColumns: '64px repeat(6, 1fr)' }}>
            <div className="p-3 border-r border-black/8" />
            {weekDays.map((day, i) => {
              const isToday = day.toDateString() === new Date().toDateString();
              return (
                <div key={i} className={`p-3 text-center border-r border-black/8 last:border-r-0 ${isToday ? 'bg-[#1B3A4B]/5' : ''}`}>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">{format(day, 'EEE', { locale: ptBR })}</div>
                  <div className={`text-lg font-bold mt-0.5 ${isToday ? 'text-[#1B3A4B]' : 'text-[#1B1C1E]'}`}>{format(day, 'd')}</div>
                </div>
              );
            })}
          </div>

          <div className="overflow-y-auto max-h-[580px]">
            {hours.map(hour => (
              <div key={hour} className="grid border-b border-black/5" style={{ gridTemplateColumns: '64px repeat(6, 1fr)' }}>
                <div className="p-2 text-xs text-gray-400 text-right border-r border-black/8 py-3">{hour}:00</div>
                {weekDays.map((day, di) => {
                  const dayAppts = appointments.filter(a => {
                    const d = new Date(a.scheduled_at);
                    return d.toDateString() === day.toDateString() && d.getHours() === hour;
                  });
                  return (
                    <div key={di} className="border-r border-black/5 last:border-r-0 min-h-[52px] p-1">
                      {dayAppts.map(appt => (
                        <div
                          key={appt.id}
                          onClick={() => setSelectedAppt(appt)}
                          className={`rounded border-l-4 p-1.5 mb-1 ${statusConfig[appt.status]?.color || 'border-l-gray-300 bg-gray-50'} cursor-pointer hover:opacity-80`}
                        >
                          <div className="text-xs font-semibold text-gray-800 truncate">{appt.customer_name || 'Cliente'}</div>
                          <div className="text-xs text-gray-500 truncate">{appt.service_name}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Appointment Detail Modal */}
        {selectedAppt && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAppt(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-[#1B1C1E]">Detalhes do Agendamento</h3>
                <button onClick={() => setSelectedAppt(null)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 mb-5">
                <div><span className="text-xs text-gray-400">Cliente</span><p className="font-semibold text-sm">{selectedAppt.customer_name}</p></div>
                <div><span className="text-xs text-gray-400">Serviço</span><p className="font-semibold text-sm">{selectedAppt.service_name}</p></div>
                <div><span className="text-xs text-gray-400">Profissional</span><p className="font-semibold text-sm">{selectedAppt.professional_name}</p></div>
                <div><span className="text-xs text-gray-400">Horário</span><p className="font-semibold text-sm">{format(new Date(selectedAppt.scheduled_at), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p></div>
                <div><span className="text-xs text-gray-400">Valor</span><p className="font-semibold text-sm">R${selectedAppt.price}</p></div>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-2">Atualizar status</span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(statusConfig).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => { updateMutation.mutate({ id: selectedAppt.id, data: { status: key } }); setSelectedAppt(null); }}
                      className={`text-xs font-medium px-3 py-2 rounded-lg ${selectedAppt.status === key ? val.badge + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}