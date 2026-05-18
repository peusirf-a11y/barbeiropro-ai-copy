import AppLayout from '@/components/layout/AppLayout';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useTeamRole } from '@/lib/useTeamRole';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Calendar } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { appointmentConflict, blockedConflict } from '@/lib/scheduling';
import AgendaProColumns from '@/components/agenda/AgendaProColumns';
import AgendaMobileList from '@/components/agenda/AgendaMobileList';
import EditAppointmentModal from '@/components/agenda/EditAppointmentModal';
import UseSubscriptionDialog from '@/components/agenda/UseSubscriptionDialog';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import AllUnitsNotice from '@/components/units/AllUnitsNotice';
import { STATUS_TOKENS } from '@/lib/statusTokens';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import StandardModal from '@/components/ui/standard-modal';
import FilterSelect from '@/components/ui/filter-select';
import { safeArray } from '@/lib/safeArray';
import { useImpersonationPatch } from '@/hooks/useImpersonationToken';
import { buildTenantQueryKey } from '@/lib/query/buildTenantQueryKey';

// Status habilitados no modal de mudança — ordenados.
const STATUS_KEYS = ['agendado', 'confirmado', 'concluido', 'cancelado', 'faltou'];

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
  const isMobile = useIsMobile();
  const impPatch = useImpersonationPatch();
  const { containerProps: ptrProps, indicator: ptrIndicator } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'appointments', companyId }) }),
        queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'blocked-times', companyId }) }),
        queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'professionals', companyId }) }),
        queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'customers', companyId }) }),
      ]);
    },
  });

  // BFF Fase 3: leitura passa pelo backend. Tenant + role (barbeiro) +
  // unit scope são aplicados server-side. O front só passa active_unit_id.
  const { data: appointmentsRaw, isLoading: loadingAppts } = useQuery({
    queryKey: buildTenantQueryKey({ entity: 'appointments', companyId, filters: { activeUnitId, isBarbeiro: isBarbeiro ? myProId : 'all' } }),
    queryFn: async () => {
      const res = await base44.functions.invoke('listAppointments', {
        active_unit_id: activeUnitId || undefined,
        limit: 500,
        ...impPatch,
      });
      return res?.data?.appointments ?? res?.data ?? [];
    },
    enabled: !!companyId && (!isBarbeiro || !!myProId),
  });
  const appointments = safeArray(appointmentsRaw);

  const { data: professionalsRaw } = useQuery({
    queryKey: buildTenantQueryKey({ entity: 'professionals', companyId, filters: { activeUnitId } }),
    queryFn: () => base44.entities.Professional.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });
  const professionals = safeArray(professionalsRaw);

  const { data: servicesRaw } = useQuery({
    queryKey: buildTenantQueryKey({ entity: 'services', companyId }),
    queryFn: () => base44.entities.Service.filter({ company_id: companyId, active: true }),
    enabled: !!companyId,
  });
  const services = safeArray(servicesRaw);

  const { data: customersRaw } = useQuery({
    queryKey: buildTenantQueryKey({ entity: 'customers', companyId, filters: { activeUnitId } }),
    queryFn: () => base44.entities.Customer.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const customers = safeArray(customersRaw);

  const { data: blockedTimesRaw } = useQuery({
    queryKey: buildTenantQueryKey({ entity: 'blocked-times', companyId, filters: { activeUnitId } }),
    queryFn: () => base44.entities.BlockedTime.filter({ company_id: companyId }, '-start_time', 200),
    enabled: !!companyId,
  });
  const blockedTimes = safeArray(blockedTimesRaw);

  // Assinaturas ativas — para mostrar opção "usar plano" ao agendar e badge de assinante
  const { data: activeSubsRaw } = useQuery({
    queryKey: buildTenantQueryKey({ entity: 'subscriptions', companyId, filters: { status: 'active', activeUnitId } }),
    queryFn: () => base44.entities.CustomerSubscription.filter({ company_id: companyId, status: 'active' }),
    enabled: !!companyId,
  });
  const activeSubs = safeArray(activeSubsRaw);
  const { data: customerPlansRaw } = useQuery({
    queryKey: buildTenantQueryKey({ entity: 'customer-plans', companyId }),
    queryFn: () => base44.entities.CustomerPlan.filter({ company_id: companyId }),
    enabled: !!companyId,
  });
  const customerPlans = safeArray(customerPlansRaw);
  const subByCustomer = activeSubs.reduce((acc, s) => { acc[s.customer_id] = s; return acc; }, {});

  // Dialog "usar plano vs avulso" — disparado após criar agendamento de assinante
  const [pendingSubscriptionDialog, setPendingSubscriptionDialog] = useState(null);
  // pendingSubscriptionDialog = { appointment, subscription, plan, servicePrice }

  // BFF Fase 3 helper — todas as mutations passam por mutateAppointment.
  // O servidor faz allow-list, conflict check, completed_at auto-stamp e
  // bloqueia tentativa de mexer em campos sensíveis (paid_online, etc).
  const invokeMutation = async (payload) => {
    const res = await base44.functions.invoke('mutateAppointment', { ...payload, ...impPatch });
    if (res?.data?.error) {
      const err = new Error(res.data.error);
      err.code = res.data.error;
      throw err;
    }
    return res?.data;
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => invokeMutation({ action: 'update', id, data }),
    // Update otimista — UI reflete a mudança imediatamente, sem esperar o servidor.
    onMutate: async ({ id, data }) => {
      const key = buildTenantQueryKey({ entity: 'appointments', companyId });
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueriesData({ queryKey: key });
      queryClient.setQueriesData({ queryKey: key }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map(a => a.id === id ? { ...a, ...data } : a);
      });
      return { previous };
    },
    onError: (err, _vars, context) => {
      // Reverte em caso de falha
      if (context?.previous) {
        context.previous.forEach(([key, value]) => queryClient.setQueryData(key, value));
      }
      // Mensagens humanas para os erros mais comuns do BFF
      const msg = {
        SLOT_CONFLICT: 'Conflito de horário: este profissional já tem outro agendamento neste horário.',
        SLOT_BLOCKED: 'Horário bloqueado (almoço/folga/evento). Escolha outro horário.',
        FORBIDDEN_ROLE: 'Seu perfil não tem permissão para essa ação.',
        NOT_FOUND: 'Agendamento não encontrado.',
      }[err?.code] || 'Não foi possível salvar a alteração. Tente novamente.';
      alert(msg);
    },
    onSuccess: (_res, vars) => {
      // Reconcilia com o servidor + invalida cadeias derivadas (comissões/financeiro) quando concluído.
      const isConcluded = vars?.data?.status === 'concluido';
      const isCanceledOrMissed = ['cancelado', 'faltou'].includes(vars?.data?.status);
      queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'appointments', companyId }) });

      // Se o agendamento estava cobrindo via plano e foi cancelado/faltou, devolve o uso
      if (isCanceledOrMissed && selectedAppt?.payment_method === 'subscription' && selectedAppt?.subscription_id) {
        subscriptionActionMutation.mutate({
          action: 'revert',
          subscription_id: selectedAppt.subscription_id,
          appointment_id: selectedAppt.id,
        });
      }

      if (isConcluded) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'appointments', companyId }) });
          queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'commissions', companyId }) });
          queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'financial', companyId }) });
          queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'financial-entries', companyId }) });
          queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'dashboard', companyId }) });
          queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'cash-register', companyId }) });
        }, 1500);
      }
      setSelectedAppt(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => invokeMutation({
      action: 'create',
      data,
      active_unit_id: activeUnitId || undefined,
    }),
    onSuccess: (res) => {
      // BFF retorna { appointment } — sem unwrapping vinha como undefined.
      const created = res?.appointment;
      queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'appointments', companyId }) });
      queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'customers', companyId }) });
      setShowNewForm(false);
      setForm(emptyForm);

      // Se o cliente do agendamento tem assinatura ativa, abre dialog "plano vs avulso"
      const sub = created?.customer_id ? subByCustomer[created.customer_id] : null;
      if (sub) {
        const plan = customerPlans.find(p => p.id === sub.plan_id);
        const svc = services.find(s => s.id === created.service_id);
        setPendingSubscriptionDialog({
          appointment: created,
          subscription: sub,
          plan,
          servicePrice: svc?.price || created.price || 0,
        });
      }
    },
    onError: (err) => {
      const msg = {
        SLOT_CONFLICT: 'Conflito de horário: este profissional já tem outro agendamento neste horário.',
        SLOT_BLOCKED: 'Horário bloqueado (almoço/folga/evento).',
        INVALID_SERVICE: 'Serviço inválido.',
        INVALID_PROFESSIONAL: 'Profissional inválido.',
        MISSING_FIELDS: 'Preencha profissional, serviço e horário.',
        FORBIDDEN_ROLE: 'Seu perfil não tem permissão para criar agendamentos.',
      }[err?.code] || 'Não foi possível criar o agendamento. Tente novamente.';
      alert(msg);
    },
  });

  // Consome ou devolve uso de assinatura via backend (atômico)
  const subscriptionActionMutation = useMutation({
    mutationFn: ({ action, subscription_id, appointment_id, service_id, service_name }) =>
      base44.functions.invoke('consumeSubscriptionUse', { action, subscription_id, appointment_id, service_id, service_name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'appointments', companyId }) });
      queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'subscriptions', companyId }) });
      queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'subscription' }) });
      setPendingSubscriptionDialog(null);
    },
    onError: (err) => {
      alert(err?.message || 'Erro ao processar uso da assinatura.');
    },
  });

  // Normaliza telefone para apenas dígitos (padrão usado no Customer)
  const normalizePhone = (raw) => String(raw || '').replace(/\D/g, '');

  // Lookup por telefone — preenche nome automaticamente quando cliente já existe.
  // Disparado on-blur do campo telefone, mas só quando ainda não há cliente selecionado.
  const handlePhoneLookup = (rawPhone) => {
    const norm = normalizePhone(rawPhone);
    if (!norm || norm.length < 10) return;
    if (form.customer_id) return; // já tem cliente vinculado, não sobrescreve
    const found = customers.find(c => normalizePhone(c.phone) === norm);
    if (found) {
      setForm(p => ({
        ...p,
        customer_id: found.id,
        customer_name: found.name,
        customer_phone: found.phone,
      }));
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => invokeMutation({ action: 'delete', id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'appointments', companyId }) }); setSelectedAppt(null); },
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
  // custom_duration_minutes (resize manual) sobrescreve a duração padrão do serviço
  const apptsWithDuration = appointments.map(a => ({
    ...a,
    __duration: a.custom_duration_minutes || services.find(s => s.id === a.service_id)?.duration_minutes || 30,
  }));
  const hasConflict = (proId, dateTime, serviceId, excludeId = null) => {
    const dur = services.find(s => s.id === serviceId)?.duration_minutes || 30;
    return appointmentConflict({ professionalId: proId, dateTime, durationMin: dur, appointments: apptsWithDuration, excludeId });
  };
  const hitsBlock = (proId, dateTime, serviceId) => {
    const dur = services.find(s => s.id === serviceId)?.duration_minutes || 30;
    return blockedConflict({ professionalId: proId, dateTime, durationMin: dur, blocks: blockedTimes });
  };

  const handleCreate = async () => {
    if (!form.professional_id || !form.service_id || !form.scheduled_at || !form.customer_name) return;
    if (hasConflict(form.professional_id, form.scheduled_at, form.service_id)) {
      alert('Conflito de horário! Este profissional já tem um agendamento neste horário.');
      return;
    }
    if (hitsBlock(form.professional_id, form.scheduled_at, form.service_id)) {
      alert('Horário bloqueado (almoço/folga/evento). Escolha outro horário.');
      return;
    }

    // Identificação/criação automática de cliente:
    // 1) Se já houver customer_id selecionado, usa.
    // 2) Senão, tenta achar por telefone normalizado.
    // 3) Se não achar e houver telefone válido, cria novo Customer automaticamente.
    let customer = customers.find(c => c.id === form.customer_id) || null;
    const phoneNorm = normalizePhone(form.customer_phone);

    if (!customer && phoneNorm.length >= 10) {
      customer = customers.find(c => normalizePhone(c.phone) === phoneNorm) || null;
    }
    if (!customer && phoneNorm.length >= 10 && form.customer_name?.trim()) {
      try {
        // Cliente criado via BFF (Fase 2) — servidor decide company_id/unit_id
        const res = await base44.functions.invoke('mutateCustomer', {
          action: 'create',
          data: { name: form.customer_name.trim(), phone: phoneNorm, status: 'active' },
          active_unit_id: activeUnitId || undefined,
        });
        if (res?.data?.customer) {
          customer = res.data.customer;
          queryClient.invalidateQueries({ queryKey: buildTenantQueryKey({ entity: 'customers', companyId }) });
        }
      } catch (err) {
        console.warn('[AppAgenda] falha ao criar cliente automaticamente:', err.message);
      }
    }

    // BFF Fase 3: o servidor preenche service_name/professional_name/price/tokens.
    // O front só manda dados de UI; tudo derivado vem do banco.
    createMutation.mutate({
      customer_id: customer?.id || form.customer_id || undefined,
      customer_name: customer?.name || form.customer_name,
      customer_phone: customer?.phone || phoneNorm || form.customer_phone,
      professional_id: form.professional_id,
      service_id: form.service_id,
      scheduled_at: form.scheduled_at,
      status: form.status || 'agendado',
      notes: form.notes,
    });
  };

  const handleServiceChange = (sid) => {
    const svc = services.find(s => s.id === sid);
    setForm(p => ({ ...p, service_id: sid, price: svc?.price || 0 }));
  };

  // Drag-and-drop completo: troca profissional E/OU horário mantendo a duração.
  // Recebe `newStartISO` do hook (já snapado na grade) e `toProfessionalId`.
  const handleMoveAppointment = ({ appointment, toProfessionalId, newStartISO }) => {
    const targetProId = toProfessionalId || appointment.professional_id;
    const targetStart = newStartISO || appointment.scheduled_at;
    // Sem mudança real → no-op
    const sameStart = new Date(targetStart).getTime() === new Date(appointment.scheduled_at).getTime();
    if (sameStart && targetProId === appointment.professional_id) return;

    if (hasConflict(targetProId, targetStart, appointment.service_id, appointment.id)) {
      alert('Conflito: este horário já está ocupado.');
      return;
    }
    if (hitsBlock(targetProId, targetStart, appointment.service_id)) {
      alert('Horário bloqueado (almoço/folga/evento).');
      return;
    }

    // Resolve o nome do profissional destino (relevante quando is_flexible_assignment=true)
    const targetPro = professionals.find(p => p.id === targetProId);
    const updateData = {
      professional_id: targetProId,
      scheduled_at: new Date(targetStart).toISOString(),
    };
    // Se trocou de barbeiro E temos o nome local, envia professional_name para o servidor
    // (o BFF também sobrescreve com o banco, mas melhora update otimista)
    if (targetProId !== appointment.professional_id && targetPro?.name) {
      updateData.professional_name = targetPro.name;
      // Quando movido para barbeiro específico, remove o flag de flexível
      updateData.is_flexible_assignment = false;
    }

    updateMutation.mutate({ id: appointment.id, data: updateData });
  };

  // Resize via borda inferior do card — altera somente a duração (custom_duration_minutes
  // sobrescreve a duração padrão do serviço). Valida conflito contra a NOVA duração.
  const handleResizeAppointment = ({ appointment, newDurationMin }) => {
    const start = new Date(appointment.scheduled_at);
    const end = new Date(start.getTime() + newDurationMin * 60_000);
    const conflict = appointments.some(a => {
      if (a.id === appointment.id) return false;
      if (a.professional_id !== appointment.professional_id) return false;
      if (['cancelado', 'faltou'].includes(a.status)) return false;
      const aStart = new Date(a.scheduled_at);
      const aDur = a.custom_duration_minutes || services.find(s => s.id === a.service_id)?.duration_minutes || 30;
      const aEnd = new Date(aStart.getTime() + aDur * 60_000);
      return start < aEnd && end > aStart;
    });
    if (conflict) {
      alert('Não é possível redimensionar: conflita com outro agendamento.');
      return;
    }
    updateMutation.mutate({
      id: appointment.id,
      data: { custom_duration_minutes: newDurationMin },
    });
  };

  if (loadingCompany) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[#60A5FA]/20 border-t-[#60A5FA] rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div {...ptrProps}>
        {ptrIndicator}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">Agendamentos</h1>
            <p className="text-white/50 text-sm mt-1 capitalize">{format(currentDate, "EEEE, dd MMM yyyy", { locale: ptBR })}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {!isBarbeiro && professionals.length > 0 && (
              <FilterSelect value={filterPro} onChange={setFilterPro} aria-label="Filtrar por profissional">
                <option value="all">Todos os profissionais</option>
                {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </FilterSelect>
            )}
            <div className="hidden sm:flex items-center bg-white/[0.03] border border-white/10 rounded-xl p-1 backdrop-blur-sm">
              {[10, 15].map(v => (
                <button
                  key={v}
                  onClick={() => setSlotInterval(v)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${slotInterval === v ? 'bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white shadow-[0_4px_12px_rgba(37,99,235,0.4)]' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                  title={`Intervalo ${v} minutos`}
                >
                  {v}min
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1 backdrop-blur-sm">
              <button onClick={() => setCurrentDate(d => addDays(d, -1))} aria-label="Dia anterior" className="p-1.5 hover:bg-white/5 rounded-lg text-white/70">
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <button onClick={() => setCurrentDate(new Date())} className="text-sm font-semibold px-3 py-1 rounded-lg hover:bg-white/5 text-white/80">Hoje</button>
              <button onClick={() => setCurrentDate(d => addDays(d, 1))} aria-label="Próximo dia" className="p-1.5 hover:bg-white/5 rounded-lg text-white/70">
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            {!isBarbeiro && !isAllUnits && (
              <button onClick={() => setShowNewForm(true)} className="bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_8px_24px_rgba(37,99,235,0.4)] hover:shadow-[0_12px_32px_rgba(37,99,235,0.55)] ring-1 ring-white/15">
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
            className="p-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] flex-shrink-0 backdrop-blur-sm"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="w-4 h-4 text-white/60" />
          </button>
          {weekDays.map(day => {
            const active = isSameDay(day, currentDate);
            const isTodayDay = isSameDay(day, new Date());
            const dayCount = filteredAppts.filter(a => isSameDay(new Date(a.scheduled_at), day)).length;
            return (
              <button
                key={day.toISOString()}
                onClick={() => setCurrentDate(day)}
                className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl border transition-all min-w-[64px] backdrop-blur-sm ${
                  active
                    ? 'bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white border-white/15 shadow-[0_8px_24px_rgba(37,99,235,0.45)]'
                    : 'bg-white/[0.03] border-white/8 text-white/70 hover:bg-white/[0.06] hover:border-[#60A5FA]/30'
                }`}
              >
                <span className={`text-[10px] uppercase tracking-wide font-semibold ${active ? 'text-white/85' : 'text-white/40'}`}>
                  {format(day, 'EEE', { locale: ptBR })}
                </span>
                <span className={`text-lg font-bold ${active ? 'text-white' : isTodayDay ? 'text-[#93C5FD]' : 'text-white'}`}>
                  {format(day, 'd')}
                </span>
                {dayCount > 0 && (
                  <span className={`text-[10px] font-semibold mt-0.5 ${active ? 'text-white/85' : 'text-[#93C5FD]'}`}>
                    {dayCount} ag.
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setCurrentDate(d => addDays(d, 7))}
            className="p-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] flex-shrink-0 backdrop-blur-sm"
            aria-label="Próxima semana"
          >
            <ChevronRight className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {visiblePros.length > 0 ? (
          isMobile ? (
            <AgendaMobileList
              selectedDate={currentDate}
              professionals={visiblePros}
              appointments={filteredAppts}
              services={services}
              customers={customers}
              onCardClick={setSelectedAppt}
            />
          ) : (
            <AgendaProColumns
              selectedDate={currentDate}
              professionals={visiblePros}
              appointments={apptsByUnit}
              services={services}
              blocks={blockedTimes}
              onCardClick={setSelectedAppt}
              onMoveAppointment={!isBarbeiro ? handleMoveAppointment : undefined}
              onResizeAppointment={!isBarbeiro ? handleResizeAppointment : undefined}
              slotInterval={slotInterval}
            />
          )
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-12 text-center text-white/50">
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
                <span className="text-white/55">{t.label}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border border-dashed border-white/40 bg-white/[0.03]" />
            <span className="text-white/55">Cliente sem preferência</span>
          </div>
        </div>

        {/* Dialog "Usar plano vs avulso" — aparece após criar agendamento de assinante */}
        {pendingSubscriptionDialog && (
          <UseSubscriptionDialog
            appointment={pendingSubscriptionDialog.appointment}
            subscription={pendingSubscriptionDialog.subscription}
            plan={pendingSubscriptionDialog.plan}
            servicePrice={pendingSubscriptionDialog.servicePrice}
            isPending={subscriptionActionMutation.isPending}
            onUsePlan={() => subscriptionActionMutation.mutate({
              action: 'consume',
              subscription_id: pendingSubscriptionDialog.subscription.id,
              appointment_id: pendingSubscriptionDialog.appointment.id,
              service_id: pendingSubscriptionDialog.appointment.service_id,
              service_name: pendingSubscriptionDialog.appointment.service_name,
            })}
            onUseAvulso={() => setPendingSubscriptionDialog(null)}
            onClose={() => setPendingSubscriptionDialog(null)}
          />
        )}

        {/* Edit Appointment Modal — horário, profissional, serviço, status, observações */}
        {selectedAppt && (
          <EditAppointmentModal
            appointment={selectedAppt}
            professionals={professionals}
            services={services}
            customers={customers}
            isBarbeiro={isBarbeiro}
            hasConflict={hasConflict}
            hitsBlock={hitsBlock}
            onSave={(payload) => updateMutation.mutate(payload)}
            onDelete={!isBarbeiro ? (id) => deleteMutation.mutate(id) : undefined}
            onClose={() => setSelectedAppt(null)}
            isSaving={updateMutation.isPending}
            companyId={companyId}
          />
        )}

        {/* New Appointment Form */}
        <StandardModal
          open={showNewForm}
          onClose={() => setShowNewForm(false)}
          title="Novo Agendamento"
          size="xl"
          footer={
            <>
              <button onClick={() => setShowNewForm(false)} className="flex-1 min-h-[48px] px-4 border border-white/10 rounded-xl text-sm font-medium text-white/80 bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.customer_name || !form.service_id || !form.professional_id || !form.scheduled_at || createMutation.isPending}
                className="flex-1 min-h-[48px] px-4 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all shadow-[0_8px_24px_rgba(37,99,235,0.4)] ring-1 ring-white/15">
                {createMutation.isPending ? 'Salvando...' : 'Confirmar'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            {/* Customer */}
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Cliente</label>
              <FilterSelect
                value={form.customer_id}
                onChange={(v) => {
                  const c = customers.find(x => x.id === v);
                  setForm(p => ({ ...p, customer_id: v, customer_name: c?.name || '', customer_phone: c?.phone || '' }));
                }}
                className="w-full"
              >
                <option value="">Selecionar cliente cadastrado</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
              </FilterSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-white/60 block mb-1">Nome do cliente *</label>
                <input type="text" value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                  placeholder="Ou digite o nome"
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60 block mb-1">Telefone</label>
                <input type="text" value={form.customer_phone}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(p => ({
                      ...p,
                      customer_phone: val,
                      customer_id: p.customer_id && normalizePhone(p.customer_phone) !== normalizePhone(val) ? '' : p.customer_id,
                    }));
                    if (normalizePhone(val).length >= 10) handlePhoneLookup(val);
                  }}
                  onBlur={e => handlePhoneLookup(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
                {form.customer_id && (
                  <span className="text-[11px] text-emerald-300 font-medium mt-1 block">✓ Cliente identificado</span>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Serviço *</label>
              <FilterSelect value={form.service_id} onChange={handleServiceChange} className="w-full">
                <option value="">Selecionar serviço</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes}min · R${s.price}</option>)}
              </FilterSelect>
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Profissional *</label>
              <FilterSelect value={form.professional_id} onChange={(v) => setForm(p => ({ ...p, professional_id: v }))} className="w-full">
                <option value="">Selecionar profissional</option>
                {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </FilterSelect>
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Data e hora *</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white [color-scheme:dark] focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/60 block mb-1">Observações</label>
              <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/20" />
            </div>
          </div>
        </StandardModal>
      </div>
      </div>
    </AppLayout>
  );
}