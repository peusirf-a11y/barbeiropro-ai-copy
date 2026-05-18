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
    <div className="fixed inset-0 bg-black/65 backdrop-blur-[3px] z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0A1124] border border-white/8 text-white rounded-2xl p-6 w-full max-w-md shadow-[0_30px_80px_rgba(0,0,0,0.7)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#93C5FD]" />
            <h3 className="font-bold text-white">Cliente assinante</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="w-5 h-5 text-white/55" /></button>
        </div>

        <p className="text-sm text-white/70 mb-4">
          <strong className="text-white">{appointment.customer_name}</strong> tem o plano <strong className="text-white">{subscription.plan_name_snapshot}</strong> ativo.
          Como deseja cobrar este atendimento?
        </p>

        <div className="space-y-3">
          <button
            onClick={onUsePlan}
            disabled={!validation.ok || isPending}
            className="w-full p-4 border border-[#60A5FA]/40 bg-blue-500/10 rounded-xl text-left hover:bg-blue-500/15 hover:border-[#60A5FA]/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ring-2 ring-blue-400/15"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-[#93C5FD] mb-0.5">Usar plano</div>
                <div className="text-xs text-white/70">
                  {validation.ok
                    ? `${formatUsage(subscription)} • Cliente paga R$0`
                    : validation.reason}
                </div>
              </div>
              <span className="text-2xl font-black text-[#93C5FD]">✓</span>
            </div>
          </button>

          <button
            onClick={onUseAvulso}
            disabled={isPending}
            className="w-full p-4 border border-white/10 bg-white/[0.03] rounded-xl text-left hover:bg-white/[0.06] hover:border-white/20 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-white mb-0.5">Cobrar avulso</div>
                <div className="text-xs text-white/55">Não consome o plano</div>
              </div>
              <span className="text-lg font-bold text-white">R${servicePrice || 0}</span>
            </div>
          </button>
        </div>

        {isPending && (
          <p className="text-center text-xs text-white/45 mt-3">Processando...</p>
        )}
      </div>
    </div>
  );
}