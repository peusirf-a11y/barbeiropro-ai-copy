import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles } from 'lucide-react';

// Badge inline para a tabela de clientes — chama recommendPlanForCustomer.
// Renderiza apenas quando há recomendação válida com economia > 0.
// Cache de 5min para não sobrecarregar.
export default function CustomerPlanRecommendation({ companyId, customerId }) {
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
  if (!r || r.error || !r.recommended_plan || r.no_match || r.no_savings || r.insufficient_data || r.already_subscribed || r.no_plans_available) {
    return null;
  }

  return (
    <div
      className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-50 text-violet-700 px-2 py-1 rounded-md border border-violet-100 max-w-full"
      title={`Vem ${r.visits_per_month}x/mês. Plano "${r.recommended_plan.name}" economiza R$${r.monthly_savings}/mês (R$${r.annual_savings}/ano).`}
    >
      <Sparkles className="w-2.5 h-2.5 flex-shrink-0" />
      <span className="truncate">{r.recommended_plan.name} · –R${r.monthly_savings}/mês</span>
    </div>
  );
}