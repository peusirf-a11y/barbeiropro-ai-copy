import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Scissors, Clock, ChevronRight, Check, User, ChevronLeft, AlertCircle, MapPin } from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateToken, confirmTokenExpiry, reviewTokenExpiry } from '@/lib/tokens';
import { appointmentConflict, blockedConflict, annotateSlots, rankSlotsByFit } from '@/lib/scheduling';
import UnitPicker from '@/components/booking/UnitPicker';
import PhoneIdentificationStep from '@/components/booking/PhoneIdentificationStep';

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
    current += 30; // 30-min interval slots
  }
  return slots;
}

const DAY_MAP = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };

export default function PublicBooking() {
  const { slug } = useParams();
  // Fluxo: 'identify' → 0 (serviço) → 1 (profissional) → 2 (horário) → 3 (confirmação)
  // A identificação por telefone é OBRIGATÓRIA antes de qualquer ação.
  const [step, setStep] = useState('identify');
  const [selected, setSelected] = useState({ unit: null, service: null, professional: null, date: null, time: null });
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [bookingDone, setBookingDone] = useState(null);
  const [formError, setFormError] = useState('');
  // Cliente identificado na etapa de telefone (existente no banco)
  const [returningCustomer, setReturningCustomer] = useState(null);

  const { data: companies = [], isLoading: loadingCompany } = useQuery({
    queryKey: ['company-by-slug', slug],
    queryFn: () => base44.entities.Company.filter({ slug }),
    enabled: !!slug,
  });
  const company = companies[0];

  const { data: services = [] } = useQuery({
    queryKey: ['public-services', company?.id],
    queryFn: () => base44.entities.Service.filter({ company_id: company.id, active: true }),
    enabled: !!company?.id,
  });

  const { data: allProfessionals = [] } = useQuery({
    queryKey: ['public-professionals', company?.id],
    queryFn: () => base44.entities.Professional.filter({ company_id: company.id, active: true }),
    enabled: !!company?.id,
  });

  // Unidades ativas (apenas se a empresa tem multi_unit_enabled)
  const isMultiUnit = !!company?.multi_unit_enabled;
  const { data: units = [] } = useQuery({
    queryKey: ['public-units', company?.id],
    queryFn: async () => {
      const list = await base44.entities.Unit.filter({ company_id: company.id, active: true });
      return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
    enabled: !!company?.id && isMultiUnit,
  });

  // Pré-seleciona unidade via query param (?unidade=slug) ou quando há apenas 1 ativa
  useEffect(() => {
    if (!isMultiUnit || selected.unit) return;
    if (!units.length) return;
    const params = new URLSearchParams(window.location.search);
    const wantedSlug = params.get('unidade');
    const byParam = wantedSlug ? units.find(u => u.slug === wantedSlug) : null;
    if (byParam) {
      setSelected(p => ({ ...p, unit: byParam }));
      return;
    }
    if (units.length === 1) {
      setSelected(p => ({ ...p, unit: units[0] }));
    }
  }, [isMultiUnit, units, selected.unit]);

  // Filtra profissionais pela unidade escolhida (legados sem unit_ids[] aparecem em todas)
  const professionals = (isMultiUnit && selected.unit)
    ? allProfessionals.filter(p => !p.unit_ids || p.unit_ids.length === 0 || p.unit_ids.includes(selected.unit.id))
    : allProfessionals;

  const { data: allAppointments = [] } = useQuery({
    queryKey: ['public-appointments', company?.id],
    queryFn: () => base44.entities.Appointment.filter({ company_id: company.id }),
    enabled: !!company?.id,
  });

  const { data: allBlockedTimes = [] } = useQuery({
    queryKey: ['public-blocks', company?.id],
    queryFn: () => base44.entities.BlockedTime.filter({ company_id: company.id }, '-start_time', 200),
    enabled: !!company?.id,
  });

  // Filtra agendamentos e bloqueios pela unidade selecionada (registros sem unit_id são considerados aplicáveis a todas)
  const existingAppointments = (isMultiUnit && selected.unit)
    ? allAppointments.filter(a => !a.unit_id || a.unit_id === selected.unit.id)
    : allAppointments;
  const blockedTimes = (isMultiUnit && selected.unit)
    ? allBlockedTimes.filter(b => !b.unit_id || b.unit_id === selected.unit.id)
    : allBlockedTimes;

  // Em modo "clientes por unidade", o lookup e o create do Customer ficam restritos à unidade
  const customersSharedMode = company?.customers_shared_across_units !== false;
  const scopeCustomerByUnit = isMultiUnit && !customersSharedMode && !!selected.unit?.id;

  // Cria agendamento via backend (asServiceRole) — garante criação/vinculação do Customer
  // mesmo sem usuário autenticado.
  const createApptMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('createPublicAppointment', {
        ...data,
        scope_customer_by_unit: scopeCustomerByUnit,
      });
      if (!res?.data?.success) {
        throw new Error(res?.data?.error || 'Falha ao criar agendamento');
      }
      return res.data;
    },
    onSuccess: (result) => setBookingDone(result),
    onError: (err) => setFormError(err.message || 'Erro ao confirmar agendamento. Tente novamente.'),
  });

  const primaryColor = company?.primary_color || '#2563EB';

  // Compute available time slots for selected date/professional/service.
  // Retorna [{ time, smart }] — `smart=true` quando o slot preenche um buraco
  // na agenda do profissional (encaixe inteligente).
  const getAvailableSlots = () => {
    if (!selected.date || !selected.service || !company) return [];
    const dayKey = DAY_MAP[selected.date.getDay()];
    const hours = company.business_hours?.[dayKey];
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

    // 1) filtra slots indisponíveis (passado, conflito, bloqueio)
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

    // 2) reordena priorizando encaixes (preenche buracos primeiro)
    const ranked = rankSlotsByFit({
      slots: available,
      date: selected.date,
      durationMin: dur,
      professionalId: proId,
      appointments: apptsWithDuration,
      blocks: blockedTimes,
    });

    // 3) anota quais são "smart" (encaixe ideal) para destacar na UI
    const annotated = annotateSlots({
      slots: ranked,
      date: selected.date,
      durationMin: dur,
      professionalId: proId,
      appointments: apptsWithDuration,
      blocks: blockedTimes,
    });

    return annotated;
  };

  const handleBook = () => {
    // Telefone e nome já foram validados na etapa de identificação — apenas reforço de segurança.
    if (!form.phone.trim()) { setFormError('Telefone obrigatório. Volte e informe seu WhatsApp.'); return; }
    if (!form.name.trim()) { setFormError('Nome obrigatório. Volte e informe seu nome.'); return; }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError('Por favor, informe um e-mail válido');
      return;
    }
    setFormError('');
    const [h, m] = selected.time.split(':');
    const dt = new Date(selected.date);
    dt.setHours(+h, +m, 0, 0);
    const proId = selected.professional?.id === 'any' ? professionals[0]?.id : selected.professional?.id;

    // Re-valida no momento do submit (slot pode ter sido pego enquanto o usuário preenchia)
    const apptsWithDuration = existingAppointments.map(a => ({
      ...a,
      __duration: services.find(s => s.id === a.service_id)?.duration_minutes || 30,
    }));
    const dur = selected.service.duration_minutes || 30;
    if (appointmentConflict({ professionalId: proId, dateTime: dt, durationMin: dur, appointments: apptsWithDuration })) {
      setFormError('Horário indisponível — alguém acabou de pegar esse horário. Escolha outro.');
      return;
    }
    if (blockedConflict({ professionalId: proId, dateTime: dt, durationMin: dur, blocks: blockedTimes })) {
      setFormError('Horário indisponível neste momento.');
      return;
    }

    createApptMutation.mutate({
      company_id: company.id,
      unit_id: selected.unit?.id || undefined,
      professional_id: proId,
      service_id: selected.service.id,
      service_name: selected.service.name,
      professional_name: selected.professional?.id === 'any' ? 'Qualquer disponível' : selected.professional?.name,
      customer_name: form.name,
      customer_phone: form.phone,
      customer_email: form.email.trim() || undefined,
      scheduled_at: dt.toISOString(),
      notes: form.notes,
      status: 'agendado',
      price: selected.service.price,
      source: 'online',
      confirm_token: generateToken(),
      review_token: generateToken(),
      confirm_token_expires_at: confirmTokenExpiry(dt),
      review_token_expires_at: reviewTokenExpiry(dt),
    });
  };

  // Inclui o dia de hoje (i começa em 0). Horários passados são filtrados em getAvailableSlots.
  const next7Days = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i)).filter(day => {
    if (!company?.business_hours) return true;
    const dayKey = DAY_MAP[day.getDay()];
    return company.business_hours[dayKey]?.active !== false;
  });

  const availableSlots = getAvailableSlots();

  // Error state if slug not found
  if (!slug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F3]">
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="font-semibold text-gray-700">Link de agendamento inválido</p>
        </div>
      </div>
    );
  }

  if (loadingCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F3]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F3]">
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <p className="font-semibold text-gray-700">Barbearia não encontrada</p>
          <p className="text-sm text-gray-400 mt-2">Verifique o link e tente novamente</p>
        </div>
      </div>
    );
  }

  if (bookingDone) {
    return (
      <div className="min-h-screen bg-[#F8F7F3] flex flex-col">
        <header className="bg-white border-b border-black/10 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[#1B1C1E]">{company.name}</span>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl border border-black/8 p-10 text-center max-w-sm w-full shadow-lg">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-[#1B1C1E] mb-2">Agendado!</h2>
            <p className="text-gray-500 text-sm mb-2">Seu horário foi confirmado com sucesso.</p>
            {form.email && (
              <p className="text-xs text-gray-400 mb-6">Uma confirmação foi enviada para <span className="font-semibold text-gray-600">{form.email}</span></p>
            )}
            {!form.email && <div className="mb-6" />}
            <div className="bg-[#F8F7F3] rounded-xl p-4 text-left space-y-2 mb-6">
              {selected.unit && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">Unidade</span><span className="font-semibold">{selected.unit.name}</span></div>
              )}
              <div className="flex justify-between text-sm"><span className="text-gray-500">Serviço</span><span className="font-semibold">{selected.service?.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Profissional</span><span className="font-semibold">{selected.professional?.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Data</span><span className="font-semibold">{selected.date ? format(selected.date, "d 'de' MMMM", { locale: ptBR }) : ''}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Horário</span><span className="font-semibold">{selected.time}</span></div>
              <div className="flex justify-between text-sm border-t border-black/8 pt-2 mt-2"><span className="text-gray-500">Valor</span><span className="font-black text-lg" style={{ color: primaryColor }}>R${selected.service?.price}</span></div>
            </div>
            {company.whatsapp && (
              <a href={`https://wa.me/55${company.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="block w-full text-center text-white text-sm font-bold py-3 rounded-xl transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#25D366' }}>
                Confirmar pelo WhatsApp
              </a>
            )}
            <p className="text-xs text-gray-400 mt-4">Dúvidas? Entre em contato com {company.name}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F3] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primaryColor }}>
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-[#1B1C1E] truncate">{company.name}</div>
              {selected.unit?.address ? (
                <div className="text-xs text-gray-400 truncate">{selected.unit.address}</div>
              ) : company.address ? (
                <div className="text-xs text-gray-400 truncate">{company.address}</div>
              ) : null}
            </div>
          </div>
          {isMultiUnit && selected.unit && units.length > 1 && (
            <button
              onClick={() => {
                setSelected({ unit: null, service: null, professional: null, date: null, time: null });
                setStep('identify');
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg border border-black/5 flex-shrink-0"
              title="Trocar de unidade"
            >
              <MapPin className="w-3.5 h-3.5" style={{ color: primaryColor }} />
              <span className="max-w-[120px] truncate">{selected.unit.name}</span>
            </button>
          )}
        </div>
      </header>

      {/* Progress bar — só aparece após identificação */}
      {typeof step === 'number' && (
        <div className="bg-white border-b border-black/10">
          <div className="max-w-xl mx-auto px-6 py-3">
            <div className="flex items-center gap-2">
              {['Serviço', 'Profissional', 'Horário', 'Confirmar'].map((s, i) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < step ? 'text-white' : i === step ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                    style={{ backgroundColor: i <= step ? primaryColor : undefined }}>
                    {i < step ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-[#1B1C1E]' : 'text-gray-400'}`}>{s}</span>
                  {i < 3 && <div className={`flex-1 h-px`} style={{ backgroundColor: i < step ? primaryColor : '#e5e7eb' }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selo de cliente identificado — visível em todas as etapas após identificação */}
      {typeof step === 'number' && form.name && (
        <div className="bg-white border-b border-black/5">
          <div className="max-w-xl mx-auto px-6 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                {(form.name[0] || '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-gray-400 leading-none">Agendando como</div>
                <div className="text-sm font-bold text-[#111827] truncate">{form.name}</div>
              </div>
            </div>
            <button
              onClick={() => { setStep('identify'); setFormError(''); }}
              className="text-[11px] font-semibold text-gray-500 hover:text-[#111827] underline-offset-2 hover:underline flex-shrink-0"
            >
              Não sou eu
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 max-w-xl mx-auto w-full px-6 py-8">

        {/* Pré-passo: seleção de unidade (somente multi-unit com 2+ unidades) */}
        {isMultiUnit && !selected.unit && units.length > 1 && (
          <UnitPicker
            units={units}
            primaryColor={primaryColor}
            onSelect={(u) => setSelected(p => ({ ...p, unit: u }))}
          />
        )}

        {/* Loading enquanto busca unidades em modo multi-unit */}
        {isMultiUnit && !selected.unit && units.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* Fluxo normal — só renderiza depois que a unidade foi escolhida (ou não há multi-unit) */}
        {(!isMultiUnit || selected.unit) && (<>

        {/* Etapa 'identify': identificação obrigatória por telefone (1ª etapa do fluxo) */}
        {step === 'identify' && (
          <PhoneIdentificationStep
            companyId={company.id}
            scopeUnitId={scopeCustomerByUnit ? selected.unit?.id : undefined}
            primaryColor={primaryColor}
            initialPhone={form.phone}
            initialName={form.name}
            initialEmail={form.email}
            onContinue={({ phone, name, email, existingCustomer }) => {
              setForm(p => ({ ...p, phone, name, email }));
              setReturningCustomer(existingCustomer || null);
              setStep(0);
            }}
          />
        )}

        {/* Step 0: Service */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-black text-[#1B1C1E] mb-6">Escolha o serviço</h2>
            {services.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p>Nenhum serviço disponível no momento.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {services.map(s => (
                  <button key={s.id} onClick={() => { setSelected(p => ({ ...p, service: s })); setStep(1); }}
                    className="bg-white rounded-2xl border border-black/8 p-5 text-left hover:shadow-md transition-all flex items-center justify-between group"
                    style={{ borderColor: selected.service?.id === s.id ? primaryColor : undefined }}>
                    <div>
                      <div className="font-bold text-[#1B1C1E] mb-1">{s.name}</div>
                      {s.description && <div className="text-sm text-gray-500 mb-2">{s.description}</div>}
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />{s.duration_minutes} min
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className="text-xl font-black mb-2" style={{ color: primaryColor }}>R${s.price}</div>
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#1B3A4B] ml-auto transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Professional */}
        {step === 1 && (
          <div>
            <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-gray-500 mb-5 hover:text-[#1B1C1E]">
              <ChevronLeft className="w-4 h-4" />Voltar
            </button>
            <h2 className="text-xl font-black text-[#1B1C1E] mb-6">Escolha o profissional</h2>
            <div className="grid gap-3">
              <button onClick={() => { setSelected(p => ({ ...p, professional: { id: 'any', name: 'Qualquer disponível' } })); setStep(2); }}
                className="bg-white rounded-2xl border border-black/8 p-5 text-left hover:shadow-md transition-all flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-[#1B1C1E]">Qualquer disponível</div>
                  <div className="text-xs text-gray-400">Primeiro horário livre</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </button>
              {professionals.map(p => (
                <button key={p.id} onClick={() => { setSelected(s => ({ ...s, professional: p })); setStep(2); }}
                  className="bg-white rounded-2xl border border-black/8 p-5 text-left hover:shadow-md transition-all flex items-center gap-4">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.name} className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                      {(p.name || '?')[0]}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-bold text-[#1B1C1E]">{p.name}</div>
                    {p.specialty && <div className="text-xs text-gray-400">{p.specialty}</div>}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-500 mb-5 hover:text-[#1B1C1E]">
              <ChevronLeft className="w-4 h-4" />Voltar
            </button>
            <h2 className="text-xl font-black text-[#1B1C1E] mb-6">Escolha o horário</h2>
            
            {next7Days.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p>Nenhum dia disponível nas próximas 2 semanas</p>
              </div>
            ) : (
              <>
                {/* Date picker */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  {next7Days.slice(0, 10).map((day, i) => {
                    const isSelected = selected.date?.toDateString() === day.toDateString();
                    return (
                      <button key={i} onClick={() => setSelected(p => ({ ...p, date: day, time: null }))}
                        className={`flex-shrink-0 flex flex-col items-center p-3 rounded-2xl border transition-all min-w-[64px] ${isSelected ? 'text-white border-transparent' : 'bg-white border-black/10 text-gray-600 hover:border-[#2563EB]'}`}
                        style={{ backgroundColor: isSelected ? primaryColor : undefined }}>
                        <span className="text-xs uppercase tracking-wide opacity-70">{format(day, 'EEE', { locale: ptBR })}</span>
                        <span className="text-xl font-black">{format(day, 'd')}</span>
                        <span className="text-xs opacity-70">{format(day, 'MMM', { locale: ptBR })}</span>
                      </button>
                    );
                  })}
                </div>

                {selected.date && (
                  <div>
                    <div className="text-sm font-semibold text-gray-500 mb-3">
                      {format(selected.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </div>
                    {availableSlots.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-sm">Nenhum horário disponível neste dia</p>
                        <p className="text-xs mt-1">Tente outro dia</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-4 gap-2">
                          {availableSlots.map(({ time: t, smart }) => {
                            const isSelected = selected.time === t;
                            return (
                              <button key={t} onClick={() => setSelected(p => ({ ...p, time: t }))}
                                className={`relative py-2.5 rounded-xl text-sm font-semibold transition-all border ${isSelected ? 'text-white border-transparent' : 'bg-white border-black/10 text-gray-700 hover:border-[#2563EB]'} ${smart && !isSelected ? 'ring-1 ring-amber-300' : ''}`}
                                style={{ backgroundColor: isSelected ? primaryColor : undefined }}
                                title={smart ? 'Encaixe ideal — preenche um intervalo na agenda' : undefined}>
                                {t}
                                {smart && !isSelected && (
                                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {availableSlots.some(s => s.smart) && (
                          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-gray-400">
                            <span className="w-2 h-2 bg-amber-400 rounded-full" />
                            Horários com pontinho são encaixes ideais na agenda
                          </div>
                        )}
                        {selected.time && (
                          <button onClick={() => setStep(3)} className="mt-6 w-full text-white font-bold py-4 rounded-2xl text-sm transition-opacity hover:opacity-90"
                            style={{ backgroundColor: primaryColor }}>
                            Continuar <ChevronRight className="w-4 h-4 inline ml-1" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Confirmação — nome e telefone já foram coletados na etapa de identificação */}
        {step === 3 && (
          <div>
            <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-gray-500 mb-5 hover:text-[#1B1C1E]">
              <ChevronLeft className="w-4 h-4" />Voltar
            </button>
            <h2 className="text-xl font-black text-[#1B1C1E] mb-6">Confirmar agendamento</h2>

            {/* Summary completo */}
            <div className="bg-white rounded-2xl border border-black/8 p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Cliente</span><span className="font-semibold truncate ml-2">{form.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">WhatsApp</span><span className="font-semibold">{form.phone}</span></div>
              {selected.unit && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">Unidade</span><span className="font-semibold">{selected.unit.name}</span></div>
              )}
              <div className="flex justify-between text-sm"><span className="text-gray-500">Serviço</span><span className="font-semibold">{selected.service?.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Profissional</span><span className="font-semibold">{selected.professional?.name}</span></div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Data e hora</span>
                <span className="font-semibold">{selected.date ? format(selected.date, "d 'de' MMM", { locale: ptBR }) : ''} às {selected.time}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-black/8 pt-2 mt-2">
                <span className="text-gray-500">Valor</span>
                <span className="font-black text-lg" style={{ color: primaryColor }}>R${selected.service?.price}</span>
              </div>
            </div>

            {returningCustomer && (
              <div className="mb-4 flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-emerald-800 leading-relaxed">
                  <span className="font-semibold">Cliente identificado.</span> Vamos vincular este agendamento ao seu histórico.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Observações (opcional)</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                placeholder="Preferências ou informações adicionais"
                className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm bg-white resize-none" />
            </div>

            {formError && (
              <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
              </div>
            )}

            <button onClick={handleBook} disabled={!form.name || !form.phone || createApptMutation.isPending}
              className="mt-6 w-full text-white font-bold py-4 rounded-2xl text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              style={{ backgroundColor: primaryColor }}>
              {createApptMutation.isPending ? 'Confirmando...' : 'Confirmar agendamento'}
            </button>
          </div>
        )}
        </>)}
      </div>

      <footer className="bg-white border-t border-black/10 py-4 text-center">
        <p className="text-xs text-gray-400">Agendamento online por <span className="font-semibold text-[#2563EB]">BarberTrimly</span></p>
      </footer>
    </div>
  );
}