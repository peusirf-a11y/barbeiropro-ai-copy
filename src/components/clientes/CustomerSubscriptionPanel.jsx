// Painel exibido no detalhe do cliente: mostra a assinatura ativa (se houver),
// permite assinar um plano novo, cancelar, e marcar pagamento como pago/pendente.

import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Check, AlertCircle, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buildInitialSubscription, formatUsage } from '@/lib/subscriptions';

export default function CustomerSubscriptionPanel({ customer, companyId }) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscription', customer.id],
    queryFn: () => base44.entities.CustomerSubscription.filter({ customer_id: customer.id }),
    enabled: !!customer.id,
  });
  const activeSub = subscriptions.find(s => s.status === 'active');

  const { data: plans = [] } = useQuery({
    queryKey: ['customer-plans', companyId],
    queryFn: () => base44.entities.CustomerPlan.filter({ company_id: companyId, active: true }),
    enabled: !!companyId && showPicker,
  });

  const subscribeMutation = useMutation({
    mutationFn: (plan) => base44.entities.CustomerSubscription.create(
      buildInitialSubscription({ companyId, customerId: customer.id, plan })
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions', companyId] });
      setShowPicker(false);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => base44.entities.CustomerSubscription.update(activeSub.id, {
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions', companyId] });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: () => base44.entities.CustomerSubscription.update(activeSub.id, {
      last_payment_status: 'pago',
      last_payment_at: new Date().toISOString(),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscription', customer.id] }),
  });

  return (
    <div className="bg-white rounded-2xl border border-black/5 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-[#2563EB]" />
          <h3 className="font-bold text-[#111827]">Assinatura</h3>
        </div>
      </div>

      {!activeSub ? (
        <div>
          <p className="text-sm text-gray-500 mb-3">Cliente não tem assinatura ativa.</p>
          {!showPicker ? (
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:underline"
            >
              <Plus className="w-4 h-4" /> Assinar a um plano
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">Escolha um plano</span>
                <button onClick={() => setShowPicker(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              {plans.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum plano disponível. Crie planos em "Planos".</p>
              ) : plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => subscribeMutation.mutate(plan)}
                  disabled={subscribeMutation.isPending}
                  className="w-full text-left p-3 border border-black/10 rounded-lg hover:border-[#2563EB] hover:bg-blue-50/50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-[#111827]">{plan.name}</div>
                      <div className="text-xs text-gray-500">
                        {plan.type === 'unlimited' ? 'Ilimitado' : `${plan.usage_limit} usos/mês`}
                      </div>
                    </div>
                    <div className="font-bold text-[#2563EB]">R${plan.price_monthly}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-[#111827]">{activeSub.plan_name_snapshot}</div>
                <div className="text-xs text-gray-500">R${activeSub.plan_price_snapshot}/mês</div>
              </div>
              <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Ativa</span>
            </div>
            <div className="text-sm font-semibold text-[#2563EB] mt-2">{formatUsage(activeSub)}</div>
            {activeSub.current_cycle_end && (
              <div className="text-xs text-gray-500 mt-1">
                Próxima cobrança: {format(new Date(activeSub.current_cycle_end), "d 'de' MMM", { locale: ptBR })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Pagamento:</span>
            {activeSub.last_payment_status === 'pago' ? (
              <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                <Check className="w-3 h-3" /> Pago
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1 text-amber-600 font-semibold">
                  <AlertCircle className="w-3 h-3" /> {activeSub.last_payment_status === 'atrasado' ? 'Atrasado' : 'Pendente'}
                </span>
                <button
                  onClick={() => markPaidMutation.mutate()}
                  className="ml-auto text-[#2563EB] font-semibold hover:underline"
                >
                  Marcar como pago
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => { if (confirm('Cancelar a assinatura deste cliente?')) cancelMutation.mutate(); }}
            className="w-full text-xs font-semibold text-gray-500 hover:text-red-600 py-2 rounded-lg border border-black/10 hover:border-red-200"
          >
            Cancelar assinatura
          </button>
        </div>
      )}
    </div>
  );
}