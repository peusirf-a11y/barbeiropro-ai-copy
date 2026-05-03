import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles } from 'lucide-react';

// Badge inline + botão "Oferecer plano" para a tabela de clientes.
// Quando onOffer é passado, vira clicável e dispara o modal de oferta no parent.
// Renderiza apenas quando há recomendação válida com economia > 0.
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
  if (!r || r.error || !r.recommended_plan || r.no_match || r.no_savings || r.insufficient_data || r.already_subscribed || r.no_plans_available) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1.5 max-w-full flex-wrap">
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-[#2563EB] px-2 py-1 rounded-md border border-blue-100"
        title={`Vem ${r.visits_per_month}x/mês. Plano "${r.recommended_plan.name}" economiza R$${r.monthly_savings}/mês (R$${r.annual_savings}/ano).`}
      >
        <Sparkles className="w-2.5 h-2.5 flex-shrink-0" />
        <span className="truncate">{r.recommended_plan.name} · –R${r.monthly_savings}/mês</span>
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