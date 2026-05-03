// Banner inline para o modal de edição de agendamento.
// Quando o cliente é frequente e elegível para um plano, mostra "Esse cliente
// economizaria R$X" com botão "Oferecer plano agora".
// Faz a chamada apenas uma vez (cache 5min) e renderiza nada se não houver oferta.

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles, ChevronRight } from 'lucide-react';

export default function OfferPlanInlineBanner({ companyId, customerId, onOffer }) {
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
  if (!r || r.error || !r.recommended_plan || r.already_subscribed) return null;

  return (
    <button
      type="button"
      onClick={onOffer}
      className="w-full flex items-center gap-3 mb-4 p-3 rounded-xl bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200 hover:border-violet-400 hover:shadow-sm transition-all text-left group"
    >
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white flex-shrink-0">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Oportunidade</div>
        <div className="text-sm font-bold text-[#111827] truncate">
          Esse cliente economizaria <span className="text-violet-700">R${r.monthly_savings}/mês</span>
        </div>
        <div className="text-[11px] text-gray-500 truncate">
          Vem {r.visits_per_month}x/mês · Plano "{r.recommended_plan.name}" R${r.recommended_plan.price_monthly}
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs font-bold text-violet-700 group-hover:translate-x-0.5 transition-transform flex-shrink-0">
        Oferecer<ChevronRight className="w-4 h-4" />
      </div>
    </button>
  );
}