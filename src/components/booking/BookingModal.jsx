// Modal de agendamento deslizante — usado pela nova UI pública estilo appbarber.
// Contém todo o fluxo: Serviço → Profissional → Data/Hora → Confirmação → Pagamento.

import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { generateStableIdempotencyKey } from '@/lib/system/idempotency';
import { X, ChevronLeft, Check, Clock, User, AlertCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import { appointmentConflict, blockedConflict, annotateSlots, rankSlotsByFit } from '@/lib/scheduling';
import BookingPaymentStep from './BookingPaymentStep';
import BookingConsentBlock from './BookingConsentBlock';
import PaymentMethodChooser from './PaymentMethodChooser';
import { usePublicTheme } from '@/hooks/usePublicTheme';

const DAY_MAP = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };

function generateTimeSlots(openTime, closeTime, durationMin) {
  const slots = [];
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);
  let current = oh * 60 + om;
  const end = ch * 60 + cm;
  while (current + durationMin <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, '0');
    const m = (current % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
    current += 30;
  }
  return slots;
}

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
}) {
  const primaryColor = company?.primary_color || '#2563EB';
  const { isDark, tw } = usePublicTheme();
  const [step, setStep] = useState(0); // 0=serviço, 1=prof, 2=data/hora, 3=confirmar, 4=pagar
  const [selected, setSelected] = useState({ service: initialService, professional: null, date: null, time: null });
  const [form, setForm] = useState({ notes: '' });
  const [formError, setFormError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('avulso');
  // Idempotency key estável — protege contra duplo-clique no "Confirmar agendamento" (fluxo grátis/assinatura).
  const idemKeyRef = useRef(null);

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
      idemKeyRef.current = null; // nova sessão → key fresca
    }
  }, [isOpen, initialService]);

  useEffect(() => {
    if (step !== 3) return;
    // Limpa erro residual de uma validação anterior (ex.: usuário voltou do AuthGate)
    // — senão "Horário indisponível" fica grudado na tela mesmo sem o usuário ter clicado.
    setFormError('');
    if (canUseSubscription && paymentMethod === 'avulso') setPaymentMethod('subscription');
    if (!canUseSubscription && paymentMethod === 'subscription') setPaymentMethod('avulso');
  }, [step, canUseSubscription]); // eslint-disable-line react-hooks/exhaustive-deps

  const next14Days = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i)).filter(day => {
    if (!company?.business_hours) return true;
    const dk = DAY_MAP[day.getDay()];
    return company.business_hours[dk]?.active !== false;
  });

  const getAvailableSlots = () => {
    if (!selected.date || !selected.service || !company) return [];
    const dk = DAY_MAP[selected.date.getDay()];
    const hours = company.business_hours?.[dk];
    if (!hours?.active) return [];
    const slots = generateTimeSlots(hours.open || '09:00', hours.close || '19:00', selected.service.duration_minutes || 30);
    const now = new Date();
    const isToday = selected.date.toDateString() === now.toDateString();
    const proId = selected.professional?.id;
    const dur = selected.service.duration_minutes || 30;
    const apptsWithDuration = existingAppointments.map(a => ({
      ...a,
      __duration: services.find(s => s.id === a.service_id)?.duration_minutes || 30,
    }));
    const available = slots.filter(time => {
      const [h, m] = time.split(':');
      const slotStart = new Date(selected.date);
      slotStart.setHours(+h, +m, 0, 0);
      if (isToday && slotStart <= now) return false;
      if (!proId || proId === 'any') return true;
      if (appointmentConflict({ professionalId: proId, dateTime: slotStart, durationMin: dur, appointments: apptsWithDuration })) return false;
      if (blockedConflict({ professionalId: proId, dateTime: slotStart, durationMin: dur, blocks: blockedTimes })) return false;
      return true;
    });
    const ranked = rankSlotsByFit({ slots: available, date: selected.date, durationMin: dur, professionalId: proId, appointments: apptsWithDuration, blocks: blockedTimes });
    return annotateSlots({ slots: ranked, date: selected.date, durationMin: dur, professionalId: proId, appointments: apptsWithDuration, blocks: blockedTimes });
  };

  const buildBookingPayload = () => {
    const [h, m] = selected.time.split(':');
    const dt = new Date(selected.date);
    dt.setHours(+h, +m, 0, 0);
    const isAny = selected.professional?.id === 'any';
    const proId = isAny ? professionals[0]?.id : selected.professional?.id;
    return {
      company_id: company.id,
      unit_id: unitId || undefined,
      professional_id: proId,
      service_id: selected.service.id,
      service_name: selected.service.name,
      professional_name: isAny ? 'Qualquer disponível' : selected.professional?.name,
      customer_name: loggedCustomer?.name || '',
      customer_phone: loggedCustomer?.phone || '',
      customer_email: loggedCustomer?.email?.trim() || undefined,
      scheduled_at: dt.toISOString(),
      notes: form.notes,
      price: selected.service.price,
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
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Falha ao criar agendamento');
      if (activeSubscription && customerToken && res.data.appointment_id) {
        const consumeRes = await base44.functions.invoke('consumeSubscriptionUse', {
          action: 'consume',
          subscription_id: activeSubscription.id,
          appointment_id: res.data.appointment_id,
          service_id: data.service_id,
          service_name: data.service_name,
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
    const [h, m] = selected.time.split(':');
    const dt = new Date(selected.date);
    dt.setHours(+h, +m, 0, 0);
    const proId = selected.professional?.id === 'any' ? professionals[0]?.id : selected.professional?.id;
    const apptsWithDuration = existingAppointments.map(a => ({
      ...a,
      __duration: services.find(s => s.id === a.service_id)?.duration_minutes || 30,
    }));
    const dur = selected.service.duration_minutes || 30;
    if (appointmentConflict({ professionalId: proId, dateTime: dt, durationMin: dur, appointments: apptsWithDuration })) {
      setFormError('Horário indisponível. Escolha outro.');
      return false;
    }
    if (blockedConflict({ professionalId: proId, dateTime: dt, durationMin: dur, blocks: blockedTimes })) {
      setFormError('Horário indisponível neste momento.');
      return false;
    }
    setFormError('');
    return true;
  };

  const handleContinueToConfirmation = () => {
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
                      <span className="text-xs font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                        Agendar
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
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                          {(p.name || '?')[0]}
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
                  {/* Date picker */}
                  <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
                    {next14Days.slice(0, 10).map((day, i) => {
                      const isSel = selected.date?.toDateString() === day.toDateString();
                      return (
                        <button key={i}
                          onClick={() => setSelected(p => ({ ...p, date: day, time: null }))}
                          className={`flex-shrink-0 flex flex-col items-center px-3 py-3 rounded-2xl border transition-all min-w-[56px] ${isSel ? 'border-transparent text-white' : `${tw.card} ${tw.textMuted}`}`}
                          style={{ backgroundColor: isSel ? primaryColor : undefined }}
                        >
                          <span className="text-[10px] uppercase tracking-wide opacity-70">{format(day, 'EEE', { locale: ptBR })}</span>
                          <span className="text-lg font-black">{format(day, 'd')}</span>
                          <span className="text-[10px] opacity-70">{format(day, 'MMM', { locale: ptBR })}</span>
                        </button>
                      );
                    })}
                  </div>

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
                                  className={`relative py-2.5 rounded-xl text-sm font-semibold transition-all border ${isSel ? 'text-white border-transparent' : `${tw.card} ${tw.textMuted}`} ${smart && !isSel ? 'ring-1 ring-amber-400/50' : ''}`}
                                  style={{ backgroundColor: isSel ? primaryColor : undefined }}
                                >
                                  {t}
                                  {smart && !isSel && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
                                </button>
                              );
                            })}
                          </div>
                          {selected.time && (
                            <button onClick={handleContinueToConfirmation}
                              className="w-full text-white font-bold py-4 rounded-2xl text-sm transition-opacity hover:opacity-90"
                              style={{ backgroundColor: primaryColor }}
                            >
                              Continuar
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {!selected.date && (
                    <div className={`text-center py-6 ${tw.textFaint} text-sm`}>
                      Selecione uma data acima
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
                      blocker={subscriptionBlocker}
                    />
                  )}

                  {loggedCustomer && !activeSubscription && (
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
                    className="w-full text-white font-bold py-4 rounded-2xl text-sm transition-all hover:opacity-90 disabled:opacity-50 shadow-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {createApptMutation.isPending ? 'Confirmando...' :
                      (paymentMethod === 'subscription' && canUseSubscription) ? 'Confirmar agendamento' : 'Continuar para pagamento →'}
                  </button>
                </div>
              )}

              {/* STEP 4: Pagamento */}
              {step === 4 && (
                <BookingPaymentStep
                  payload={buildBookingPayload()}
                  primaryColor={primaryColor}
                  pixEnabled={false}
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