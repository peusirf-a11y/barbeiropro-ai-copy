// Card compacto de agendamento para a grade semanal da AppAgenda.
// Mostra indicador visual de tipo de cliente (VIP / inativo / novo).

const statusConfig = {
  agendado: { color: 'border-l-blue-400 bg-blue-50' },
  confirmado: { color: 'border-l-green-400 bg-green-50' },
  em_atendimento: { color: 'border-l-yellow-400 bg-yellow-50' },
  concluido: { color: 'border-l-gray-300 bg-gray-50' },
  cancelado: { color: 'border-l-red-300 bg-red-50' },
  faltou: { color: 'border-l-orange-300 bg-orange-50' },
};

const CLIENT_BADGE = {
  vip: { label: '⭐', title: 'Cliente VIP', ring: 'ring-1 ring-amber-400' },
  inactive: { label: '💤', title: 'Cliente inativo', ring: 'ring-1 ring-gray-300' },
  new: { label: '🆕', title: 'Primeira visita', ring: 'ring-1 ring-blue-300' },
};

function getClientType(customer) {
  if (!customer) return 'new';
  if (customer.status === 'vip') return 'vip';
  if (customer.status === 'inactive') return 'inactive';
  if ((customer.total_appointments || 0) === 0) return 'new';
  return null; // cliente normal — sem badge
}

export default function AgendaAppointmentCard({ appt, customer, onClick }) {
  const clientType = getClientType(customer);
  const badge = clientType ? CLIENT_BADGE[clientType] : null;
  const colorClass = statusConfig[appt.status]?.color || 'border-l-gray-300 bg-gray-50';

  return (
    <div
      onClick={() => onClick?.(appt)}
      className={`rounded border-l-4 p-1.5 mb-1 ${colorClass} ${badge?.ring || ''} cursor-pointer hover:opacity-80 transition-opacity`}
    >
      <div className="flex items-center gap-1">
        <div className="text-xs font-semibold text-gray-800 truncate flex-1">
          {appt.customer_name || 'Cliente'}
        </div>
        {badge && (
          <span className="text-[10px] flex-shrink-0" title={badge.title}>{badge.label}</span>
        )}
      </div>
      <div className="text-xs text-gray-500 truncate">{appt.service_name}</div>
    </div>
  );
}