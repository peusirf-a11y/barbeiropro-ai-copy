// Lista da agenda do dia — versão clean alinhada ao design system.

import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { getStatusToken } from '@/lib/statusTokens';

export default function TodayAgendaList({ appointments = [] }) {
  const sorted = [...appointments].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 sm:p-6 shadow-[var(--shadow-sm)] h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#2563EB]" />
          <h2 className="font-bold text-[#111827] text-base">Agenda de hoje</h2>
        </div>
        <Link to="/app/agenda" className="text-xs font-semibold text-[#2563EB] hover:underline">
          Ver agenda →
        </Link>
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {sorted.map(appt => (
            <div
              key={appt.id}
              className="flex items-center gap-4 p-3 rounded-xl bg-[#FAFBFC] hover:bg-[#F1F5F9] transition-colors duration-150"
            >
              <div className="w-12 text-center flex-shrink-0">
                <div className="font-bold text-sm text-[#111827]">{format(new Date(appt.scheduled_at), 'HH:mm')}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-[#111827] truncate">{appt.customer_name || 'Cliente'}</div>
                <div className="text-xs text-[#6B7280] truncate">{appt.service_name} · {appt.professional_name}</div>
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
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-[#6B7280]">
          <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum agendamento hoje</p>
          <Link to="/app/agenda" className="text-xs text-[#2563EB] font-semibold mt-2 inline-block hover:underline">
            Criar agendamento →
          </Link>
        </div>
      )}
    </div>
  );
}