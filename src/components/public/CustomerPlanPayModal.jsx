// Modal de pagamento de plano com cartão (tokenização nativa Asaas).
// Substitui o redirect para invoiceUrl. Usado quando o cliente tem uma
// CustomerSubscription com status 'pending_payment' no CustomerDashboard.

import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CardPaymentFormAsaas from '@/components/booking/CardPaymentFormAsaas';

export default function CustomerPlanPayModal({
  isOpen, onClose, onPaid,
  companyId, token, subscription, primaryColor, customer,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen || !subscription) return null;

  const handleSubmit = async (card) => {
    const res = await base44.functions.invoke('chargeCustomerPlanWithCard', {
      company_id: companyId,
      token,
      plan_id: subscription.plan_id,
      subscription_id: subscription.id,
      card,
    });
    const data = res?.data;
    if (data?.error || !data?.success) {
      throw new Error(data?.message || data?.error || 'Falha ao processar o pagamento.');
    }
    onPaid?.(data);
  };

  const priceLabel = `Pagar R$ ${Number(subscription.plan_price_snapshot || 0).toFixed(2).replace('.', ',')}`;

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
              <h3 className="font-black text-[#111827] text-base">Pagar plano</h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {subscription.plan_name_snapshot} · R$ {Number(subscription.plan_price_snapshot || 0).toFixed(2)}/mês
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
                Após confirmação, seu plano é ativado <strong>na hora</strong>. Próximas cobranças automáticas todo mês.
              </p>
            </div>

            <CardPaymentFormAsaas
              onSubmit={handleSubmit}
              primaryColor={primaryColor}
              amountLabel={priceLabel}
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