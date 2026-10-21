// Agenda de hoje — lista dark glass.

import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { getStatusToken } from '@/lib/statusTokens';
import AppointmentNoteIcon from '@/components/agenda/AppointmentNoteIcon';

export default function TodayAgendaList({ appointments = [] }) {
  const sorted = [...appointments].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const hasFutureAppts = sorted.some(a => !isSameDay(new Date(a.scheduled_at), new Date()));

  return (
    <div className="relative rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 sm:p-6 h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 rounded-md bg-[#60A5FA]/40 blur-md" />
            <Calendar className="relative w-4 h-4 text-[#93C5FD]" />
          </div>
          <h2 className="font-bold text-white text-base">
            {hasFutureAppts ? 'Próximos agendamentos' : 'Agenda de hoje'}
          </h2>
        </div>
        <Link to="/app/agenda" className="text-xs font-semibold text-[#93C5FD] hover:text-white transition-colors">
          Ver agenda →
        </Link>
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {sorted.map(appt => {
            const apptDate = new Date(appt.scheduled_at);
            const isToday = isSameDay(apptDate, new Date());
            const isPaidOnline =
              appt.paid ||
              appt.paid_online ||
              appt.payment_status === 'confirmed' ||
              appt.payment_status === 'confirmed_card' ||
              Boolean(appt.asaas_payment_id);
            const isCardPayment =
              appt.payment_status === 'confirmed_card' ||
              appt.payment_method === 'credit_card' ||
              appt.payment_method === 'card';
            return (
              <div
                key={appt.id}
                className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.025] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-150"
              >
                <div className="w-14 text-center flex-shrink-0">
                  {isToday ? (
                    <div className="font-bold text-sm text-white">{format(apptDate, 'HH:mm')}</div>
                  ) : (
                    <div className="leading-tight">
                      <div className="text-[10px] font-bold text-[#93C5FD]">{format(apptDate, 'dd/MM')}</div>
                      <div className="font-bold text-sm text-white">{format(apptDate, 'HH:mm')}</div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-white truncate">{appt.customer_name || 'Cliente'}</span>
                    <AppointmentNoteIcon note={appt.notes} />
                    {isPaidOnline && (
                      <span
                        className="text-[9px] font-bold flex-shrink-0 bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25 px-1.5 py-0.5 rounded"
                        title={isCardPayment ? 'Pago online via Cartão de Crédito' : 'Pago online via Pix'}
                      >
                        {isCardPayment ? 'PAGO CARTÃO' : 'PAGO PIX'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/50 truncate">{appt.service_name} · {appt.professional_name}</div>
                </div>
                {(() => {
                  const t = getStatusToken(appt.status);
                  return (
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${t.pill}`}>
                      {t.label}
                    </span>
                  );
                })()}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-white/45">
          <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum agendamento hoje</p>
          <Link to="/app/agenda" className="text-xs text-[#93C5FD] font-semibold mt-2 inline-block hover:text-white transition-colors">
            Criar agendamento →
          </Link>
        </div>
      )}
    </div>
  );
}