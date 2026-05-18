import { Edit, Users, Infinity as InfIcon, Check } from 'lucide-react';

export default function PlanCard({ plan, subscribersCount, onEdit, onToggleActive }) {
  return (
    <div className="group relative rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5 hover:border-[#60A5FA]/30 hover:bg-white/[0.04] transition-all duration-300 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.05] to-transparent pointer-events-none" />
      <div className="relative flex items-start justify-between mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-bold text-white truncate">{plan.name}</h3>
            {!plan.active && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-white/10 text-white/60 border border-white/15 px-2 py-0.5 rounded-full">Inativo</span>
            )}
          </div>
          {plan.description && <p className="text-xs text-white/55 line-clamp-2">{plan.description}</p>}
        </div>
        <button onClick={() => onEdit(plan)} className="p-2 hover:bg-white/10 rounded-lg flex-shrink-0 transition-colors">
          <Edit className="w-4 h-4 text-white/55 hover:text-[#93C5FD]" />
        </button>
      </div>

      <div className="relative flex items-baseline gap-1 mb-4">
        <span className="text-2xl font-black bg-gradient-to-b from-white to-[#93C5FD] bg-clip-text text-transparent">R${plan.price_monthly}</span>
        <span className="text-xs text-white/50">/mês</span>
      </div>

      <div className="relative space-y-1.5 mb-4 text-xs">
        <div className="flex items-center gap-1.5 text-white/70">
          {plan.type === 'unlimited' ? (
            <><InfIcon className="w-3.5 h-3.5 text-[#93C5FD]" /> Usos ilimitados</>
          ) : (
            <><Check className="w-3.5 h-3.5 text-emerald-300" /> {plan.usage_limit} usos por mês</>
          )}
        </div>
        {plan.rollover && (
          <div className="flex items-center gap-1.5 text-white/70">
            <Check className="w-3.5 h-3.5 text-emerald-300" /> Acumula entre ciclos
          </div>
        )}
        <div className="flex items-center gap-1.5 text-white/70">
          <Users className="w-3.5 h-3.5 text-white/50" /> {subscribersCount} assinante{subscribersCount === 1 ? '' : 's'}
        </div>
      </div>

      <button
        onClick={() => onToggleActive(plan)}
        className="relative w-full text-xs font-semibold text-white/60 hover:text-[#93C5FD] py-1.5 rounded-lg border border-white/10 hover:border-[#60A5FA]/40 hover:bg-white/[0.04] transition-all"
      >
        {plan.active ? 'Desativar plano' : 'Reativar plano'}
      </button>
    </div>
  );
}