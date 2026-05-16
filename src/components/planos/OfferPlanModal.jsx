// Modal de oferta de plano — reutilizável (tela de cliente, agenda, dashboard).
// Mostra: plano sugerido + economia mensal/anual + benefícios + botão "Ativar assinatura".
// Faz a busca da recomendação se ainda não veio pronta.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Sparkles, Check, TrendingDown, Calendar, Loader2 } from 'lucide-react';
import { buildInitialSubscription } from '@/lib/subscriptions';

export default function OfferPlanModal({ companyId, customer, onClose, onSubscribed }) {
  const queryClient = useQueryClient();
  const [activated, setActivated] = useState(false);

  const { data: recRes, isLoading } = useQuery({
    queryKey: ['plan-rec', companyId, customer.id],
    queryFn: () => base44.functions.invoke('recommendPlanForCustomer', {
      company_id: companyId, customer_id: customer.id,
    }),
    enabled: !!companyId && !!customer.id,
    staleTime: 5 * 60 * 1000,
  });

  // Carrega plano completo (precisamos do objeto inteiro p/ buildInitialSubscription)
  const recommendedPlanId = recRes?.data?.recommended_plan?.id;
  const { data: fullPlan } = useQuery({
    queryKey: ['customer-plan', recommendedPlanId],
    queryFn: async () => {
      const list = await base44.entities.CustomerPlan.filter({ id: recommendedPlanId });
      return list[0];
    },
    enabled: !!recommendedPlanId,
  });

  const subscribeMutation = useMutation({
    mutationFn: (plan) => base44.entities.CustomerSubscription.create(
      buildInitialSubscription({ companyId, customerId: customer.id, plan })
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['plan-rec', companyId, customer.id] });
      setActivated(true);
      onSubscribed?.();
    },
  });

  const r = recRes?.data;
  const plan = r?.recommended_plan;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="relative bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-t-2xl p-5 text-white">
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wide">Oferecer plano</span>
          </div>
          <h3 className="text-lg font-black">{customer.name}</h3>
        </div>

        <div className="p-6">
          {isLoading && (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Calculando recomendação...</p>
            </div>
          )}

          {!isLoading && activated && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-emerald-600" />
              </div>
              <h4 className="font-black text-lg text-[#111827] mb-1">Assinatura ativada!</h4>
              <p className="text-sm text-gray-500 mb-5">
                {customer.name} agora é assinante do <strong>{plan?.name}</strong>.
              </p>
              <button onClick={onClose} className="px-6 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8]">
                Concluir
              </button>
            </div>
          )}

          {!isLoading && !activated && r?.no_plans_available && (
            <EmptyState message="Nenhum plano ativo. Crie um plano em Planos antes de oferecer." onClose={onClose} />
          )}
          {!isLoading && !activated && r?.insufficient_data && (
            <EmptyState message="Histórico curto demais para recomendar um plano (mínimo de 2 visitas concluídas)." onClose={onClose} />
          )}
          {!isLoading && !activated && r?.already_subscribed && (
            <EmptyState message={`Cliente já assina: ${r.current_plan_name}`} onClose={onClose} />
          )}
          {!isLoading && !activated && (r?.no_match || r?.no_savings) && (
            <EmptyState message="Nenhum plano vigente gera economia para esse cliente. Considere criar planos mais alinhados ao perfil dele." onClose={onClose} />
          )}

          {!isLoading && !activated && plan && (
            <>
              {/* Cliente vem X vezes */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 mb-4 text-center">
                <div className="text-[11px] text-violet-700 uppercase tracking-wide font-bold mb-0.5">Histórico do cliente</div>
                <div className="text-sm text-violet-900">
                  <strong>{r.visits_per_month}x/mês</strong> em média · Gasta hoje <strong>R${r.monthly_avulso}/mês</strong>
                </div>
              </div>

              {/* Card do plano */}
              <div className="border-2 border-violet-300 rounded-2xl p-5 mb-4 bg-gradient-to-br from-white to-violet-50/30">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-violet-600 mb-0.5">Plano recomendado</div>
                    <div className="text-xl font-black text-[#111827]">{plan.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {plan.type === 'unlimited' ? 'Cortes ilimitados' : `${plan.usage_limit} usos por mês`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-violet-700">R${plan.price_monthly}</div>
                    <div className="text-[10px] uppercase text-gray-400">por mês</div>
                  </div>
                </div>

                {/* Economia */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
                  <TrendingDown className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-emerald-900">Economiza R${r.monthly_savings}/mês</div>
                    <div className="text-xs text-emerald-700">R${r.annual_savings} por ano</div>
                  </div>
                </div>
              </div>

              {/* Benefícios */}
              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Benefícios para o cliente</div>
                <ul className="space-y-1.5 text-sm text-gray-700">
                  <Benefit text={`Economiza R$${r.monthly_savings} todo mês`} />
                  <Benefit text="Prioridade no agendamento" />
                  <Benefit text="Nunca paga avulso enquanto for assinante" />
                  <Benefit text="Receita previsível para a barbearia" />
                </ul>
              </div>

              {/* Ações */}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border border-black/10 rounded-xl text-sm font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => fullPlan && subscribeMutation.mutate(fullPlan)}
                  disabled={!fullPlan || subscribeMutation.isPending}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow-[0_4px_12px_rgba(139,92,246,0.3)]"
                >
                  {subscribeMutation.isPending ? 'Ativando…' : 'Ativar assinatura'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 text-center mt-2">
                A cobrança recorrente é manual por enquanto. O sistema controla os usos automaticamente.
              </p>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function Benefit({ text }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </li>
  );
}

function EmptyState({ message, onClose }) {
  return (
    <div className="text-center py-6">
      <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-600 mb-4">{message}</p>
      <button onClick={onClose} className="px-5 py-2 border border-black/10 rounded-lg text-sm font-medium hover:bg-gray-50">
        Fechar
      </button>
    </div>
  );
}