// Banner inline para o modal de edição de agendamento.
// Usa a engine central de elegibilidade — exibe para TODOS os tipos:
// economy (economiza R$X), retention (cliente recorrente), premium, churn_prevention.
// Renderiza nada se o backend não retornar plano recomendado.

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sparkles, ChevronRight } from 'lucide-react';

// Copy comercial por tipo de recomendação
function getBannerCopy(r) {
  const planName = r.recommended_plan?.name || 'plano';
  const savings  = r.monthly_savings || 0;
  const visits   = r.visits_per_month || 0;
  const type     = r.recommendation_type || 'retention';

  if (type === 'economy' && savings > 0) {
    return {
      label: 'Oportunidade',
      title: `Esse cliente economizaria R$${savings}/mês`,
      sub:   `Vem ${visits}x/mês · Plano "${planName}" R$${r.recommended_plan.price_monthly}`,
    };
  }
  if (type === 'premium') {
    return {
      label: 'Cliente Premium',
      title: `Potencial VIP — fidelizar com "${planName}"`,
      sub:   `Ticket alto · Vem ${visits}x/mês · R$${r.recommended_plan.price_monthly}/mês`,
    };
  }
  if (type === 'churn_prevention') {
    return {
      label: 'Reter agora',
      title: `Oferecer plano para garantir recorrência`,
      sub:   `Vem ${visits}x/mês · Plano "${planName}" R$${r.recommended_plan.price_monthly}`,
    };
  }
  // retention (default)
  return {
    label: 'Fidelização',
    title: `Cliente recorrente — elegível para "${planName}"`,
    sub:   `Vem ${visits}x/mês · R$${r.recommended_plan.price_monthly}/mês`,
  };
}

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

  // Oculta apenas quando o backend confirma que não há oferta válida
  if (!r || r.error || !r.recommended_plan || r.already_subscribed) return null;

  const copy = getBannerCopy(r);

  return (
    <button
      type="button"
      onClick={onOffer}
      className="w-full flex items-center gap-3 mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-400/30 hover:border-blue-400/60 hover:bg-blue-500/15 backdrop-blur-sm transition-all text-left group"
    >
      <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] flex items-center justify-center text-white flex-shrink-0 ring-1 ring-white/15">
        <span className="absolute inset-0 rounded-lg bg-[#60A5FA]/40 blur-sm opacity-60" aria-hidden="true" />
        <Sparkles className="relative w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#93C5FD]">{copy.label}</div>
        <div className="text-sm font-bold text-white truncate">{copy.title}</div>
        <div className="text-[11px] text-white/55 truncate">{copy.sub}</div>
      </div>
      <div className="flex items-center gap-1 text-xs font-bold text-[#93C5FD] group-hover:translate-x-0.5 transition-transform flex-shrink-0">
        Oferecer<ChevronRight className="w-4 h-4" />
      </div>
    </button>
  );
}