import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Scissors, Clock, ChevronRight, Check, Calendar, User, Phone, ChevronLeft } from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];

export default function PublicBooking() {
  const { slug } = useParams();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState({ service: null, professional: null, date: null, time: null });
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });
  const [bookingDone, setBookingDone] = useState(null);

  const { data: companies = [] } = useQuery({
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

  const { data: professionals = [] } = useQuery({
    queryKey: ['public-professionals', company?.id],
    queryFn: () => base44.entities.Professional.filter({ company_id: company.id, active: true }),
    enabled: !!company?.id,
  });

  const { data: existingAppointments = [] } = useQuery({
    queryKey: ['public-appointments', company?.id, selected.date],
    queryFn: () => base44.entities.Appointment.filter({ company_id: company.id }),
    enabled: !!company?.id,
  });

  const createApptMutation = useMutation({
    mutationFn: (data) => base44.entities.Appointment.create(data),
    onSuccess: (result) => setBookingDone(result),
  });

  const primaryColor = company?.primary_color || '#1B3A4B';

  const isSlotTaken = (time) => {
    if (!selected.date || !selected.professional) return false;
    return existingAppointments.some(a => {
      const d = new Date(a.scheduled_at);
      return a.professional_id === selected.professional?.id &&
        d.toDateString() === selected.date.toDateString() &&
        format(d, 'HH:mm') === time &&
        a.status !== 'cancelado';
    });
  };

  const handleBook = () => {
    const [h, m] = selected.time.split(':');
    const dt = new Date(selected.date);
    dt.setHours(+h, +m, 0, 0);

    createApptMutation.mutate({
      company_id: company.id,
      professional_id: selected.professional.id,
      service_id: selected.service.id,
      service_name: selected.service.name,
      professional_name: selected.professional.name,
      customer_name: form.name,
      customer_phone: form.phone,
      scheduled_at: dt.toISOString(),
      notes: form.notes,
      status: 'agendado',
      price: selected.service.price,
      source: 'online',
    });
  };

  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i + 1));

  if (!slug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F3]">
        <div className="text-center">
          <p className="text-gray-500">Link de agendamento inválido</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F3]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#1B3A4B]/20 border-t-[#1B3A4B] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Carregando...</p>
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
            <p className="text-gray-500 text-sm mb-6">Seu horário foi confirmado com sucesso.</p>
            <div className="bg-[#F8F7F3] rounded-xl p-4 text-left space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Serviço</span>
                <span className="font-semibold text-[#1B1C1E]">{selected.service?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Profissional</span>
                <span className="font-semibold text-[#1B1C1E]">{selected.professional?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Data</span>
                <span className="font-semibold text-[#1B1C1E]">{selected.date ? format(selected.date, "d 'de' MMMM", { locale: ptBR }) : ''}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Horário</span>
                <span className="font-semibold text-[#1B1C1E]">{selected.time}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Valor</span>
                <span className="font-bold" style={{ color: primaryColor }}>R${selected.service?.price}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400">Em caso de dúvidas, entre em contato com {company.name}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F3] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-black/10 px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm text-[#1B1C1E]">{company.name}</div>
            {company.address && <div className="text-xs text-gray-400">{company.address}</div>}
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-white border-b border-black/10">
        <div className="max-w-xl mx-auto px-6 py-3">
          <div className="flex items-center gap-2">
            {['Serviço', 'Profissional', 'Horário', 'Seus dados'].map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < step ? 'text-white' : i === step ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                  style={{ backgroundColor: i <= step ? primaryColor : undefined }}>
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-[#1B1C1E]' : 'text-gray-400'}`}>{s}</span>
                {i < 3 && <div className={`flex-1 h-px ${i < step ? '' : 'bg-gray-200'}`} style={{ backgroundColor: i < step ? primaryColor : undefined }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-auto w-full px-6 py-8">
        {/* Step 0: Service */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-black text-[#1B1C1E] mb-6">Escolha o serviço</h2>
            <div className="grid gap-3">
              {services.map(s => (
                <button key={s.id} onClick={() => { setSelected(p => ({ ...p, service: s })); setStep(1); }}
                  className="bg-white rounded-2xl border border-black/8 p-5 text-left hover:border-[#1B3A4B] hover:shadow-md transition-all flex items-center justify-between group">
                  <div>
                    <div className="font-bold text-[#1B1C1E] mb-1">{s.name}</div>
                    {s.description && <div className="text-sm text-gray-500 mb-2">{s.description}</div>}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" />{s.duration_minutes} min</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black mb-2" style={{ color: primaryColor }}>R${s.price}</div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#1B3A4B] ml-auto transition-colors" />
                  </div>
                </button>
              ))}
            </div>
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
                className="bg-white rounded-2xl border border-black/8 p-5 text-left hover:border-[#1B3A4B] transition-all flex items-center gap-4">
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
                  className="bg-white rounded-2xl border border-black/8 p-5 text-left hover:border-[#1B3A4B] transition-all flex items-center gap-4">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.name} className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: primaryColor }}>
                      {p.name[0]}
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
            
            {/* Date picker */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {next7Days.map((day, i) => {
                const isSelected = selected.date?.toDateString() === day.toDateString();
                return (
                  <button key={i} onClick={() => setSelected(p => ({ ...p, date: day, time: null }))}
                    className={`flex-shrink-0 flex flex-col items-center p-3 rounded-2xl border transition-all min-w-[64px] ${isSelected ? 'text-white border-transparent' : 'bg-white border-black/10 text-gray-600 hover:border-[#1B3A4B]'}`}
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
                  Horários para {format(selected.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map(t => {
                    const taken = isSlotTaken(t);
                    const isSelected = selected.time === t;
                    return (
                      <button key={t} disabled={taken} onClick={() => setSelected(p => ({ ...p, time: t }))}
                        className={`py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                          taken ? 'bg-gray-100 text-gray-300 cursor-not-allowed border-transparent' :
                          isSelected ? 'text-white border-transparent' :
                          'bg-white border-black/10 text-gray-700 hover:border-[#1B3A4B]'
                        }`}
                        style={{ backgroundColor: isSelected ? primaryColor : undefined }}>
                        {t}
                      </button>
                    );
                  })}
                </div>
                {selected.time && (
                  <button onClick={() => setStep(3)} className="mt-6 w-full text-white font-bold py-4 rounded-2xl text-sm transition-colors hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}>
                    Continuar
                    <ChevronRight className="w-4 h-4 inline ml-1" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Customer info */}
        {step === 3 && (
          <div>
            <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-gray-500 mb-5 hover:text-[#1B1C1E]">
              <ChevronLeft className="w-4 h-4" />Voltar
            </button>
            <h2 className="text-xl font-black text-[#1B1C1E] mb-6">Seus dados</h2>
            
            {/* Summary */}
            <div className="bg-white rounded-2xl border border-black/8 p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Serviço</span>
                <span className="font-semibold text-[#1B1C1E]">{selected.service?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Profissional</span>
                <span className="font-semibold text-[#1B1C1E]">{selected.professional?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Data e hora</span>
                <span className="font-semibold text-[#1B1C1E]">
                  {selected.date ? format(selected.date, "d 'de' MMM", { locale: ptBR }) : ''} às {selected.time}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-black/8 pt-2 mt-2">
                <span className="text-gray-500">Valor</span>
                <span className="font-black text-lg" style={{ color: primaryColor }}>R${selected.service?.price}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Seu nome *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Como você se chama?"
                  className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A4B]/20 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">WhatsApp / Telefone *</label>
                <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A4B]/20 bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Observações (opcional)</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  placeholder="Alguma preferência ou informação adicional?"
                  className="w-full px-4 py-3 border border-black/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A4B]/20 bg-white resize-none" />
              </div>
            </div>

            <button onClick={handleBook} disabled={!form.name || !form.phone || createApptMutation.isPending}
              className="mt-6 w-full text-white font-bold py-4 rounded-2xl text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: primaryColor }}>
              {createApptMutation.isPending ? 'Confirmando...' : 'Confirmar agendamento'}
            </button>
          </div>
        )}
      </div>

      <footer className="bg-white border-t border-black/10 py-4 text-center">
        <p className="text-xs text-gray-400">Agendamento online por <span className="font-semibold text-[#1B3A4B]">BarbeiroPro AI</span></p>
      </footer>
    </div>
  );
}