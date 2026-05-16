import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getBadgeContent } from '@/lib/subscriptionEligibility';
import { Sparkles } from 'lucide-react';

// Badge inline + botão "Oferecer plano" para a tabela de clientes.
// Elegibilidade e copy gerenciados pela engine central (lib/subscriptionEligibility.js).
// Renderiza sempre que o servidor retorna um plano recomendado — sem filtros extras no frontend.
export default function CustomerPlanRecommendation({ companyId, customerId, onOffer }) {
  const { data, isLoading } = useQuery({
    queryKey: ['plan-rec', companyId, customerId],
    queryFn: () => base44.functions.invoke('recommendPlanForCustomer', {
      company_id: companyId, customer_id: customerId,
    }),
    enabled: !!companyId && !!customerId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) return <span className="text-[10px] text-gray-300">…</span>;
  const r = data?.data;

  // Oculta apenas quando o servidor diz que não é elegível
  if (!r || r.error || !r.recommended_plan || r.insufficient_data || r.already_subscribed || r.no_plans_available || r.no_match) {
    return null;
  }

  // Constrói badge e tooltip via engine central
  const { label, tooltip } = getBadgeContent({
    recommendation_type: r.recommendation_type || 'retention',
    monthly_savings:     r.monthly_savings || 0,
    monthly_visits:      r.visits_per_month || 0,
    recommended_plan:    r.recommended_plan,
  });

  return (
    <div className="inline-flex items-center gap-1.5 max-w-full flex-wrap">
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-[#2563EB] px-2 py-1 rounded-md border border-blue-100"
        title={tooltip}
      >
        <Sparkles className="w-2.5 h-2.5 flex-shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      {onOffer && (
        <button
          onClick={(e) => { e.stopPropagation(); onOffer(); }}
          className="text-[10px] font-bold bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-2 py-1 rounded-md transition-colors"
        >
          Oferecer plano
        </button>
      )}
    </div>
  );
}