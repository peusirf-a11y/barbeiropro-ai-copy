import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useTeamRole } from '@/lib/useTeamRole';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Calendar } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateToken, confirmTokenExpiry, reviewTokenExpiry } from '@/lib/tokens';
import { appointmentConflict, blockedConflict } from '@/lib/scheduling';
import CustomerTypeBadge from '@/components/agenda/CustomerTypeBadge';
import AgendaProColumns from '@/components/agenda/AgendaProColumns';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import AllUnitsNotice from '@/components/units/AllUnitsNotice';
import { STATUS_TOKENS } from '@/lib/statusTokens';

// Status habilitados no modal de mudança — ordenados.
const STATUS_KEYS = ['agendado', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'faltou'];

const hours = Array.from({ length: 13 }, (_, i) => i + 8);

const emptyForm = {
  customer_name: '', customer_phone: '', customer_id: '',
  professional_id: '', service_id: '', scheduled_at: '', notes: '', status: 'agendado', price: 0,
};

export default function AppAgenda() {
  const { company, companyId, isLoading: loadingCompany } = useCompany();
  const { activeUnitId, isMultiUnit, isAllUnits } = useActiveUnit();
  const { data: teamRole } = useTeamRole();
  const isBarbeiro = teamRole?.role === 'barbeiro';
  const myProId = teamRole?.professional_id || null;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterPro, setFilterPro] = useState(isBarbeiro && myProId ? myProId : 'all');
  const [slotInterval, setSlotInterval] = useState(10); // 10 ou 15 min
  const queryClient = useQueryClient();

  // Barbeiro só enxerga seus próprios atendimentos.
  const apptFilter = isBarbeiro && myProId
    ? { company_id: companyId, professional_id: myProId }
    : { company_id: companyId };

  const { data: appointments = [], isLoading: loadingAppts } = useQuery({
    queryKey: ['appointments', companyId, isBarbeiro ? myProId : 'all'],
    queryFn: () => base44.entities.Appointment.filter(apptFilter, '-scheduled_at', 500),
    enabled: !!companyId && (!isBarbeiro || !!myProId),
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals', companyId],
    queryFn: () => base44.entities.Professional.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services', companyId],
    queryFn: () => base44.entities.Service.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: () => base44.entities.Customer.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: blockedTimes = [] } = useQuery({
    queryKey: ['blocks', companyId],
    queryFn: () => base44.entities.BlockedTime.filter({ company_id: companyId }, '-start_time', 200),
    enabled: !!companyId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Marca completed_at junto com status=concluido. As automações de entidade
      // criam comissão (registerCommission) + entrada financeira + link de avaliação
      // (onAppointmentConcluded) de forma idempotente.
      const payload = data.status === 'concluido' && !data.completed_at
        ? { ...data, completed_at: new Date().toISOString() }
        : data;
      return base44.entities.Appointment.update(id, payload);
    },
    onSuccess: (_res, vars) => {
      // Invalida tudo que pode ter mudado por automação encadeada.
      // Pequeno delay para dar tempo das automações rodarem antes do refetch.
      const isConcluded = vars?.data?.status === 'concluido';
      queryClient.invalidateQueries({ queryKey: ['appointments', companyId] });
      if (isConcluded) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['appointments', companyId] });
          queryClient.invalidateQueries({ queryKey: ['commissions', companyId] });
          queryClient.invalidateQueries({ queryKey: ['financial', companyId] });
          queryClient.invalidateQueries({ queryKey: ['financial-entries', companyId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] });
          queryClient.invalidateQueries({ queryKey: ['cash-register', companyId] });
        }, 1500);
      }
      setSelectedAppt(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Appointment.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments', companyId] }); setShowNewForm(false); setForm(emptyForm); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Appointment.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appointments', companyId] }); setSelectedAppt(null); },
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Multi-unidade: filtra agendamentos e profissionais pela unidade ativa.
  // Mono-unidade ou com unit_id ausente => mostra tudo (compatibilidade com dados legados).
  const apptsByUnit = isMultiUnit && activeUnitId
    ? appointments.filter(a => !a.unit_id || a.unit_id === activeUnitId)
    : appointments;
  const prosByUnit = isMultiUnit && activeUnitId
    ? professionals.filter(p => !p.unit_ids || p.unit_ids.length === 0 || p.unit_ids.includes(activeUnitId))
    : professionals;

  const filteredAppts = filterPro === 'all' ? apptsByUnit : apptsByUnit.filter(a => a.professional_id === filterPro);
  const visiblePros = filterPro === 'all' ? prosByUnit : prosByUnit.filter(p => p.id === filterPro);

  // Conflict + block check via lib reutilizável
  const apptsWithDuration = appointments.map(a => ({
    ...a,
    __duration: services.find(s => s.id === a.service_id)?.duration_minutes || 30,
  }));
  const hasConflict = (proId, dateTime, serviceId, excludeId = null) => {
    const dur = services.find(s => s.id === serviceId)?.duration_minutes || 30;
    return appointmentConflict({ professionalId: proId, dateTime, durationMin: dur, appointments: apptsWithDuration, excludeId });
  };
  const hitsBlock = (proId, dateTime, serviceId) => {
    const dur = services.find(s => s.id === serviceId)?.duration_minutes || 30;
    return blockedConflict({ professionalId: proId, dateTime, durationMin: dur, blocks: blockedTimes });
  };

  const handleCreate = () => {
    if (!form.professional_id || !form.service_id || !form.scheduled_at || !form.customer_name) return;
    if (hasConflict(form.professional_id, form.scheduled_at, form.service_id)) {
      alert('Conflito de horário! Este profissional já tem um agendamento neste horário.');
      return;
    }
    if (hitsBlock(form.professional_id, form.scheduled_at, form.service_id)) {
      alert('Horário bloqueado (almoço/folga/evento). Escolha outro horário.');
      return;
    }
    const pro = professionals.find(p => p.id === form.professional_id);
    const svc = services.find(s => s.id === form.service_id);
    const customer = customers.find(c => c.id === form.customer_id);
    createMutation.mutate({
      ...form,
      company_id: companyId,
      unit_id: activeUnitId || pro?.unit_ids?.[0] || undefined,
      professional_name: pro?.name || '',
      service_name: svc?.name || '',
      customer_name: customer?.name || form.customer_name,
      customer_phone: customer?.phone || form.customer_phone,
      price: svc?.price || form.price,
      source: 'interno',
      confirm_token: generateToken(),
      review_token: generateToken(),
      confirm_token_expires_at: confirmTokenExpiry(form.scheduled_at),
      review_token_expires_at: reviewTokenExpiry(form.scheduled_at),
    });
  };

  const handleServiceChange = (sid) => {
    const svc = services.find(s => s.id === sid);
    setForm(p => ({ ...p, service_id: sid, price: svc?.price || 0 }));
  };

  // Drag-and-drop entre barbeiros: muda professional_id mantendo horário.
  const handleMoveAppointment = ({ appointment, toProfessionalId }) => {
    if (!toProfessionalId || appointment.professional_id === toProfessionalId) return;
    if (hasConflict(toProfessionalId, appointment.scheduled_at, appointment.service_id, appointment.id)) {
      alert('Conflito: o profissional de destino já tem agendamento neste horário.');
      return;
    }
    if (hitsBlock(toProfessionalId, appointment.scheduled_at, appointment.service_id)) {
      alert('Horário bloqueado para o profissional de destino.');
      return;
    }
    const pro = professionals.find(p => p.id === toProfessionalId);
    updateMutation.mutate({
      id: appointment.id,
      data: {
        professional_id: toProfessionalId,
        professional_name: pro?.name || '',
      },
    });
  };

  if (loadingCompany) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Agendamentos</h1>
            <p className="text-gray-500 text-sm mt-1 capitalize">{format(currentDate, "EEEE, dd MMM yyyy", { locale: ptBR })}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {!isBarbeiro && professionals.length > 0 && (
              <select value={filterPro} onChange={e => setFilterPro(e.target.value)}
                className="px-3 py-2 border border-black/10 rounded-xl text-sm focus:outline-none bg-white shadow-[var(--shadow-xs)]">
                <option value="all">Todos os profissionais</option>
                {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
            {!isBarbeiro && !isAllUnits && (
              <button onClick={() => setShowNewForm(true)} className="bg-[#2563EB] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1d4ed8] transition-all flex items-center gap-2 shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)]">
                <Plus className="w-4 h-4" />Novo
              </button>
            )}
          </div>
        </div>

        {isAllUnits && (
          <AllUnitsNotice message="Você está vendo a agenda consolidada de todas as unidades. Para criar um novo agendamento, selecione uma unidade específica." />
        )}

        {/* Seletor de dias da semana — pílulas */}
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
            appointments={apptsByUnit}
            services={services}
            blocks={blockedTimes}
            onCardClick={setSelectedAppt}
            onMoveAppointment={!isBarbeiro ? handleMoveAppointment : undefined}
            slotInterval={slotInterval}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center text-gray-500">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum profissional cadastrado.</p>
          </div>
        )}

        {/* Legenda — cores padronizadas em todo o sistema */}
        <div className="flex items-center gap-3 mt-4 flex-wrap text-xs">
          {STATUS_KEYS.map(key => {
            const t = STATUS_TOKENS[key];
            return (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded border ${t.cardBg} ${t.cardBorder}`} />
                <span className="text-gray-500">{t.label}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border border-dashed border-gray-400 bg-white" />
            <span className="text-gray-500">Cliente sem preferência</span>
          </div>
        </div>

        {/* Appointment Detail Modal */}
        {selectedAppt && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAppt(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-[#1B1C1E]">Agendamento</h3>
                <button onClick={() => setSelectedAppt(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-2 mb-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-gray-400 block">Cliente</span>
                    <p className="font-semibold text-sm">{selectedAppt.customer_name}</p>
                    <div className="mt-1"><CustomerTypeBadge customer={customers.find(c => c.id === selectedAppt.customer_id)} /></div>
                  </div>
                  <div><span className="text-xs text-gray-400 block">Telefone</span><p className="font-semibold text-sm">{selectedAppt.customer_phone || '–'}</p></div>
                  <div><span className="text-xs text-gray-400 block">Serviço</span><p className="font-semibold text-sm">{selectedAppt.service_name}</p></div>
                  <div><span className="text-xs text-gray-400 block">Profissional</span><p className="font-semibold text-sm">{selectedAppt.professional_name}</p></div>
                  <div><span className="text-xs text-gray-400 block">Horário</span><p className="font-semibold text-sm">{format(new Date(selectedAppt.scheduled_at), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p></div>
                  <div><span className="text-xs text-gray-400 block">Valor</span><p className="font-semibold text-sm">R${selectedAppt.price || '–'}</p></div>
                </div>
                {selectedAppt.notes && <div><span className="text-xs text-gray-400 block">Obs.</span><p className="text-sm text-gray-600">{selectedAppt.notes}</p></div>}
              </div>
              <div className="mb-4">
                <span className="text-xs text-gray-400 block mb-2">Alterar status</span>
                <div className="grid grid-cols-3 gap-2">
                  {STATUS_KEYS.map(key => {
                    const t = STATUS_TOKENS[key];
                    const active = selectedAppt.status === key;
                    return (
                      <button key={key}
                        onClick={() => updateMutation.mutate({ id: selectedAppt.id, data: { status: key } })}
                        className={`text-xs font-medium px-2 py-2 rounded-lg border ${active ? `${t.pill} ring-2 ring-offset-1 ring-current` : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {!isBarbeiro && (
                <button onClick={() => { if (confirm('Excluir este agendamento?')) deleteMutation.mutate(selectedAppt.id); }}
                  className="w-full text-xs text-red-500 hover:text-red-700 font-medium py-2">
                  Excluir agendamento
                </button>
              )}
            </div>
          </div>
        )}

        {/* New Appointment Form */}
        {showNewForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowNewForm(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-[#1B1C1E]">Novo Agendamento</h3>
                <button onClick={() => setShowNewForm(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                {/* Customer */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Cliente</label>
                  <select value={form.customer_id} onChange={e => {
                    const c = customers.find(x => x.id === e.target.value);
                    setForm(p => ({ ...p, customer_id: e.target.value, customer_name: c?.name || '', customer_phone: c?.phone || '' }));
                  }} className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20">
                    <option value="">Selecionar cliente cadastrado</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Nome do cliente *</label>
                    <input type="text" value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                      placeholder="Ou digite o nome"
                      className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Telefone</label>
                    <input type="text" value={form.customer_phone} onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Serviço *</label>
                  <select value={form.service_id} onChange={e => handleServiceChange(e.target.value)}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20">
                    <option value="">Selecionar serviço</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes}min · R${s.price}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Profissional *</label>
                  <select value={form.professional_id} onChange={e => setForm(p => ({ ...p, professional_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20">
                    <option value="">Selecionar profissional</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Data e hora *</label>
                  <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Observações</label>
                  <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowNewForm(false)} className="flex-1 px-4 py-2.5 border border-black/10 rounded-lg text-sm font-medium">Cancelar</button>
                <button onClick={handleCreate} disabled={!form.customer_name || !form.service_id || !form.professional_id || !form.scheduled_at || createMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#2563EB]/90 disabled:opacity-50">
                  {createMutation.isPending ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}