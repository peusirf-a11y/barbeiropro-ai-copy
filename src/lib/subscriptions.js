// Helpers para o sistema de assinaturas de clientes (planos da barbearia).
// Mantém a lógica de ciclo, validação e formatação em um único lugar.

import { addMonths } from 'date-fns';

/**
 * Calcula o próximo fim de ciclo a partir de uma data de início (mensal).
 */
export function nextCycleEnd(startDate) {
  return addMonths(new Date(startDate), 1);
}

/**
 * Verifica se uma assinatura está dentro do ciclo atual (não expirou).
 */
export function isCycleActive(subscription) {
  if (!subscription?.current_cycle_end) return false;
  return new Date(subscription.current_cycle_end) > new Date();
}

/**
 * Retorna true se a assinatura pode ser usada AGORA para o serviço informado.
 */
export function canConsume({ subscription, plan, serviceId, unitId }) {
  if (!subscription || subscription.status !== 'active') return { ok: false, reason: 'Assinatura inativa' };
  if (!isCycleActive(subscription)) return { ok: false, reason: 'Ciclo expirado' };

  const isUnlimited = (subscription.plan_type_snapshot || plan?.type) === 'unlimited';
  if (!isUnlimited && (subscription.uses_remaining ?? 0) <= 0) {
    return { ok: false, reason: 'Limite de usos atingido neste ciclo' };
  }

  // valida serviço incluso
  if (plan?.service_ids?.length && serviceId && !plan.service_ids.includes(serviceId)) {
    return { ok: false, reason: 'Serviço não incluso neste plano' };
  }

  // valida unidade
  if (plan?.valid_in_units?.length && unitId && !plan.valid_in_units.includes(unitId)) {
    return { ok: false, reason: 'Plano não válido nesta unidade' };
  }

  return { ok: true };
}

/**
 * Formata "X de Y restantes" ou "Ilimitado".
 */
export function formatUsage(subscription) {
  if (!subscription) return '';
  const isUnlimited = subscription.plan_type_snapshot === 'unlimited';
  if (isUnlimited) return 'Ilimitado';
  const remaining = subscription.uses_remaining ?? 0;
  const limit = subscription.plan_usage_limit_snapshot ?? 0;
  return `${remaining}/${limit} restantes`;
}

/**
 * Cria payload inicial de assinatura.
 */
export function buildInitialSubscription({ companyId, customerId, plan }) {
  const now = new Date();
  const cycleEnd = nextCycleEnd(now);
  const isUnlimited = plan.type === 'unlimited';
  return {
    company_id: companyId,
    customer_id: customerId,
    plan_id: plan.id,
    plan_name_snapshot: plan.name,
    plan_price_snapshot: plan.price_monthly,
    plan_type_snapshot: plan.type,
    plan_usage_limit_snapshot: isUnlimited ? 9999 : (plan.usage_limit || 0),
    status: 'active',
    started_at: now.toISOString(),
    current_cycle_start: now.toISOString(),
    current_cycle_end: cycleEnd.toISOString(),
    uses_remaining: isUnlimited ? 9999 : (plan.usage_limit || 0),
    uses_consumed_total: 0,
    last_payment_status: 'pendente',
  };
}