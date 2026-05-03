import { Edit, Users, Infinity as InfIcon, Check } from 'lucide-react';

export default function PlanCard({ plan, subscribersCount, onEdit, onToggleActive }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-bold text-[#111827] truncate">{plan.name}</h3>
            {!plan.active && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Inativo</span>
            )}
          </div>
          {plan.description && <p className="text-xs text-gray-500 line-clamp-2">{plan.description}</p>}
        </div>
        <button onClick={() => onEdit(plan)} className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0">
          <Edit className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-2xl font-black text-[#111827]">R${plan.price_monthly}</span>
        <span className="text-xs text-gray-500">/mês</span>
      </div>

      <div className="space-y-1.5 mb-4 text-xs">
        <div className="flex items-center gap-1.5 text-gray-600">
          {plan.type === 'unlimited' ? (
            <><InfIcon className="w-3.5 h-3.5" /> Usos ilimitados</>
          ) : (
            <><Check className="w-3.5 h-3.5 text-emerald-500" /> {plan.usage_limit} usos por mês</>
          )}
        </div>
        {plan.rollover && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Check className="w-3.5 h-3.5 text-emerald-500" /> Acumula entre ciclos
          </div>
        )}
        <div className="flex items-center gap-1.5 text-gray-600">
          <Users className="w-3.5 h-3.5" /> {subscribersCount} assinante{subscribersCount === 1 ? '' : 's'}
        </div>
      </div>

      <button
        onClick={() => onToggleActive(plan)}
        className="w-full text-xs font-semibold text-gray-500 hover:text-[#2563EB] py-1.5 rounded-lg border border-black/10 hover:border-[#2563EB]/30 transition-colors"
      >
        {plan.active ? 'Desativar plano' : 'Reativar plano'}
      </button>
    </div>
  );
}