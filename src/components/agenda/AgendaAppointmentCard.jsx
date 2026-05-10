// Card compacto de agendamento para a grade semanal da AppAgenda.
// Cores via tokens centrais (lib/statusTokens.js) para consistência em todo o sistema.

import { getStatusToken, isClientWithoutPreference } from '@/lib/statusTokens';
import AppointmentNoteIcon from '@/components/agenda/AppointmentNoteIcon';
import AppointmentSourceIcon from '@/components/agenda/AppointmentSourceIcon';
import FirstVisitBadge from '@/components/agenda/FirstVisitBadge';

const CLIENT_BADGE = {
  vip: { label: '⭐', title: 'Cliente VIP', ring: 'ring-1 ring-amber-400' },
  inactive: { label: '💤', title: 'Cliente inativo', ring: 'ring-1 ring-gray-300' },
};

function getClientType(customer) {
  if (!customer) return 'new';
  if (customer.status === 'vip') return 'vip';
  if (customer.status === 'inactive') return 'inactive';
  if ((customer.total_appointments || 0) === 0) return 'new';
  return null;
}

export default function AgendaAppointmentCard({ appt, customer, onClick }) {
  const clientType = getClientType(customer);
  const badge = clientType && clientType !== 'new' ? CLIENT_BADGE[clientType] : null;
  const isNew = clientType === 'new';
  const token = getStatusToken(appt.status);
  const noPreference = isClientWithoutPreference(appt);

  return (
    <div
      onClick={() => onClick?.(appt)}
      className={`rounded border-l-4 p-1.5 mb-1 ${token.leftBar} ${badge?.ring || ''} ${isNew ? 'ring-1 ring-blue-200/70' : ''} ${noPreference ? 'border border-dashed border-gray-300' : ''} cursor-pointer hover:opacity-80 transition-opacity`}
    >
      <div className="flex items-center gap-1">
        <div className="text-xs font-semibold text-gray-800 truncate flex-1">
          {appt.customer_name || 'Cliente'}
        </div>
        <AppointmentNoteIcon note={appt.notes} />
        <AppointmentSourceIcon source={appt.source} className="w-3 h-3 opacity-50 text-gray-500" />
        {(appt.paid || appt.paid_online) && (
          <span className="text-[9px] font-bold flex-shrink-0 bg-emerald-100 text-emerald-700 px-1 rounded" title={appt.paid_online ? 'Pago online' : 'Pago'}>PAGO</span>
        )}
        {isNew && <FirstVisitBadge size="xs" />}
        {badge && (
          <span className="text-[10px] flex-shrink-0" title={badge.title}>{badge.label}</span>
        )}
      </div>
      <div className="text-xs text-gray-500 truncate">{appt.service_name}</div>
    </div>
  );
}