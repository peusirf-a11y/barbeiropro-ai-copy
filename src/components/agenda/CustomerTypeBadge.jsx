// Badge de classificação de cliente — combina:
// 1) Camada manual (VIP) — sempre tem prioridade visual quando ativa
// 2) Camada automática (lifecycle_status) — calculada por lib/customerLifecycle
//
// Para clientes legados que ainda não foram classificados (lifecycle_status vazio),
// faz fallback baseado em total_appointments (mantém compatibilidade visual).

import { Sparkles } from 'lucide-react';
import { getLifecycleToken } from '@/lib/customerLifecycle';

const VIP_TOKEN = {
  key: 'vip',
  label: 'VIP',
  icon: '👑',
  badge: 'bg-amber-100 text-amber-800 border-amber-300',
};

// Mantida para compat com chamadas antigas (ex: AgendaAppointmentCard).
// Retorna apenas o tipo "principal" (vip > lifecycle).
export function getCustomerType(customer) {
  if (!customer) return 'primeira_visita';
  if (customer.status === 'vip') return 'vip';
  if (customer.lifecycle_status) return customer.lifecycle_status;
  // Fallback para clientes antigos
  if (customer.status === 'inactive') return 'inativo';
  const total = Number(customer.total_appointments) || 0;
  if (total === 0) return 'primeira_visita';
  if (total >= 5) return 'fiel';
  return null;
}

export default function CustomerTypeBadge({ customer, showVisits = true }) {
  if (!customer) return null;

  const isVip = customer.status === 'vip';
  const lifecycle = customer.lifecycle_status
    ? getLifecycleToken(customer.lifecycle_status)
    : null;

  // VIP tem precedência — quando o cliente é VIP, mostramos o selo VIP
  // e (opcionalmente) o lifecycle ao lado como contexto.
  if (isVip) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${VIP_TOKEN.badge}`}>
          <span>{VIP_TOKEN.icon}</span>{VIP_TOKEN.label}
        </span>
        {lifecycle && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${lifecycle.badge} opacity-80`}>
            <span>{lifecycle.icon}</span>{lifecycle.label}
          </span>
        )}
      </span>
    );
  }

  // Fallback para cliente novo sem nenhuma classificação
  const t = lifecycle || getLifecycleToken('primeira_visita');
  const total = Number(customer.total_appointments) || 0;
  const isFirst = t.key === 'primeira_visita';

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${t.badge}`}>
      {isFirst ? <Sparkles className="w-3 h-3" strokeWidth={2.5} /> : <span>{t.icon}</span>}
      {t.label}
      {showVisits && total > 0 && (
        <span className="opacity-70">· {total} visita{total > 1 ? 's' : ''}</span>
      )}
    </span>
  );
}