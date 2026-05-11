// Versão mobile-first da agenda do dia: lista vertical agrupada por horário.
// Substitui automaticamente AgendaProColumns em telas <768px.
// Não tem DnD nem resize — clique abre o modal de edição (mesmo handler).

import { format, addMinutes } from 'date-fns';
import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { getStatusToken, isClientWithoutPreference } from '@/lib/statusTokens';
import AppointmentNoteIcon from '@/components/agenda/AppointmentNoteIcon';
import AppointmentSourceIcon from '@/components/agenda/AppointmentSourceIcon';
import FirstVisitBadge from '@/components/agenda/FirstVisitBadge';
import WhatsAppButton from '@/components/whatsapp/WhatsAppButton';
import { useCompany } from '@/hooks/useCompany';
import { buildConfirmationMessage, buildReminderMessage } from '@/lib/whatsappCompose';

export default function AgendaMobileList({
  selectedDate,
  professionals = [],
  appointments = [],
  services = [],
  customers = [],
  onCardClick,
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
      <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-gray-500">
        <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">Nenhum agendamento neste dia</p>
        <p className="text-xs mt-1 text-gray-400">Toque em "Novo" para criar</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] overflow-hidden divide-y divide-black/5 select-none">
      {dayAppts.map(appt => {
        const svc = safeServices.find(s => s.id === appt.service_id);
        const dur = appt.custom_duration_minutes || svc?.duration_minutes || 30;
        const start = new Date(appt.scheduled_at);
        const endTime = format(addMinutes(start, dur), 'HH:mm');
        const startTime = format(start, 'HH:mm');
        const token = getStatusToken(appt.status);
        const customer = customerById[appt.customer_id];
        const noPreference = isClientWithoutPreference(appt, customer);
        const isFirstVisit = customer && (customer.total_appointments || 0) === 0;
        const pro = proById[appt.professional_id];

        return (
          <button
            key={appt.id}
            onClick={() => onCardClick?.(appt)}
            className="w-full flex items-stretch gap-3 px-4 py-3 text-left active:bg-gray-50 transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {/* Coluna do horário */}
            <div className="flex flex-col items-center justify-center w-14 flex-shrink-0">
              <div className="text-sm font-bold text-[#0F172A]">{startTime}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{endTime}</div>
              <div className="text-[9px] text-gray-400 mt-0.5">{dur}min</div>
            </div>

            {/* Barra colorida de status */}
            <div className={`w-1 rounded-full ${token.cardBorder.replace('border-', 'bg-')} ${noPreference ? 'opacity-60' : ''}`} />

            {/* Conteúdo */}
            <div className={`flex-1 min-w-0 rounded-xl border ${token.cardBg} ${token.cardBorder} ${token.cardText} ${noPreference ? 'border-dashed' : ''} px-3 py-2`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-[13px] truncate">
                  {appt.customer_name || 'Cliente'}
                </span>
                {isFirstVisit && <FirstVisitBadge />}
                {appt.payment_method === 'subscription' && (
                  <span className="text-[9px] font-bold px-1 py-px rounded bg-violet-100 text-violet-700 border border-violet-200 flex-shrink-0">
                    PLANO
                  </span>
                )}
                {(appt.paid || appt.paid_online) && (
                  <span className="text-[9px] font-bold px-1 py-px rounded bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0" title={appt.paid_online ? 'Pago online' : 'Pago'}>
                    PAGO
                  </span>
                )}
              </div>
              <div className="text-[12px] opacity-80 truncate">{appt.service_name}</div>
              {pro && (
                <div className="text-[11px] opacity-60 mt-0.5 truncate">com {pro.name}</div>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <AppointmentSourceIcon source={appt.source} className="w-3 h-3 opacity-60" />
                <AppointmentNoteIcon note={appt.notes} />
                <span className="ml-auto text-[10px] font-medium opacity-60">{token.label}</span>
                {/* WhatsApp manual — usa template de confirmação se ainda não confirmado,
                    senão lembrete. Para appointments concluídos, oculta (já houve o pós-atendimento). */}
                {appt.customer_phone && !['concluido', 'cancelado', 'faltou'].includes(appt.status) && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <WhatsAppButton
                      phone={appt.customer_phone}
                      message={
                        appt.status === 'confirmado'
                          ? buildReminderMessage({ company, appointment: appt })
                          : buildConfirmationMessage({ company, appointment: appt })
                      }
                      title={appt.status === 'confirmado' ? 'Enviar lembrete' : 'Enviar confirmação'}
                      className="w-7 h-7"
                    />
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}