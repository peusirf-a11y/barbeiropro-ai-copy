// Banner de aviso para a barbearia: lista assinaturas que clientes
// criaram pelo link público (status=pending_payment) e ainda aguardam
// confirmação de pagamento. Permite confirmar/cancelar direto no banner
// e abrir WhatsApp pré-preenchido para combinar o pagamento.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, MessageCircle, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PendingSubscriptionsBanner({ companyId, companyName }) {
  const queryClient = useQueryClient();

  const { data: pendingSubs = [] } = useQuery({
    queryKey: ['pending-subscriptions', companyId],
    queryFn: () => base44.entities.CustomerSubscription.filter({
      company_id: companyId,
      status: 'pending_payment',
    }, '-created_date', 50),
    enabled: !!companyId,
    refetchInterval: 60_000, // recheca de minuto em minuto
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: () => base44.entities.Customer.filter({ company_id: companyId }, '-created_date', 1000),
    enabled: !!companyId && pendingSubs.length > 0,
  });
  const customerById = customers.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

  const confirmMutation = useMutation({
    mutationFn: (sub) => base44.entities.CustomerSubscription.update(sub.id, {
      status: 'active',
      last_payment_status: 'pago',
      last_payment_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-subscriptions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions-active', companyId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (sub) => base44.entities.CustomerSubscription.update(sub.id, {
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-subscriptions', companyId] });
    },
  });

  if (pendingSubs.length === 0) return null;

  const openWhatsApp = (customer, sub) => {
    const phone = (customer?.phone || '').replace(/\D/g, '');
    if (!phone) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    const msg = encodeURIComponent(
      `Olá, ${customer.name?.split(' ')[0] || ''}! Aqui é da ${companyName || 'barbearia'}. ` +
      `Vi que você assinou o plano *${sub.plan_name_snapshot}* (R$${sub.plan_price_snapshot}/mês). ` +
      `Vamos combinar o pagamento? 💈`
    );
    const wa = phone.length === 11 || phone.length === 10 ? `55${phone}` : phone;
    window.open(`https://wa.me/${wa}?text=${msg}`, '_blank');
  };

  return (
    <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-sm animate-fade-in">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-amber-900 text-base sm:text-lg">
            {pendingSubs.length} {pendingSubs.length === 1 ? 'assinatura aguardando' : 'assinaturas aguardando'} pagamento
          </h3>
          <p className="text-xs sm:text-sm text-amber-800/90 mt-0.5">
            {pendingSubs.length === 1 ? 'Um cliente assinou' : 'Clientes assinaram'} um plano pelo link público. Entre em contato para confirmar o pagamento.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {pendingSubs.map(sub => {
          const customer = customerById[sub.customer_id];
          const created = sub.created_date ? new Date(sub.created_date) : null;
          return (
            <div key={sub.id} className="bg-white border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-[#111827] truncate">
                  {customer?.name || 'Cliente'}
                  <span className="ml-2 text-xs font-normal text-gray-500">{customer?.phone || ''}</span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  <strong className="text-[#2563EB]">{sub.plan_name_snapshot}</strong>
                  {' · '}R${sub.plan_price_snapshot}/mês
                  {created && <span className="text-gray-400"> · pedido em {format(created, "d MMM 'às' HH:mm", { locale: ptBR })}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => openWhatsApp(customer, sub)}
                  className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                  title="Abrir WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button
                  onClick={() => confirmMutation.mutate(sub)}
                  disabled={confirmMutation.isPending}
                  className="inline-flex items-center gap-1 text-xs font-bold bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  title="Confirmar pagamento e ativar assinatura"
                >
                  <Check className="w-3.5 h-3.5" /> Confirmar
                </button>
                <button
                  onClick={() => { if (confirm('Cancelar este pedido de assinatura?')) cancelMutation.mutate(sub); }}
                  disabled={cancelMutation.isPending}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Cancelar pedido"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}