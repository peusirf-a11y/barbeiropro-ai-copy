// Versão mobile-first da agenda do dia: lista vertical agrupada por horário.
// Substitui automaticamente AgendaProColumns em telas <768px.
// Não tem DnD nem resize — clique abre o modal de edição (mesmo handler).

import { format, addMinutes } from 'date-fns';
import { useMemo } from 'react';
import { Calendar, Sparkles } from 'lucide-react';
import { getStatusToken, isClientWithoutPreference } from '@/lib/statusTokens';
import AppointmentNoteIcon from '@/components/agenda/AppointmentNoteIcon';
import AppointmentSourceIcon from '@/components/agenda/AppointmentSourceIcon';
import FirstVisitBadge from '@/components/agenda/FirstVisitBadge';
import WhatsAppButton from '@/components/whatsapp/WhatsAppButton';
import { useCompany } from '@/hooks/useCompany';
import { buildConfirmationMessage, buildReminderMessage, buildPostAppointmentMessage } from '@/lib/whatsappCompose';

export default function AgendaMobileList({
  selectedDate,
  professionals = [],
  appointments = [],
  services = [],
  customers = [],
  subByCustomer = {},
  hasActivePlans = false,
  onCardClick,
  onOfferPlan,
}) {
  const { company } = useCompany();
  // Guards defensivos: queries do TanStack já têm default=[], mas se algum caller
  // passar undefined explicitamente (ex: estado intermediário), não quebrar a tela.
  const safeProfessionals = Array.isArray(professionals) ? professionals : [];
  const safeAppointments = Array.isArray(appointments) ? appointments : [];
  const safeServices = Array.isArray(services) ? services : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];

  const customerById = useMemo(() => {
    return safeCustomers.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
  }, [safeCustomers]);
  const dayAppts = useMemo(() => {
    return safeAppointments
      .filter(a => {
        const d = new Date(a.scheduled_at);
        return d.toDateString() === selectedDate.toDateString();
      })
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }, [safeAppointments, selectedDate]);

  const proById = useMemo(() => {
    return safeProfessionals.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
  }, [safeProfessionals]);

  if (!dayAppts.length) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-6 sm:p-8 text-center text-white/55">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">Nenhum agendamento neste dia</p>
        <p className="text-xs mt-1 text-white/35">Toque em "Novo" para criar</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md overflow-hidden divide-y divide-white/5 select-none">
      {dayAppts.map(appt => {
        const svc = safeServices.find(s => s.id === appt.service_id);
        const dur = appt.custom_duration_minutes || svc?.duration_minutes || 30;
        const start = new Date(appt.scheduled_at);
        const endTime = format(addMinutes(start, dur), 'HH:mm');
        const startTime = format(start, 'HH:mm');
        const token = getStatusToken(appt.status);
        const customer = customerById[appt.customer_id] || safeCustomers.find(c => (c.name || '').toLowerCase() === (appt.customer_name || '').toLowerCase());
        const noPreference = isClientWithoutPreference(appt, customer);
        const isFirstVisit = customer && (customer.total_appointments || 0) === 0;
        const pro = proById[appt.professional_id];
        const isSubscriber = appt.payment_method === 'subscription' || !!(customer?.id && subByCustomer[customer.id]) || !!(appt.customer_id && subByCustomer[appt.customer_id]);
        const canOfferPlan = hasActivePlans && !isSubscriber && !['cancelado', 'faltou'].includes(appt.status) && !!(customer?.id || appt.customer_id);

        return (
          <div
            key={appt.id}
            role="button"
            tabIndex={0}
            onClick={() => onCardClick?.(appt)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCardClick?.(appt);
              }
            }}
            className="w-full flex items-stretch gap-2.5 sm:gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 text-left active:bg-white/[0.04] transition-colors cursor-pointer"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {/* Coluna do horário */}
            <div className="flex flex-col items-center justify-center w-14 flex-shrink-0">
              <div className="text-sm font-bold text-white">{startTime}</div>
              <div className="text-[10px] text-white/40 mt-0.5">{endTime}</div>
              <div className="text-[9px] text-white/35 mt-0.5">{dur}min</div>
            </div>

            {/* Barra colorida de status */}
            <div className="w-1 rounded-full flex-shrink-0" style={{ background: token.accent, opacity: noPreference ? 0.6 : 1 }} />

            {/* Conteúdo */}
            <div className={`flex-1 min-w-0 rounded-xl border backdrop-blur-sm ${token.cardBg} ${token.cardBorder} ${token.cardText} ${noPreference ? 'border-dashed' : ''} px-3 py-2`}>
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="font-semibold text-[13px] truncate">
                  {appt.customer_name || 'Cliente'}
                </span>
                {isFirstVisit && <FirstVisitBadge />}
                {isSubscriber && (
                  <span className="text-[9px] font-bold px-1 py-px rounded bg-violet-400/20 text-violet-200 border border-violet-400/30 flex-shrink-0">
                    PLANO
                  </span>
                )}
                {(appt.paid || appt.paid_online) && (
                  <span className="text-[9px] font-bold px-1 py-px rounded bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 flex-shrink-0" title={appt.paid_online ? 'Pago online' : 'Pago'}>
                    PAGO
                  </span>
                )}
              </div>
              <div className="text-[12px] opacity-80 truncate">{appt.service_name}</div>
              {pro && (
                <div className="text-[11px] opacity-60 mt-0.5 truncate">com {pro.name}</div>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <AppointmentSourceIcon source={appt.source} className="w-3 h-3 opacity-60" />
                <AppointmentNoteIcon note={appt.notes} />
                {canOfferPlan && onOfferPlan && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOfferPlan({
                        ...(customer || {}),
                        id: customer?.id || appt.customer_id,
                        name: customer?.name || appt.customer_name || 'Cliente',
                        phone: customer?.phone || appt.customer_phone || '',
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] hover:brightness-110 text-white px-2.5 py-1 rounded-lg transition-all ring-1 ring-white/20 shadow-[0_4px_12px_rgba(37,99,235,0.4)]"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    Oferecer plano
                  </button>
                )}
                <span className="ml-auto text-[10px] font-medium opacity-60">{token.label}</span>
                {/* WhatsApp manual — usa template de confirmação se ainda não confirmado,
                    lembrete se confirmado, ou avaliação se concluído. */}
                {appt.customer_phone && !['cancelado', 'faltou'].includes(appt.status) && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <WhatsAppButton
                      phone={appt.customer_phone}
                      message={
                        appt.status === 'concluido'
                          ? buildPostAppointmentMessage({ company, appointment: appt })
                          : appt.status === 'confirmado'
                          ? buildReminderMessage({ company, appointment: appt })
                          : buildConfirmationMessage({ company, appointment: appt })
                      }
                      title={
                        appt.status === 'concluido'
                          ? 'Enviar link de avaliação'
                          : appt.status === 'confirmado'
                          ? 'Enviar lembrete'
                          : 'Enviar confirmação'
                      }
                      className="w-7 h-7"
                    />
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}