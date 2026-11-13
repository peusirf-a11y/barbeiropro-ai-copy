// TodayAgendaList.jsx — Lista Executiva de Agendamentos Recentes
// Superfície: #FFFFFF | Borda: #E5E7EF | Tipografia: tabular-nums | Ícones: Lucide strokeWidth=1.75
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { getStatusToken } from '@/lib/statusTokens';
import AppointmentNoteIcon from '@/components/agenda/AppointmentNoteIcon';

export default function TodayAgendaList({ appointments = [] }) {
  const sorted = [...appointments].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const hasFutureAppts = sorted.some((a) => !isSameDay(new Date(a.scheduled_at), new Date()));

  return (
    <div className="rounded-2xl border border-[#E5E7EF] dark:border-[#232538] bg-[#FFFFFF] dark:bg-[#171827] p-4 sm:p-6 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#DBEAFE] dark:border-blue-800/40 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-extrabold text-[#171827] dark:text-white text-base tracking-tight">
                {hasFutureAppts ? 'Próximos Agendamentos' : 'Agenda de Hoje'}
              </h2>
              <p className="text-xs text-[#55596A] dark:text-[#8F9BBF] font-medium">
                Fluxo diário de clientes na barbearia
              </p>
            </div>
          </div>
          <Link
            to="/app/agenda"
            className="text-xs font-bold text-[#2563EB] dark:text-[#93C5FD] hover:underline inline-flex items-center gap-1"
          >
            <span>Ver agenda</span>
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
          </Link>
        </div>

        {sorted.length > 0 ? (
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {sorted.map((appt) => {
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
              const st = getStatusToken(appt.status);

              return (
                <div
                  key={appt.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#131422] border border-[#E5E7EF] dark:border-[#232538] hover:border-[#B5D7E8] transition-colors"
                >
                  <div className="w-14 text-center flex-shrink-0">
                    {isToday ? (
                      <div className="font-black text-sm text-[#171827] dark:text-white tabular-nums">
                        {format(apptDate, 'HH:mm')}
                      </div>
                    ) : (
                      <div className="leading-tight">
                        <div className="text-[10px] font-bold text-[#2563EB] dark:text-[#93C5FD] tabular-nums">
                          {format(apptDate, 'dd/MM')}
                        </div>
                        <div className="font-black text-sm text-[#171827] dark:text-white tabular-nums">
                          {format(apptDate, 'HH:mm')}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#171827] dark:text-white truncate">
                        {appt.customer_name || 'Cliente'}
                      </span>
                      {appt.notes && <AppointmentNoteIcon notes={appt.notes} />}
                    </div>
                    <div className="text-[11px] text-[#55596A] dark:text-[#8F9BBF] truncate font-medium">
                      {appt.service_name || 'Serviço'} · {appt.professional_name || 'Barbeiro'}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.badgeClass || 'bg-slate-100 text-slate-700'}`}>
                      {st.label}
                    </span>
                    {isPaidOnline && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40 leading-none">
                        {isCardPayment ? 'CARTÃO' : 'PIX'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-[#55596A] dark:text-[#8F9BBF] text-xs">
            Nenhum agendamento para hoje. Clique em "Ver agenda" para programar novos clientes.
          </div>
        )}
      </div>
    </div>
  );
}