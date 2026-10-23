// Painel exibido no detalhe do cliente: mostra a assinatura ativa (se houver),
// permite assinar um plano novo, cancelar, e marcar pagamento como pago/pendente.

import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Check, AlertCircle, Plus, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatUsage } from '@/lib/subscriptions';
import { useToast } from '@/components/ui/use-toast';

// Helper para invocar o BFF de subscription com mensagem de erro humana.
async function invokeSubscriptionMutation(payload) {
  const res = await base44.functions.invoke('mutateSubscription', payload);
  const data = res?.data;
  if (data?.error) {
    const map = {
      ALREADY_SUBSCRIBED: 'Cliente já tem uma assinatura ativa.',
      PLAN_INACTIVE: 'Esse plano está inativo.',
      AUTOMATIC_BILLING_MANAGED: 'Assinatura gerenciada por cobrança automática.',
      NOT_FOUND: 'Não foi possível localizar a assinatura.',
      FORBIDDEN_ROLE: 'Seu perfil não tem permissão para essa ação.',
    };
    throw new Error(map[data.error] || data.error);
  }
  return data;
}

export default function CustomerSubscriptionPanel({ customer, companyId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showPicker, setShowPicker] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
    queryClient.invalidateQueries({ queryKey: ['customer-subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['customer-subscriptions-active'] });
    queryClient.invalidateQueries({
      predicate: (q) => JSON.stringify(q.queryKey).toLowerCase().includes('subscription'),
    });
  };

  const subscribeMutation = useMutation({
    mutationFn: (plan) => invokeSubscriptionMutation({
      action: 'subscribe',
      customer_id: customer.id,
      company_id: companyId,
      plan_id: plan.id,
    }),
    onSuccess: () => {
      setErrorMsg('');
      setShowPicker(false);
      invalidate();
      toast({
        title: 'Assinatura ativada!',
        description: 'O plano foi vinculado ao cliente com sucesso.',
      });
    },
    onError: (err) => setErrorMsg(err?.message || 'Erro ao assinar plano.'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => invokeSubscriptionMutation({
      action: 'cancel',
      subscription_id: activeSub?.id,
      customer_id: customer.id,
      company_id: companyId,
    }),
    onSuccess: () => {
      setErrorMsg('');
      setConfirmingCancel(false);
      // Atualiza otimisticamente o cache local para resposta visual instantânea
      queryClient.setQueryData(['subscription', customer.id], (old = []) =>
        Array.isArray(old)
          ? old.map((s) => (s.status === 'active' ? { ...s, status: 'canceled' } : s))
          : []
      );
      invalidate();
      toast({
        title: 'Assinatura cancelada',
        description: 'A assinatura deste cliente foi encerrada.',
      });
    },
    onError: (err) => setErrorMsg(err?.message || 'Erro ao cancelar assinatura.'),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => invokeSubscriptionMutation({
      action: 'mark_payment',
      subscription_id: activeSub?.id,
      company_id: companyId,
      status: 'pago',
    }),
    onSuccess: () => {
      setErrorMsg('');
      invalidate();
      toast({
        title: 'Pagamento confirmado',
        description: 'O status de pagamento da assinatura foi atualizado.',
      });
    },
    onError: (err) => setErrorMsg(err?.message || 'Erro ao atualizar pagamento.'),
  });

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] backdrop-blur-md p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-[#93C5FD]" />
          <h3 className="font-bold text-white">Assinatura</h3>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-3 p-2.5 rounded-lg bg-rose-500/15 border border-rose-400/30 text-xs text-rose-200 flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-rose-300 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!activeSub ? (
        <div>
          <p className="text-sm text-white/55 mb-3">Cliente não tem assinatura ativa.</p>
          {!showPicker ? (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#93C5FD] hover:text-white transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Assinar a um plano
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white/60">Escolha um plano</span>
                <button
                  type="button"
                  onClick={() => setShowPicker(false)}
                  className="cursor-pointer"
                >
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>
              {plans.length === 0 ? (
                <p className="text-xs text-white/45">Nenhum plano disponível. Crie planos em "Planos".</p>
              ) : plans.map(plan => (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => subscribeMutation.mutate(plan)}
                  disabled={subscribeMutation.isPending}
                  className="w-full text-left p-3 border border-white/10 rounded-lg bg-white/[0.02] hover:border-[#60A5FA]/40 hover:bg-white/[0.05] transition-colors disabled:opacity-50 cursor-pointer"
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
                  type="button"
                  onClick={() => markPaidMutation.mutate()}
                  disabled={markPaidMutation.isPending}
                  className="ml-auto text-[#93C5FD] font-semibold hover:text-white transition-colors cursor-pointer"
                >
                  Marcar como pago
                </button>
              </>
            )}
          </div>

          {!confirmingCancel ? (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              disabled={cancelMutation.isPending}
              className="w-full text-xs font-semibold text-rose-300/90 hover:text-rose-200 py-2.5 rounded-lg border border-rose-500/25 bg-rose-500/10 hover:border-rose-400/40 hover:bg-rose-500/15 transition-colors cursor-pointer"
            >
              Cancelar assinatura
            </button>
          ) : (
            <div className="p-3 rounded-xl border border-rose-400/35 bg-rose-500/10 space-y-2.5">
              <p className="text-xs text-rose-100 font-medium">
                Tem certeza que deseja cancelar a assinatura deste cliente?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  disabled={cancelMutation.isPending}
                  className="flex-1 py-2 px-3 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 transition-colors cursor-pointer"
                >
                  Manter ativa
                </button>
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="flex-1 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {cancelMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Cancelando...</span>
                    </>
                  ) : (
                    <span>Confirmar cancelamento</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}