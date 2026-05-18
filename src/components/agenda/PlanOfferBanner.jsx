// Banner discreto na agenda — aparece dentro do EditAppointmentModal quando o cliente
// é frequente e não tem plano. Reutiliza recommendPlanForCustomer (cache 5min).

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles, TrendingDown } from 'lucide-react';

export default function PlanOfferBanner({ companyId, customerId, customerName, onOffer }) {
  const { data, isLoading } = useQuery({
    queryKey: ['plan-rec', companyId, customerId],
    queryFn: () => base44.functions.invoke('recommendPlanForCustomer', {
      company_id: companyId, customer_id: customerId,
    }),
    enabled: !!companyId && !!customerId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) return null;
  const r = data?.data;
  if (!r || r.error || !r.recommended_plan || r.no_match || r.no_savings || r.insufficient_data || r.already_subscribed || r.no_plans_available) {
    return null;
  }

  return (
    <div className="relative bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-400/30 rounded-xl p-3 mb-4 backdrop-blur-sm overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent pointer-events-none" />
      <div className="relative flex items-start gap-2.5">
        <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white flex-shrink-0 ring-1 ring-white/15">
          <span className="absolute inset-0 rounded-lg bg-fuchsia-400/40 blur-sm opacity-60" aria-hidden="true" />
          <Sparkles className="relative w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-violet-200 mb-0.5">Cliente frequente</div>
          <div className="text-sm font-semibold text-white leading-tight">
            Vem <strong>{r.visits_per_month}x/mês</strong>. Economizaria{' '}
            <span className="inline-flex items-center gap-0.5 text-emerald-300">
              <TrendingDown className="w-3 h-3" />
              R${r.monthly_savings}/mês
            </span>{' '}
            com o <strong>{r.recommended_plan.name}</strong>.
          </div>
          <button
            onClick={onOffer}
            className="mt-2 text-xs font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-3 py-1.5 rounded-lg hover:brightness-110 shadow-[0_8px_24px_rgba(168,85,247,0.35)] ring-1 ring-white/15 transition-all"
          >
            👉 Oferecer plano agora
          </button>
        </div>
      </div>
    </div>
  );
}