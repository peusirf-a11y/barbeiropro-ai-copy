// Badge maior de tipo de cliente — usado em telas de detalhe.
// Reutiliza a mesma lógica de classificação dos cards da agenda.

const TYPES = {
  vip:      { label: 'VIP',           icon: '⭐', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  inactive: { label: 'Inativo',       icon: '💤', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  new:      { label: 'Primeira visita', icon: '🆕', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  regular:  { label: 'Cliente fiel',   icon: '✓',  cls: 'bg-green-50 text-green-700 border-green-200' },
};

export function getCustomerType(customer) {
  if (!customer) return 'new';
  if (customer.status === 'vip') return 'vip';
  if (customer.status === 'inactive') return 'inactive';
  if ((customer.total_appointments || 0) === 0) return 'new';
  if ((customer.total_appointments || 0) >= 5) return 'regular';
  return null;
}

export default function CustomerTypeBadge({ customer }) {
  const type = getCustomerType(customer);
  if (!type) return null;
  const t = TYPES[type];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${t.cls}`}>
      <span>{t.icon}</span>{t.label}
      {customer?.total_appointments > 0 && (
        <span className="opacity-70">· {customer.total_appointments} visita{customer.total_appointments > 1 ? 's' : ''}</span>
      )}
    </span>
  );
}