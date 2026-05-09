// Versão mobile-first da agenda do dia: lista vertical agrupada por horário.
// Substitui automaticamente AgendaProColumns em telas <768px.
// Não tem DnD nem resize — clique abre o modal de edição (mesmo handler).

import { format, addMinutes } from 'date-fns';
import { useMemo } from 'react';
import { Calendar, Smartphone } from 'lucide-react';
import { getStatusToken, isClientWithoutPreference } from '@/lib/statusTokens';
import AppointmentNoteIcon from '@/components/agenda/AppointmentNoteIcon';

export default function AgendaMobileList({
  selectedDate,
  professionals,
  appointments,
  services,
  customers = [],
  onCardClick,
}) {
  const customerById = useMemo(() => {
    return customers.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
  }, [customers]);
  const dayAppts = useMemo(() => {
    return appointments
      .filter(a => {
        const d = new Date(a.scheduled_at);
        return d.toDateString() === selectedDate.toDateString();
      })
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }, [appointments, selectedDate]);

  const proById = useMemo(() => {
    return professionals.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
  }, [professionals]);

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
        const svc = services.find(s => s.id === appt.service_id);
        const dur = appt.custom_duration_minutes || svc?.duration_minutes || 30;
        const start = new Date(appt.scheduled_at);
        const endTime = format(addMinutes(start, dur), 'HH:mm');
        const startTime = format(start, 'HH:mm');
        const token = getStatusToken(appt.status);
        const noPreference = isClientWithoutPreference(appt, customerById[appt.customer_id]);
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
                <Smartphone className="w-3 h-3 opacity-60" />
                <AppointmentNoteIcon note={appt.notes} />
                <span className="ml-auto text-[10px] font-medium opacity-60">{token.label}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}