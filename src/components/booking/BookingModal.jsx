// Modal de agendamento deslizante — usado pela nova UI pública estilo appbarber.
// Contém todo o fluxo: Serviço → Profissional → Data/Hora → Confirmação → Pagamento.

import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { generateStableIdempotencyKey } from '@/lib/system/idempotency';
import { X, ChevronLeft, Check, Clock, User, AlertCircle, ChevronRight, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import { appointmentConflict, blockedConflict, annotateSlots } from '@/lib/scheduling';
import {
  DAY_INDEX_TO_KEY,
  formatTimeHHMM,
  generateSlotsForDay,
  normalizeBusinessHours,
  toBrasiliaDateParts,
  resolvePlanAllowedWeekdays,
  formatAllowedWeekdaysError,
  formatAllowedWeekdaysShort,
  isDateAllowedByPlan,
} from '@/lib/businessHours';
import BookingPaymentStep from './BookingPaymentStep';
import BookingConsentBlock from './BookingConsentBlock';
import PaymentMethodChooser from './PaymentMethodChooser';
import { usePublicTheme } from '@/hooks/usePublicTheme';

export default function BookingModal({
  isOpen, onClose,
  company, services, professionals, existingAppointments, blockedTimes,
  scopeCustomerByUnit, unitId,
  loggedCustomer, customerToken, isAuthenticatedCustomer,
  activeSubscription, activePlan, canUseSubscription, subscriptionBlocker,
  slug,
  onBookingDone,
  onNeedAuth,
  initialService = null,
  hasActivePlans = false,
}) {
  const primaryColor = company?.primary_color || '#2563EB';
  const { isDark, tw } = usePublicTheme();
  const [step, setStep] = useState(0); // 0=serviço, 1=prof, 2=data/hora, 3=confirmar, 4=pagar
  const [selected, setSelected] = useState({ service: initialService, professional: null, date: null, time: null });
  const [form, setForm] = useState({ notes: '' });
  const [formError, setFormError] = useState('');
  const [dayRestrictionNotice, setDayRestrictionNotice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(() => (canUseSubscription ? 'subscription' : 'avulso'));
  // Idempotency key estável — protege contra duplo-clique no "Confirmar agendamento" (fluxo grátis/assinatura).
  const idemKeyRef = useRef(null);

  const allowedWeekdays = resolvePlanAllowedWeekdays(activePlan, activeSubscription);
  const hasWeekdayRestrictions = Array.isArray(allowedWeekdays) && allowedWeekdays.length > 0 && allowedWeekdays.length < 7;
  const isUsingPlan = Boolean(activeSubscription && canUseSubscription && paymentMethod === 'subscription');

  // Ao abrir com serviço inicial, pula para profissional
  useEffect(() => {
    if (isOpen) {
      if (initialService) {
        setSelected({ service: initialService, professional: null, date: null, time: null });
        setStep(1);
      } else {
        setSelected({ service: null, professional: null, date: null, time: null });
        setStep(0);
      }
      setForm({ notes: '' });
      setFormError('');
      setDayRestrictionNotice('');
      setPaymentMethod(canUseSubscription ? 'subscription' : 'avulso');
      idemKeyRef.current = null; // nova sessão → key fresca
    }
  }, [isOpen, initialService]);

  useEffect(() => {
    if (canUseSubscription && paymentMethod === 'avulso' && step < 3) {
      setPaymentMethod('subscription');
    }
    if (!canUseSubscription && paymentMethod === 'subscription') {
      setPaymentMethod('avulso');
    }
  }, [canUseSubscription, step]);

  useEffect(() => {
    if (step !== 3) return;
    setFormError('');
    if (canUseSubscription && paymentMethod === 'avulso') {
      if (!hasWeekdayRestrictions || isDateAllowedByPlan(selected.date, allowedWeekdays)) {
        setPaymentMethod('subscription');
      }
    }
    if (!canUseSubscription && paymentMethod === 'subscription') setPaymentMethod('avulso');
  }, [step, canUseSubscription]);

  // Se o cliente estiver usando o plano e a data selecionada não for permitida pelo plano, limpa a seleção inválida
  useEffect(() => {
    if (isUsingPlan && hasWeekdayRestrictions && selected.date && !isDateAllowedByPlan(selected.date, allowedWeekdays)) {
      setSelected(p => ({ ...p, date: null, time: null }));
      setDayRestrictionNotice(`Dia não disponível para o seu plano. ${formatAllowedWeekdaysError(allowedWeekdays)}`);
    }
  }, [isUsingPlan, hasWeekdayRestrictions, selected.date]);

  const normalizedBusinessHours = normalizeBusinessHours(company);

  const next14Days = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i)).filter(day => {
    const { dayOfWeek } = toBrasiliaDateParts(day);
    const dk = DAY_INDEX_TO_KEY[dayOfWeek];
    const dayConfig = normalizedBusinessHours?.[dk];
    return dayConfig ? Boolean(dayConfig.active) : true;
  });

  const getAvailableSlots = () => {
    if (!selected.date || !selected.service || !company) return [];
    if (isUsingPlan && hasWeekdayRestrictions && !isDateAllowedByPlan(selected.date, allowedWeekdays)) {
      return [];
    }
    const { dateStr, dayOfWeek } = toBrasiliaDateParts(selected.date, '12:00');
    const dk = DAY_INDEX_TO_KEY[dayOfWeek];
    const hours = normalizedBusinessHours?.[dk];
    if (!hours || !hours.active) return [];

    const dur = Math.max(5, Number(selected.service.duration_minutes) || 30);
    const openTime = formatTimeHHMM(hours.open, '07:00');
    const closeTime = formatTimeHHMM(hours.close, '22:00');
    const slots = generateSlotsForDay(openTime, closeTime, dur);
    if (slots.length === 0) return [];

    const now = new Date();
    const todayStr = toBrasiliaDateParts(now).dateStr;
    const isToday = dateStr === todayStr;
    const proId = selected.professional?.id;
    const isAny = !proId || proId === 'any';
    const activePros = (professionals || []).filter(p => (p.is_active ?? p.active ?? true) !== false);
    const safeAppts = Array.isArray(existingAppointments) ? existingAppointments : [];
    const safeBlocks = Array.isArray(blockedTimes) ? blockedTimes : [];
    const apptsWithDuration = safeAppts.map(a => ({
      ...a,
      __duration: Number(services?.find(s => s.id === a.service_id)?.duration_minutes) || 30,
    }));

    let available = slots.filter(time => {
      const { isoBrasilia, timestamp } = toBrasiliaDateParts(selected.date, time);
      if (isToday && timestamp <= now.getTime()) return false;

      // 1. Tratamento de "Sem Preferência"
      if (isAny) {
        // Se ainda não houver nenhum profissional cadastrado, permite o agendamento sem travar
        if (activePros.length === 0) return true;
        // Se houver profissionais, verifica se pelo menos um profissional ativo está livre
        return activePros.some(p => {
          if (Array.isArray(p.service_ids) && p.service_ids.length > 0 && selected.service?.id) {
            if (!p.service_ids.includes(selected.service.id)) return false;
          }
          const apptBusy = appointmentConflict({ professionalId: p.id, dateTime: isoBrasilia, durationMin: dur, appointments: apptsWithDuration });
          const blockBusy = blockedConflict({ professionalId: p.id, dateTime: isoBrasilia, durationMin: dur, blocks: safeBlocks });
          return !apptBusy && !blockBusy;
        });
      }

      // Profissional específico
      if (appointmentConflict({ professionalId: proId, dateTime: isoBrasilia, durationMin: dur, appointments: apptsWithDuration })) return false;
      if (blockedConflict({ professionalId: proId, dateTime: isoBrasilia, durationMin: dur, blocks: safeBlocks })) return false;
      return true;
    });

    if (available.length === 0 && slots.length > 0 && activePros.length === 0) {
      available = slots;
    }

    return annotateSlots({
      slots: available,
      date: selected.date,
      durationMin: dur,
      professionalId: proId,
      appointments: apptsWithDuration,
      blocks: safeBlocks,
    });
  };

  const buildBookingPayload = () => {
    const { dateStr, timeFormatted, isoBrasilia } = toBrasiliaDateParts(selected.date, selected.time);
    const isAny = !selected.professional?.id || selected.professional?.id === 'any';
    const activePros = (professionals || []).filter(p => (p.is_active ?? p.active ?? true) !== false);
    const safeAppts = Array.isArray(existingAppointments) ? existingAppointments : [];
    const safeBlocks = Array.isArray(blockedTimes) ? blockedTimes : [];
    const apptsWithDuration = safeAppts.map(a => ({
      ...a,
      __duration: Number(services?.find(s => s.id === a.service_id)?.duration_minutes) || 30,
    }));
    const dur = Math.max(5, Number(selected.service?.duration_minutes) || 30);

    let proId = selected.professional?.id;
    let proName = selected.professional?.name;

    if (isAny) {
      // 1. Tratamento de "Sem Preferência" (Profissional):
      // Busque qualquer profissional ativo da barbearia que tenha o horário livre nesse intervalo.
      const availablePro = activePros.find(p => {
        if (Array.isArray(p.service_ids) && p.service_ids.length > 0 && selected.service?.id) {
          if (!p.service_ids.includes(selected.service.id)) return false;
        }
        const apptBusy = appointmentConflict({ professionalId: p.id, dateTime: isoBrasilia, durationMin: dur, appointments: apptsWithDuration });
        const blockBusy = blockedConflict({ professionalId: p.id, dateTime: isoBrasilia, durationMin: dur, blocks: safeBlocks });
        return !apptBusy && !blockBusy;
      }) || activePros.find(p => !p.service_ids?.length || p.service_ids.includes(selected.service?.id)) || activePros[0];

      if (availablePro) {
        proId = availablePro.id;
        proName = availablePro.name;
      } else {
        proId = null;
        proName = 'Sem Preferência';
      }
    }

    const startMs = new Date(isoBrasilia).getTime();
    const endTimeIso = !Number.isNaN(startMs)
      ? new Date(startMs + dur * 60 * 1000).toISOString()
      : isoBrasilia;

    return {
      companyId: company?.id,
      company_id: company?.id,
      unit_id: unitId || undefined,
      professionalId: isAny ? 'any' : proId,
      professional_id: proId,
      serviceId: selected.service.id,
      service_id: selected.service.id,
      service_name: selected.service.name,
      duration_minutes: dur,
      professional_name: isAny ? (proName || 'Sem Preferência') : selected.professional?.name,
      clientName: loggedCustomer?.name || 'Cliente',
      customer_name: loggedCustomer?.name || 'Cliente',
      clientPhone: loggedCustomer?.phone || '',
      customer_phone: loggedCustomer?.phone || '',
      customer_email: loggedCustomer?.email?.trim() || undefined,
      date: dateStr,
      time: timeFormatted,
      startTime: isoBrasilia,
      start_time: isoBrasilia,
      endTime: endTimeIso,
      end_time: endTimeIso,
      scheduled_at: isoBrasilia,
      notes: form.notes,
      price: Number(selected.service.price || 0),
      source: 'online',
      is_flexible_assignment: isAny,
      scope_customer_by_unit: scopeCustomerByUnit,
      ...(isAuthenticatedCustomer && loggedCustomer?.id ? { customer_id: loggedCustomer.id } : {}),
    };
  };

  const createApptMutation = useMutation({
    mutationFn: async (data) => {
      if (!idemKeyRef.current) {
        idemKeyRef.current = generateStableIdempotencyKey('public_appt', {
          company_id: data.company_id,
          professional_id: data.professional_id,
          service_id: data.service_id,
          scheduled_at: data.scheduled_at,
          customer_phone: data.customer_phone,
        });
      }
      const res = await base44.functions.invoke('createPublicAppointment', {
        ...data,
        scope_customer_by_unit: scopeCustomerByUnit,
        idempotency_key: idemKeyRef.current,
        ...(paymentMethod === 'subscription' && activeSubscription
          ? {
              subscription_id: activeSubscription.id,
              plan_id: activeSubscription.plan_id || activePlan?.id,
              plan_name: activeSubscription.plan_name || activeSubscription.plan_name_snapshot || activePlan?.name,
              allowed_weekdays: allowedWeekdays,
              payment_method: 'subscription',
              use_subscription: true,
            }
          : {}),
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Falha ao criar agendamento');
      if (activeSubscription && customerToken && res.data.appointment_id && paymentMethod === 'subscription') {
        const consumeRes = await base44.functions.invoke('consumeSubscriptionUse', {
          action: 'consume',
          subscription_id: activeSubscription.id,
          appointment_id: res.data.appointment_id,
          service_id: data.service_id,
          service_name: data.service_name,
          scheduled_at: data.scheduled_at,
          customer_token: customerToken,
          company_id: company.id,
        });
        if (consumeRes?.data?.error) throw new Error(`Agendado, mas falha ao usar plano: ${consumeRes.data.error}`);
      }
      return res.data;
    },
    onSuccess: (result) => onBookingDone({ ...result, selected, form }),
    onError: (err) => setFormError(err.message || 'Erro ao confirmar agendamento.'),
  });

  const validateBeforeSubmit = () => {
    if (!selected.date || !selected.time || !selected.service) {
      setFormError('Selecione data, horário e serviço para continuar.');
      return false;
    }

    const { dateStr, timeFormatted, isoBrasilia, dayOfWeek } = toBrasiliaDateParts(selected.date, selected.time);

    // Validação estrita dos dias permitidos pelo plano do cliente
    if (paymentMethod === 'subscription' && hasWeekdayRestrictions && !allowedWeekdays.includes(dayOfWeek)) {
      setFormError(formatAllowedWeekdaysError(allowedWeekdays));
      return false;
    }

    const dur = Math.max(5, Number(selected.service.duration_minutes) || 30);
    const safeAppts = Array.isArray(existingAppointments) ? existingAppointments : [];
    const safeBlocks = Array.isArray(blockedTimes) ? blockedTimes : [];
    const apptsWithDuration = safeAppts.map(a => ({
      ...a,
      __duration: Number(services?.find(s => s.id === a.service_id)?.duration_minutes) || 30,
    }));

    // 3. Parsing de Data e Fuso Horário:
    // Garante que o horário é validado estritamente no fuso de Brasília (UTC-3),
    // sem conversões em UTC que desloquem o horário para fora do expediente comercial.
    const dk = DAY_INDEX_TO_KEY[dayOfWeek];
    const hours = normalizedBusinessHours?.[dk];
    if (hours && hours.active) {
      const openTime = formatTimeHHMM(hours.open, '07:00');
      const closeTime = formatTimeHHMM(hours.close, '22:00');
      if (timeFormatted < openTime || timeFormatted > closeTime) {
        setFormError('Horário fora do expediente comercial.');
        return false;
      }
    }

    const isAny = !selected.professional?.id || selected.professional?.id === 'any';
    const activePros = (professionals || []).filter(p => (p.is_active ?? p.active ?? true) !== false);

    // 1. Tratamento de "Sem Preferência" (Profissional):
    // Se o cliente escolher "Sem Preferência" (professional_id = null ou 'any'):
    // * Busque qualquer profissional ativo da barbearia que tenha o horário livre nesse intervalo.
    // * Se ainda não houver nenhum profissional/barbeiro cadastrado na tabela de profissionais,
    //   permita o agendamento vinculando diretamente ao dono/empresa (company_id) sem travar a reserva.
    if (isAny) {
      if (activePros.length === 0) {
        setFormError('');
        return true;
      }

      const hasFreePro = activePros.some(p => {
        if (Array.isArray(p.service_ids) && p.service_ids.length > 0 && selected.service?.id) {
          if (!p.service_ids.includes(selected.service.id)) return false;
        }
        const apptBusy = appointmentConflict({
          professionalId: p.id,
          dateTime: isoBrasilia,
          durationMin: dur,
          appointments: apptsWithDuration,
        });
        const blockBusy = blockedConflict({
          professionalId: p.id,
          dateTime: isoBrasilia,
          durationMin: dur,
          blocks: safeBlocks,
        });
        return !apptBusy && !blockBusy;
      });

      if (!hasFreePro) {
        setFormError('Horário indisponível. Escolha outro.');
        return false;
      }

      setFormError('');
      return true;
    }

    // 2. Verificação de Conflitos na Tabela 'appointments':
    // Apenas marque o horário como indisponível se JÁ EXISTIR um agendamento confirmado no banco
    // para o mesmo profissional exatamente no mesmo intervalo de data/hora (start_time até end_time).
    // Se não houver agendamento colidindo, libere o avanço para a etapa seguinte sem disparar o erro "Horário indisponível".
    const apptBusy = appointmentConflict({
      professionalId: selected.professional.id,
      dateTime: isoBrasilia,
      durationMin: dur,
      appointments: apptsWithDuration,
    });
    const blockBusy = blockedConflict({
      professionalId: selected.professional.id,
      dateTime: isoBrasilia,
      durationMin: dur,
      blocks: safeBlocks,
    });

    if (apptBusy || blockBusy) {
      setFormError('Horário indisponível. Escolha outro.');
      return false;
    }

    setFormError('');
    return true;
  };

  const handleContinueToConfirmation = () => {
    if (isUsingPlan && hasWeekdayRestrictions && selected.date && !isDateAllowedByPlan(selected.date, allowedWeekdays)) {
      setDayRestrictionNotice(`Dia não disponível para o seu plano. ${formatAllowedWeekdaysError(allowedWeekdays)}`);
      return;
    }
    if (loggedCustomer && customerToken) {
      setStep(3);
    } else {
      onNeedAuth?.();
    }
  };

  const handleBook = () => {
    if (!validateBeforeSubmit()) return;
    if (paymentMethod === 'subscription' && canUseSubscription) {
      createApptMutation.mutate({ ...buildBookingPayload(), status: 'agendado' });
    } else {
      setStep(4);
    }
  };

  const availableSlots = getAvailableSlots();

  const datePlanBlocker =
    selected.date && hasWeekdayRestrictions && !isDateAllowedByPlan(selected.date, allowedWeekdays)
      ? `Dia não disponível para o seu plano. ${formatAllowedWeekdaysError(allowedWeekdays)}`
      : null;

  const effectiveSubscriptionBlocker = subscriptionBlocker || datePlanBlocker;

  const stepTitles = ['Escolha o serviço', 'Escolha o profissional', 'Escolha a data e hora', 'Confirmar agendamento', 'Pagamento'];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl max-h-[92vh] flex flex-col ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'}`}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-white/20' : 'bg-black/15'}`} />
            </div>

            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-3 flex-shrink-0 border-b ${tw.divider}`}>
              <div className="flex items-center gap-3">
                {step > 0 && step < 4 && (
                  <button onClick={() => setStep(s => s - 1)} className={`${tw.textMuted} hover:opacity-70`}>
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h3 className={`${tw.text} font-bold text-base`}>{stepTitles[step]}</h3>
                  {selected.service && step > 0 && (
                    <p className={`${tw.textMuted} text-xs`}>{selected.service.name} · R$ {selected.service.price}</p>
                  )}
                </div>
              </div>
              <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center ${tw.iconBg} ${tw.text} hover:opacity-70`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">

              {/* STEP 0: Serviço */}
              {step === 0 && (
                <div className="space-y-2">
                  {services.map(s => (
                    <button key={s.id}
                      onClick={() => { setSelected(p => ({ ...p, service: s })); setStep(1); }}
                      className={`w-full flex items-center gap-4 ${tw.card} rounded-2xl p-4 text-left transition-all`}
                    >
                      <div className={`w-12 h-12 rounded-xl ${tw.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <span className={`${tw.text} font-bold text-sm`}>{s.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`${tw.text} font-semibold truncate`}>{s.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-emerald-500 font-bold text-sm">R$ {s.price.toFixed(2)}</span>
                          <span className={`${tw.textFaint} text-xs flex items-center gap-1`}><Clock className="w-3 h-3" />{s.duration_minutes} min</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}>
                        <span style={{ color: '#FFFFFF' }}>Agendar</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* STEP 1: Profissional */}
              {step === 1 && (
                <div className="space-y-2">
                  <button
                    onClick={() => { setSelected(p => ({ ...p, professional: { id: 'any', name: 'Sem Preferência' } })); setStep(2); }}
                    className={`w-full flex items-center gap-4 ${tw.card} rounded-2xl p-4 text-left transition-all`}
                  >
                    <div className={`w-12 h-12 rounded-full ${tw.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <User className={`w-5 h-5 ${tw.textFaint}`} />
                    </div>
                    <div className="flex-1">
                      <div className={`${tw.text} font-semibold`}>Sem Preferência</div>
                      <div className={`${tw.textFaint} text-xs`}>Primeiro disponível</div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${tw.textFaint}`} />
                  </button>
                  {professionals.map(p => (
                    <button key={p.id}
                      onClick={() => { setSelected(s => ({ ...s, professional: p })); setStep(2); }}
                      className={`w-full flex items-center gap-4 ${tw.card} rounded-2xl p-4 text-left transition-all`}
                    >
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0" style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}>
                          <span style={{ color: '#FFFFFF' }}>{(p.name || '?')[0]}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className={`${tw.text} font-semibold`}>{p.name}</div>
                        {p.specialty && <div className={`${tw.textFaint} text-xs`}>{p.specialty}</div>}
                      </div>
                      <ChevronRight className={`w-4 h-4 ${tw.textFaint}`} />
                    </button>
                  ))}
                </div>
              )}

              {/* STEP 2: Data & Horário */}
              {step === 2 && (
                <div>
                  {/* Aviso de regra do plano ativo com restrição de dias */}
                  {canUseSubscription && hasWeekdayRestrictions && (
                    <div className={`mb-3 rounded-2xl border p-3 ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-gray-50 border-black/10'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`text-xs font-bold ${tw.text} truncate`}>
                            {activeSubscription?.plan_name || activeSubscription?.plan_name_snapshot || activePlan?.name || 'Meu Plano'}
                          </div>
                          <div className={`text-[11px] ${tw.textMuted}`}>
                            {formatAllowedWeekdaysError(allowedWeekdays)}
                          </div>
                        </div>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                        >
                          {formatAllowedWeekdaysShort(allowedWeekdays)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Date picker */}
                  <div className="flex gap-2 overflow-x-auto pb-3 mb-3 scrollbar-hide">
                    {next14Days.map((day, i) => {
                      const { dayOfWeek } = toBrasiliaDateParts(day);
                      const isDayBlockedByPlan = Boolean(
                        isUsingPlan && hasWeekdayRestrictions && !allowedWeekdays.includes(dayOfWeek)
                      );
                      const isSel = !isDayBlockedByPlan && selected.date?.toDateString() === day.toDateString();

                      return (
                        <button
                          key={i}
                          type="button"
                          aria-disabled={isDayBlockedByPlan}
                          title={isDayBlockedByPlan ? 'Dia não disponível para o seu plano' : undefined}
                          onClick={() => {
                            if (isDayBlockedByPlan) {
                              setDayRestrictionNotice(
                                `Dia não disponível para o seu plano. ${formatAllowedWeekdaysError(allowedWeekdays)}`
                              );
                              return;
                            }
                            setDayRestrictionNotice('');
                            setSelected(p => ({ ...p, date: day, time: null }));
                          }}
                          className={`flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-2xl border transition-all min-w-[60px] ${
                            isDayBlockedByPlan
                              ? 'opacity-40 grayscale cursor-not-allowed bg-gray-500/10 border-dashed border-gray-400/30 text-gray-400'
                              : isSel
                              ? 'border-transparent shadow-md'
                              : `${tw.card} ${tw.textMuted}`
                          }`}
                          style={
                            !isDayBlockedByPlan && isSel
                              ? { backgroundColor: primaryColor, color: '#FFFFFF' }
                              : undefined
                          }
                        >
                          <span
                            className="text-[10px] uppercase tracking-wide opacity-70"
                            style={!isDayBlockedByPlan && isSel ? { color: '#FFFFFF' } : undefined}
                          >
                            {format(day, 'EEE', { locale: ptBR })}
                          </span>
                          <span
                            className={`text-lg font-black ${isDayBlockedByPlan ? 'line-through' : ''}`}
                            style={!isDayBlockedByPlan && isSel ? { color: '#FFFFFF' } : undefined}
                          >
                            {format(day, 'd')}
                          </span>
                          <span
                            className="text-[10px] opacity-70"
                            style={!isDayBlockedByPlan && isSel ? { color: '#FFFFFF' } : undefined}
                          >
                            {format(day, 'MMM', { locale: ptBR })}
                          </span>
                          {isDayBlockedByPlan && (
                            <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-semibold text-gray-400">
                              <Lock className="w-2.5 h-2.5" /> Plano
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Aviso de dia desabilitado pelo plano */}
                  {isUsingPlan && hasWeekdayRestrictions && (
                    <div
                      className={`mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                        dayRestrictionNotice
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-semibold'
                          : `${tw.card} ${tw.textMuted}`
                      }`}
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                      <div>
                        <span className="font-bold">Dia não disponível para o seu plano</span>
                        <span>
                          {' '}— {formatAllowedWeekdaysError(allowedWeekdays)}
                        </span>
                      </div>
                    </div>
                  )}

                  {selected.date && (
                    <>
                      <p className={`${tw.textMuted} text-sm mb-3`}>{format(selected.date, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                      {availableSlots.length === 0 ? (
                        <div className={`text-center py-8 ${tw.textFaint}`}>
                          <p className="text-sm">Nenhum horário disponível neste dia</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-4 gap-2 mb-4">
                            {availableSlots.map(({ time: t, smart }) => {
                              const isSel = selected.time === t;
                              return (
                                <button key={t}
                                  onClick={() => setSelected(p => ({ ...p, time: t }))}
                                  className={`relative py-2.5 rounded-xl text-sm font-semibold transition-all border ${isSel ? 'border-transparent' : `${tw.card} ${tw.textMuted}`} ${smart && !isSel ? 'ring-1 ring-amber-400/50' : ''}`}
                                  style={{ backgroundColor: isSel ? primaryColor : undefined, color: isSel ? '#FFFFFF' : undefined }}
                                >
                                  {isSel ? <span style={{ color: '#FFFFFF' }}>{t}</span> : t}
                                  {smart && !isSel && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
                                </button>
                              );
                            })}
                          </div>
                          {selected.time && (
                            <button onClick={handleContinueToConfirmation}
                              className="w-full font-bold py-4 rounded-2xl text-sm transition-opacity hover:opacity-90"
                              style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
                            >
                              <span style={{ color: '#FFFFFF' }}>Continuar</span>
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {!selected.date && (
                    <div className={`text-center py-6 ${tw.textFaint} text-sm`}>
                      Selecione uma data disponível acima
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Confirmação */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Resumo */}
                  <div className={`${tw.card} rounded-2xl p-4 space-y-2.5`}>
                    <Row label="Cliente" value={loggedCustomer?.name || '—'} tw={tw} />
                    <Row label="WhatsApp" value={loggedCustomer?.phone || '—'} tw={tw} />
                    <Row label="Serviço" value={selected.service?.name} tw={tw} />
                    <Row label="Profissional" value={selected.professional?.name} tw={tw} />
                    <Row label="Data e hora" value={`${selected.date ? format(selected.date, "d 'de' MMM", { locale: ptBR }) : ''} às ${selected.time}`} tw={tw} />
                    <div className={`flex justify-between items-center pt-2 border-t ${tw.divider}`}>
                      <span className={`${tw.textMuted} text-sm`}>Valor</span>
                      <span className="text-emerald-500 font-black text-lg">R$ {selected.service?.price?.toFixed(2)}</span>
                    </div>
                  </div>

                  {isAuthenticatedCustomer && (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-[12px] text-emerald-300">Agendamento vinculado ao seu perfil.</p>
                    </div>
                  )}

                  {activeSubscription && (
                    <PaymentMethodChooser
                      subscription={activeSubscription}
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      primaryColor={primaryColor}
                      blocker={effectiveSubscriptionBlocker}
                    />
                  )}

                  {loggedCustomer && !activeSubscription && hasActivePlans && (
                    <Link to={`/cliente/${slug}/planos`}
                      className="block px-4 py-3 rounded-xl border border-dashed border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                    >
                      <div className="text-xs font-semibold text-amber-300">💡 Cortes garantidos todo mês</div>
                      <div className="text-[11px] text-amber-400/70 mt-0.5">Conheça os planos da {company.name}</div>
                    </Link>
                  )}

                  <div>
                    <label className={`text-xs font-semibold ${tw.textMuted} block mb-1`}>Observações (opcional)</label>
                    <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                      placeholder="Preferências ou informações adicionais"
                      className={`w-full px-4 py-3 border ${tw.divider} rounded-xl text-sm ${tw.card} ${tw.text} resize-none`} />
                  </div>

                  <BookingConsentBlock companyId={company.id} customerId={loggedCustomer?.id} customerToken={customerToken} />

                  {formError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
                    </div>
                  )}

                  <button onClick={handleBook}
                    disabled={createApptMutation.isPending}
                    className="w-full font-bold py-4 rounded-2xl text-sm transition-all hover:opacity-90 disabled:opacity-50 shadow-lg"
                    style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
                  >
                    <span style={{ color: '#FFFFFF' }}>
                      {createApptMutation.isPending ? 'Confirmando...' :
                        (paymentMethod === 'subscription' && canUseSubscription) ? 'Confirmar agendamento' : 'Continuar para pagamento →'}
                    </span>
                  </button>
                </div>
              )}

              {/* STEP 4: Pagamento */}
              {step === 4 && (
                <BookingPaymentStep
                  payload={buildBookingPayload()}
                  primaryColor={primaryColor}
                  pixEnabled={company?.asaas_pix_enabled !== false}
                  onBack={() => setStep(3)}
                  onSucceeded={(intent) => onBookingDone({ appointment_id: intent.appointment_id, paid_online: true, selected, form })}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, tw }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`${tw?.textMuted || 'text-white/50'} text-sm`}>{label}</span>
      <span className={`${tw?.text || 'text-white'} font-semibold text-sm truncate ml-2 max-w-[60%] text-right`}>{value}</span>
    </div>
  );
}