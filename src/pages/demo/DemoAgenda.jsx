// DemoAgenda — espelho visual EXATO de pages/app/AppAgenda.
// Mesma grid colunar (AgendaProColumns), mesmas pílulas de dia.

import DemoLayout from '@/components/layout/DemoLayout.jsx';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Calendar } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import AgendaProColumns from '@/components/agenda/AgendaProColumns';
import {
  demoAppointments,
  demoProfessionals,
  demoServices,
} from '@/lib/demoData';

const statusConfig = {
  agendado: { label: 'Agendado', badge: 'bg-blue-100 text-blue-700' },
  confirmado: { label: 'Confirmado', badge: 'bg-green-100 text-green-700' },
  em_atendimento: { label: 'Na Cadeira', badge: 'bg-yellow-100 text-yellow-700' },
  concluido: { label: 'Concluído', badge: 'bg-gray-100 text-gray-600' },
  cancelado: { label: 'Cancelado', badge: 'bg-red-100 text-red-600' },
  faltou: { label: 'Faltou', badge: 'bg-orange-100 text-orange-600' },
};

export default function DemoAgenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterPro, setFilterPro] = useState('all');
  const [slotInterval, setSlotInterval] = useState(10);
  const [selectedAppt, setSelectedAppt] = useState(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const filteredAppts = filterPro === 'all'
    ? demoAppointments
    : demoAppointments.filter(a => a.professional_id === filterPro);
  const visiblePros = filterPro === 'all'
    ? demoProfessionals
    : demoProfessionals.filter(p => p.id === filterPro);

  return (
    <DemoLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Agendamentos</h1>
            <p className="text-gray-500 text-sm mt-1 capitalize">
              {format(currentDate, "EEEE, dd MMM yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {demoProfessionals.length > 0 && (
              <select
                value={filterPro}
                onChange={e => setFilterPro(e.target.value)}
                className="px-3 py-2 border border-black/10 rounded-xl text-sm focus:outline-none bg-white shadow-[var(--shadow-xs)]"
              >
                <option value="all">Todos os profissionais</option>
                {demoProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <div className="hidden sm:flex items-center bg-white border border-black/10 rounded-xl p-1 shadow-[var(--shadow-xs)]">
              {[10, 15].map(v => (
                <button
                  key={v}
                  onClick={() => setSlotInterval(v)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${slotInterval === v ? 'bg-[#2563EB] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  title={`Intervalo ${v} minutos`}
                >
                  {v}min
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-white border border-black/10 rounded-xl p-1 shadow-[var(--shadow-xs)]">
              <button onClick={() => setCurrentDate(d => addDays(d, -1))} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCurrentDate(new Date())} className="text-sm font-semibold px-3 py-1 rounded-lg hover:bg-gray-100">Hoje</button>
              <button onClick={() => setCurrentDate(d => addDays(d, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => alert('Modo demo: ative sua conta para criar agendamentos reais.')}
              className="bg-[#2563EB] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1d4ed8] transition-all flex items-center gap-2 shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)]"
            >
              <Plus className="w-4 h-4" />Novo
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setCurrentDate(d => addDays(d, -7))}
            className="p-2 rounded-lg hover:bg-white border border-black/5 bg-white/60 flex-shrink-0"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          {weekDays.map(day => {
            const active = isSameDay(day, currentDate);
            const isTodayDay = isSameDay(day, new Date());
            const dayCount = filteredAppts.filter(a => isSameDay(new Date(a.scheduled_at), day)).length;
            return (
              <button
                key={day.toISOString()}
                onClick={() => setCurrentDate(day)}
                className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl border transition-all min-w-[64px] ${
                  active
                    ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-[0_4px_12px_rgba(37,99,235,0.3)]'
                    : 'bg-white border-black/5 text-gray-600 hover:border-[#2563EB]/30'
                }`}
              >
                <span className={`text-[10px] uppercase tracking-wide font-semibold ${active ? 'text-white/80' : 'text-gray-400'}`}>
                  {format(day, 'EEE', { locale: ptBR })}
                </span>
                <span className={`text-lg font-bold ${active ? 'text-white' : isTodayDay ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>
                  {format(day, 'd')}
                </span>
                {dayCount > 0 && (
                  <span className={`text-[10px] font-semibold mt-0.5 ${active ? 'text-white/80' : 'text-[#2563EB]'}`}>
                    {dayCount} ag.
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setCurrentDate(d => addDays(d, 7))}
            className="p-2 rounded-lg hover:bg-white border border-black/5 bg-white/60 flex-shrink-0"
            aria-label="Próxima semana"
          >
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {visiblePros.length > 0 ? (
          <AgendaProColumns
            selectedDate={currentDate}
            professionals={visiblePros}
            appointments={demoAppointments}
            services={demoServices}
            blocks={[]}
            onCardClick={setSelectedAppt}
            slotInterval={slotInterval}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center text-gray-500">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum profissional cadastrado.</p>
          </div>
        )}

        <div className="flex items-center gap-3 mt-4 flex-wrap text-xs">
          {[
            { label: 'Agendado', cls: 'bg-[#F1F2F4] border-[#D1D5DB]' },
            { label: 'Confirmado', cls: 'bg-[#DCF7E3] border-[#86E3A5]' },
            { label: 'Na cadeira', cls: 'bg-[#FFF1C2] border-[#F5C842]' },
            { label: 'Concluído', cls: 'bg-[#E5E7EB] border-[#9CA3AF]' },
            { label: 'Cancelado', cls: 'bg-[#FCE2E2] border-[#F08989]' },
            { label: 'Faltou', cls: 'bg-[#FFE4D1] border-[#F5A571]' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded border ${s.cls}`} />
              <span className="text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>

        {selectedAppt && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAppt(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-[#1B1C1E]">Agendamento</h3>
                <button onClick={() => setSelectedAppt(null)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 mb-5">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-xs text-gray-400 block">Cliente</span><p className="font-semibold text-sm">{selectedAppt.customer_name}</p></div>
                  <div><span className="text-xs text-gray-400 block">Serviço</span><p className="font-semibold text-sm">{selectedAppt.service_name}</p></div>
                  <div><span className="text-xs text-gray-400 block">Profissional</span><p className="font-semibold text-sm">{selectedAppt.professional_name}</p></div>
                  <div><span className="text-xs text-gray-400 block">Horário</span><p className="font-semibold text-sm">{format(new Date(selectedAppt.scheduled_at), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p></div>
                  <div><span className="text-xs text-gray-400 block">Valor</span><p className="font-semibold text-sm">R$ {selectedAppt.price || '–'}</p></div>
                  <div>
                    <span className="text-xs text-gray-400 block">Status</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-lg inline-block mt-0.5 ${statusConfig[selectedAppt.status]?.badge}`}>
                      {statusConfig[selectedAppt.status]?.label}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-center text-gray-500 bg-[#FAFBFC] border border-black/5 rounded-lg p-3">
                Modo demonstração — ações de edição estão desativadas.
              </div>
            </div>
          </div>
        )}
      </div>
    </DemoLayout>
  );
}