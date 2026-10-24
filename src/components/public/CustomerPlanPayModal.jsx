// Modal de assinatura recorrente de plano com cartão de crédito (Asaas /v3/subscriptions).
// Usado tanto ao selecionar um plano em /cliente/:slug/planos quanto no painel do cliente.

import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CardPaymentFormAsaas from '@/components/booking/CardPaymentFormAsaas';

export default function CustomerPlanPayModal({
  isOpen,
  onClose,
  onPaid,
  companyId,
  token,
  plan,
  subscription,
  primaryColor,
  customer,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const targetPlan = plan || subscription;
  if (!isOpen || !targetPlan) return null;

  const resolvedPlanId = plan?.id || subscription?.plan_id;
  const resolvedPlanName =
    plan?.name ||
    subscription?.plan_name ||
    subscription?.plan_name_snapshot ||
    'Plano Mensal';
  const resolvedPlanPrice = Number(
    plan?.price_monthly ?? plan?.price ?? subscription?.plan_price_snapshot ?? 0
  );

  const handleSubmit = async (card) => {
    const res = await base44.functions.invoke('chargeCustomerPlanWithCard', {
      company_id: companyId,
      token,
      customer_id: customer?.id || subscription?.customer_id || null,
      plan_id: resolvedPlanId,
      plan_name: resolvedPlanName,
      plan_price: resolvedPlanPrice,
      subscription_id: subscription?.id || null,
      card,
    });
    const data = res?.data;
    if (data?.error || !data?.success) {
      throw new Error(data?.message || data?.error || 'Falha ao autorizar a assinatura no cartão.');
    }
    onPaid?.(data);
  };

  const priceLabel = `Assinar R$ ${resolvedPlanPrice.toFixed(2).replace('.', ',')}/mês`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl"
        >
          {/* Handle bar (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-black/15" />
          </div>

          <div className="flex items-start justify-between px-5 py-3 border-b border-black/5">
            <div>
              <h3 className="font-black text-[#111827] text-base">Assinar plano no cartão</h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {resolvedPlanName} · R$ {resolvedPlanPrice.toFixed(2).replace('.', ',')}/mês
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 modal-scroll">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-emerald-900 leading-relaxed">
                Assinatura recorrente no cartão de crédito. Seu plano é ativado <strong>na hora</strong> e renova automaticamente a cada 30 dias.
              </p>
            </div>

            <CardPaymentFormAsaas
              onSubmit={handleSubmit}
              primaryColor={primaryColor}
              amountLabel={priceLabel}
              defaultCpf={customer?.cpf || ''}
              defaultName={customer?.name || ''}
              defaultEmail={customer?.email || ''}
              defaultPhone={customer?.phone || ''}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}