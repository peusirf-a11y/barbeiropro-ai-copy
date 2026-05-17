/**
 * DemoAgenda — Usa AgendaProColumns e AgendaMobileList idênticos ao AppAgenda.
 * Ações de edição mostram toast "modo demo" em vez de persistir.
 */
import DemoLayout from '@/components/layout/DemoLayout.jsx';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import AgendaProColumns from '@/components/agenda/AgendaProColumns';
import AgendaMobileList from '@/components/agenda/AgendaMobileList';
import EditAppointmentModal from '@/components/agenda/EditAppointmentModal';
import FilterSelect from '@/components/ui/filter-select';
import { useIsMobile } from '@/hooks/use-mobile';
import { STATUS_TOKENS } from '@/lib/statusTokens';

import {
  demoAppointments,
  demoProfessionals,
  demoServices,
  demoCustomers,
} from '@/lib/demoData';

export default function DemoAgenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterPro, setFilterPro] = useState('all');
  const [slotInterval, setSlotInterval] = useState(10);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const isMobile = useIsMobile();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const filteredAppts = filterPro === 'all'
    ? demoAppointments
    : demoAppointments.filter(a => a.professional_id === filterPro);
  const visiblePros = filterPro === 'all'
    ? demoProfessionals
    : demoProfessionals.filter(p => p.id === filterPro);

  const handleDemoAction = (label = 'Esta ação') =>
    toast.info(`${label} está disponível na conta real. Crie sua conta grátis!`, { duration: 3000 });

  const STATUS_KEYS = ['agendado', 'confirmado', 'concluido', 'cancelado', 'faltou'];

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
              <FilterSelect value={filterPro} onChange={setFilterPro} aria-label="Filtrar por profissional">
                <option value="all">Todos os profissionais</option>
                {demoProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </FilterSelect>
            )}
            <div className="hidden sm:flex items-center bg-white border border-black/10 rounded-xl p-1 shadow-[var(--shadow-xs)]">
              {[10, 15].map(v => (
                <button
                  key={v}
                  onClick={() => setSlotInterval(v)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${slotInterval === v ? 'bg-[#2563EB] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
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
              onClick={() => handleDemoAction('Criar agendamento')}
              className="bg-[#2563EB] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1d4ed8] transition-all flex items-center gap-2 shadow-[0_4px_12px_rgba(37,99,235,0.25)]"
            >
              <Plus className="w-4 h-4" />Novo
            </button>
          </div>
        </div>

        {/* Seletor de dias */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <button onClick={() => setCurrentDate(d => addDays(d, -7))} className="p-2 rounded-lg hover:bg-white border border-black/5 bg-white/60 flex-shrink-0" aria-label="Semana anterior">
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
          <button onClick={() => setCurrentDate(d => addDays(d, 7))} className="p-2 rounded-lg hover:bg-white border border-black/5 bg-white/60 flex-shrink-0" aria-label="Próxima semana">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {visiblePros.length > 0 ? (
          isMobile ? (
            <AgendaMobileList
              selectedDate={currentDate}
              professionals={visiblePros}
              appointments={filteredAppts}
              services={demoServices}
              customers={demoCustomers}
              onCardClick={setSelectedAppt}
            />
          ) : (
            <AgendaProColumns
              selectedDate={currentDate}
              professionals={visiblePros}
              appointments={demoAppointments}
              services={demoServices}
              blocks={[]}
              onCardClick={setSelectedAppt}
              onMoveAppointment={() => handleDemoAction('Mover agendamento')}
              onResizeAppointment={() => handleDemoAction('Redimensionar agendamento')}
              slotInterval={slotInterval}
            />
          )
        ) : (
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center text-gray-500">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum profissional cadastrado.</p>
          </div>
        )}

        {/* Legenda */}
        <div className="flex items-center gap-3 mt-4 flex-wrap text-xs">
          {STATUS_KEYS.map(key => {
            const tk = STATUS_TOKENS[key];
            return (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded border ${tk.cardBg} ${tk.cardBorder}`} />
                <span className="text-gray-500">{tk.label}</span>
              </div>
            );
          })}
        </div>

        {/* Modal de visualização (somente leitura) */}
        {selectedAppt && (
          <EditAppointmentModal
            appointment={selectedAppt}
            professionals={demoProfessionals}
            services={demoServices}
            customers={demoCustomers}
            isBarbeiro={false}
            hasConflict={() => false}
            hitsBlock={() => false}
            onSave={() => { handleDemoAction('Salvar agendamento'); setSelectedAppt(null); }}
            onDelete={() => { handleDemoAction('Excluir agendamento'); setSelectedAppt(null); }}
            onClose={() => setSelectedAppt(null)}
            isSaving={false}
            companyId="demo-company"
          />
        )}
      </div>
    </DemoLayout>
  );
}