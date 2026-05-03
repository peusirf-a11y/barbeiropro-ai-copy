// Modal de oferta de plano — usado tanto na tela de Clientes quanto na Agenda.
// Mostra plano sugerido, economia mensal/anual, benefícios e ativa a assinatura
// ao clicar em "Ativar assinatura". Reutiliza a lógica de buildInitialSubscription.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Sparkles, Check, TrendingDown, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { buildInitialSubscription } from '@/lib/subscriptions';

export default function OfferPlanModal({ companyId, customer, onClose, onActivated }) {
  const queryClient = useQueryClient();

  const { data: recData, isLoading } = useQuery({
    queryKey: ['plan-rec', companyId, customer?.id],
    queryFn: () => base44.functions.invoke('recommendPlanForCustomer', {
      company_id: companyId, customer_id: customer.id,
    }),
    enabled: !!companyId && !!customer?.id,
    staleTime: 5 * 60 * 1000,
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const planId = recData?.data?.recommended_plan?.id;
      if (!planId) throw new Error('Plano não encontrado');
      const plans = await base44.entities.CustomerPlan.filter({ id: planId });
      const plan = plans[0];
      if (!plan) throw new Error('Plano não encontrado');
      return base44.entities.CustomerSubscription.create(
        buildInitialSubscription({ companyId, customerId: customer.id, plan })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['plan-rec', companyId, customer.id] });
      onActivated?.();
      onClose();
    },
  });

  const r = recData?.data;
  const plan = r?.recommended_plan;
  const noOffer = !isLoading && (!r || r.no_match || r.no_savings || r.insufficient_data || r.already_subscribed || r.no_plans_available);

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="relative bg-[#2563EB] p-6 text-white">
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 hover:bg-white/20 rounded-lg">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider opacity-90">Oferta inteligente</span>
          </div>
          <h3 className="text-2xl font-black">Oferecer plano para {customer?.name?.split(' ')[0]}</h3>
        </div>

        {/* Body */}
        <div className="p-6">
          {isLoading && (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Analisando histórico do cliente…</p>
            </div>
          )}

          {!isLoading && noOffer && (
            <div className="text-center py-6">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="font-semibold text-[#111827] mb-1">Sem recomendação no momento</p>
              <p className="text-xs text-gray-500">
                {r?.already_subscribed && 'Cliente já tem plano ativo.'}
                {r?.no_plans_available && 'Crie planos ativos primeiro.'}
                {r?.insufficient_data && `Histórico insuficiente (${r.visits_in_window || 0} visita${(r.visits_in_window || 0) === 1 ? '' : 's'} em 180 dias).`}
                {(r?.no_match || r?.no_savings) && 'Nenhum plano vigente economiza para este cliente.'}
              </p>
              <button onClick={onClose} className="mt-4 px-4 py-2 border border-black/10 rounded-lg text-sm font-semibold hover:bg-gray-50">Fechar</button>
            </div>
          )}

          {!isLoading && plan && (
            <>
              {/* Card do plano */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] mb-1">Plano sugerido</div>
                    <div className="font-black text-xl text-[#111827]">{plan.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {plan.type === 'unlimited' ? 'Cortes ilimitados' : `${plan.usage_limit} ${plan.usage_limit === 1 ? 'corte' : 'cortes'} por mês`}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-black text-[#2563EB]">R${plan.price_monthly}</div>
                    <div className="text-[10px] text-[#2563EB]/70 uppercase">por mês</div>
                  </div>
                </div>
              </div>

              {/* Economia */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                    <TrendingDown className="w-3 h-3" /> Economia/mês
                  </div>
                  <div className="text-xl font-black text-emerald-700">R${r.monthly_savings}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                    <TrendingDown className="w-3 h-3" /> Economia/ano
                  </div>
                  <div className="text-xl font-black text-emerald-700">R${r.annual_savings}</div>
                </div>
              </div>

              {/* Padrão de uso */}
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-4 text-xs text-blue-900">
                <Calendar className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span>
                  Esse cliente vem <strong>{r.visits_per_month}x/mês</strong> · gasta cerca de <strong>R${r.monthly_avulso}/mês</strong> em avulso
                </span>
              </div>

              {/* Benefícios */}
              <div className="mb-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Benefícios para o cliente</div>
                <ul className="space-y-1.5 text-sm text-[#111827]">
                  <Benefit text={`Economiza R$${r.monthly_savings} todo mês`} />
                  <Benefit text="Hora marcada garantida" />
                  <Benefit text="Sem se preocupar com o pagamento a cada visita" />
                  {plan.type === 'unlimited' && <Benefit text="Cortes ilimitados — venha quantas vezes quiser" />}
                </ul>
              </div>

              {subscribeMutation.error && (
                <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                  {subscribeMutation.error?.message || 'Erro ao ativar assinatura.'}
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-3 border border-black/10 rounded-xl text-sm font-semibold hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  onClick={() => subscribeMutation.mutate()}
                  disabled={subscribeMutation.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl text-sm font-bold disabled:opacity-50 shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition-colors"
                >
                  {subscribeMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Ativando…</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Ativar assinatura</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Benefit({ text }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </li>
  );
}