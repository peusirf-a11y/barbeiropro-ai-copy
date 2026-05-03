// Modal exibido após criar agendamento para cliente com assinatura ativa.
// Pergunta se deve usar o plano (consume) ou cobrar avulso. Idempotente:
// pode ser fechado sem efeito colateral — só age se usuário clicar em "Usar plano".

import { Package, X } from 'lucide-react';
import { formatUsage, canConsume } from '@/lib/subscriptions';

export default function UseSubscriptionDialog({
  appointment,
  subscription,
  plan,
  servicePrice,
  onUsePlan,
  onUseAvulso,
  onClose,
  isPending,
}) {
  const validation = canConsume({
    subscription,
    plan,
    serviceId: appointment.service_id,
    unitId: appointment.unit_id,
    when: appointment.scheduled_at ? new Date(appointment.scheduled_at) : new Date(),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#2563EB]" />
            <h3 className="font-bold text-[#111827]">Cliente assinante</h3>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          <strong>{appointment.customer_name}</strong> tem o plano <strong>{subscription.plan_name_snapshot}</strong> ativo.
          Como deseja cobrar este atendimento?
        </p>

        <div className="space-y-3">
          <button
            onClick={onUsePlan}
            disabled={!validation.ok || isPending}
            className="w-full p-4 border-2 border-[#2563EB] bg-blue-50 rounded-xl text-left hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-[#2563EB] mb-0.5">Usar plano</div>
                <div className="text-xs text-gray-600">
                  {validation.ok
                    ? `${formatUsage(subscription)} • Cliente paga R$0`
                    : validation.reason}
                </div>
              </div>
              <span className="text-2xl font-black text-[#2563EB]">✓</span>
            </div>
          </button>

          <button
            onClick={onUseAvulso}
            disabled={isPending}
            className="w-full p-4 border border-black/10 rounded-xl text-left hover:border-gray-300 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-[#111827] mb-0.5">Cobrar avulso</div>
                <div className="text-xs text-gray-500">Não consome o plano</div>
              </div>
              <span className="text-lg font-bold text-[#111827]">R${servicePrice || 0}</span>
            </div>
          </button>
        </div>

        {isPending && (
          <p className="text-center text-xs text-gray-400 mt-3">Processando...</p>
        )}
      </div>
    </div>
  );
}