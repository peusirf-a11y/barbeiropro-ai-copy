// Painel exibido no detalhe do cliente: mostra a assinatura ativa (se houver),
// permite assinar um plano novo, cancelar, e marcar pagamento como pago/pendente.

import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Check, AlertCircle, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatUsage } from '@/lib/subscriptions';

// Helper para invocar o BFF de subscription com mensagem de erro humana.
async function invokeSubscriptionMutation(payload) {
  const res = await base44.functions.invoke('mutateSubscription', payload);
  const data = res?.data;
  if (data?.error) {
    const map = {
      ALREADY_SUBSCRIBED: 'Cliente já tem uma assinatura ativa.',
      PLAN_INACTIVE: 'Esse plano está inativo.',
      STRIPE_MANAGED_USE_PORTAL: 'Assinatura gerenciada pela Stripe — peça pro cliente cancelar pelo portal.',
      NOT_FOUND: 'Não foi possível localizar a assinatura.',
      FORBIDDEN_ROLE: 'Seu perfil não tem permissão para essa ação.',
    };
    throw new Error(map[data.error] || data.error);
  }
  return data;
}

export default function CustomerSubscriptionPanel({ customer, companyId }) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);

  // Subscriptions via BFF Fase 4 (listSubscriptions).
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscription', customer.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('listSubscriptions', { customer_id: customer.id });
      return res?.data?.subscriptions || [];
    },
    enabled: !!customer.id,
  });
  const activeSub = subscriptions.find(s => s.status === 'active');

  // Planos da barbearia (CustomerPlan ainda direto — não é tenant-sensitive cross-leak;
  // já filtra por company_id e é read-only no painel).
  const { data: plans = [] } = useQuery({
    queryKey: ['customer-plans', companyId],
    queryFn: () => base44.entities.CustomerPlan.filter({ company_id: companyId, active: true }),
    enabled: !!companyId && showPicker,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['subscription', customer.id] });
    queryClient.invalidateQueries({ queryKey: ['customer-subscriptions', companyId] });
    queryClient.invalidateQueries({ queryKey: ['customer-subscriptions-active', companyId] });
  };

  const subscribeMutation = useMutation({
    mutationFn: (plan) => invokeSubscriptionMutation({
      action: 'subscribe',
      customer_id: customer.id,
      plan_id: plan.id,
    }),
    onSuccess: () => { invalidate(); setShowPicker(false); },
    onError: (err) => alert(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => invokeSubscriptionMutation({
      action: 'cancel',
      subscription_id: activeSub.id,
    }),
    onSuccess: () => invalidate(),
    onError: (err) => alert(err.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => invokeSubscriptionMutation({
      action: 'mark_payment',
      subscription_id: activeSub.id,
      status: 'pago',
    }),
    onSuccess: () => invalidate(),
    onError: (err) => alert(err.message),
  });

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-[#93C5FD]" />
          <h3 className="font-bold text-white">Assinatura</h3>
        </div>
      </div>

      {!activeSub ? (
        <div>
          <p className="text-sm text-white/55 mb-3">Cliente não tem assinatura ativa.</p>
          {!showPicker ? (
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#93C5FD] hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" /> Assinar a um plano
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white/60">Escolha um plano</span>
                <button onClick={() => setShowPicker(false)}><X className="w-4 h-4 text-white/50" /></button>
              </div>
              {plans.length === 0 ? (
                <p className="text-xs text-white/45">Nenhum plano disponível. Crie planos em "Planos".</p>
              ) : plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => subscribeMutation.mutate(plan)}
                  disabled={subscribeMutation.isPending}
                  className="w-full text-left p-3 border border-white/10 rounded-lg bg-white/[0.02] hover:border-[#60A5FA]/40 hover:bg-white/[0.05] transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-white">{plan.name}</div>
                      <div className="text-xs text-white/55">
                        {plan.type === 'unlimited' ? 'Ilimitado' : `${plan.usage_limit} usos/mês`}
                      </div>
                    </div>
                    <div className="font-bold text-[#93C5FD]">R${plan.price_monthly}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl p-4 border border-blue-400/25 bg-blue-500/10">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-white">{activeSub.plan_name_snapshot}</div>
                <div className="text-xs text-white/60">R${activeSub.plan_price_snapshot}/mês</div>
              </div>
              <span className="text-[10px] font-bold uppercase bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full">Ativa</span>
            </div>
            <div className="text-sm font-semibold text-[#93C5FD] mt-2">{formatUsage(activeSub)}</div>
            {activeSub.current_cycle_end && (
              <div className="text-xs text-white/55 mt-1">
                Próxima cobrança: {format(new Date(activeSub.current_cycle_end), "d 'de' MMM", { locale: ptBR })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/55">Pagamento:</span>
            {activeSub.last_payment_status === 'pago' ? (
              <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                <Check className="w-3 h-3" /> Pago
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1 text-amber-300 font-semibold">
                  <AlertCircle className="w-3 h-3" /> {activeSub.last_payment_status === 'atrasado' ? 'Atrasado' : 'Pendente'}
                </span>
                <button
                  onClick={() => markPaidMutation.mutate()}
                  className="ml-auto text-[#93C5FD] font-semibold hover:text-white transition-colors"
                >
                  Marcar como pago
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => { if (confirm('Cancelar a assinatura deste cliente?')) cancelMutation.mutate(); }}
            className="w-full text-xs font-semibold text-white/60 hover:text-rose-300 py-2 rounded-lg border border-white/10 hover:border-rose-400/30 hover:bg-rose-500/5 transition-colors"
          >
            Cancelar assinatura
          </button>
        </div>
      )}
    </div>
  );
}