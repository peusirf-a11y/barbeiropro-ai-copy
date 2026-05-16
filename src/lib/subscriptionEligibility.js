/**
 * subscriptionEligibility.js — Engine Central de Elegibilidade para Assinatura
 *
 * FONTE ÚNICA DE VERDADE para:
 *   - tela de Planos (contagem de elegíveis)
 *   - tela de Clientes (badge "Oferecer plano")
 *   - recommendPlanForCustomer (backend)
 *   - generatePlanSuggestions (backend)
 *   - futuras automações CRM / WhatsApp / IA
 *
 * Elegibilidade NÃO é apenas economia financeira.
 * É também: fidelização, recorrência, previsibilidade, retenção.
 *
 * Tipos de recomendação:
 *   economy          → cliente economiza dinheiro real
 *   retention        → cliente recorrente, sem economia grande
 *   premium          → ticket alto, fidelização estratégica
 *   recovery         → cliente em risco de perda
 *   churn_prevention → irregular mas com histórico
 */

// ─── Constantes ────────────────────────────────────────────────────────────────
export const ELIGIBILITY_WINDOW_DAYS = 180;
export const ELIGIBILITY_MIN_VISITS_PER_MONTH = 0.8; // ~1 visita/mês
export const DAYS_PER_MONTH = 30;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function r2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function rInt(v) { return Math.round(v) || 0; }

// ─── Score modular ─────────────────────────────────────────────────────────────

/** Frequência: 0–100 */
function scoreFrequency(visits_per_month) {
  if (visits_per_month >= 4)   return 100;
  if (visits_per_month >= 3)   return 88;
  if (visits_per_month >= 2)   return 72;
  if (visits_per_month >= 1.5) return 58;
  if (visits_per_month >= 1)   return 42;
  if (visits_per_month >= 0.8) return 30;
  return 0;
}

/** Ticket médio: 0–100 */
function scoreTicket(avg_ticket) {
  if (avg_ticket >= 100) return 100;
  if (avg_ticket >= 70)  return 80;
  if (avg_ticket >= 50)  return 62;
  if (avg_ticket >= 35)  return 45;
  if (avg_ticket >= 20)  return 28;
  return 10;
}

/** Retenção (meses de histórico): 0–100 */
function scoreRetention(retention_months) {
  if (retention_months >= 12) return 100;
  if (retention_months >= 6)  return 80;
  if (retention_months >= 3)  return 58;
  if (retention_months >= 1)  return 35;
  return 10;
}

/** Estabilidade (regularidade das visitas): 0–100 */
function scoreStability(regularity_score) {
  return Math.round(regularity_score * 100);
}

/** Economia (savings em R$): 0–100 */
function scoreEconomy(monthly_savings) {
  if (monthly_savings >= 80) return 100;
  if (monthly_savings >= 50) return 80;
  if (monthly_savings >= 30) return 62;
  if (monthly_savings >= 15) return 45;
  if (monthly_savings >= 5)  return 28;
  if (monthly_savings > 0)   return 15;
  return 0;
}

// ─── Tipo de recomendação ──────────────────────────────────────────────────────

/**
 * Determina o tipo estratégico da recomendação.
 * Isso define o ângulo de abordagem comercial.
 */
export function deriveRecommendationType(metrics, economy) {
  const { visits_per_month, avg_ticket, regularity_score, retention_months } = metrics;
  const savings = economy?.monthly_savings || 0;

  if (savings >= 20) return 'economy';
  if (avg_ticket >= 80 && visits_per_month >= 1) return 'premium';
  if (retention_months >= 3 && visits_per_month >= 1) return 'retention';
  if (regularity_score < 0.3 && retention_months >= 2) return 'churn_prevention';
  return 'retention';
}

// ─── Confiança da previsão ────────────────────────────────────────────────────

/**
 * Confiança baseada na quantidade e qualidade dos dados.
 */
export function deriveConfidence(total_visits, retention_months) {
  if (total_visits >= 8 && retention_months >= 3) return 'high';
  if (total_visits >= 4 && retention_months >= 1) return 'medium';
  return 'low';
}

// ─── Risco de churn ───────────────────────────────────────────────────────────

/**
 * Risco de abandono do plano após conversão.
 * Não penaliza cliente frequente mas irregular.
 */
export function deriveChurnRisk(metrics) {
  const { regularity_score = 0, retention_months = 0, visits_per_month = 0 } = metrics;

  // Cliente recorrente com histórico: baixo risco
  if (regularity_score >= 0.55 && retention_months >= 3) return 'low';

  // Alguma regularidade ou histórico decente: médio
  if (regularity_score >= 0.3 || (retention_months >= 2 && visits_per_month >= 1)) return 'medium';

  // Irregular + pouco histórico: alto
  return 'high';
}

// ─── Score final ponderado ────────────────────────────────────────────────────

/**
 * Score 0–100 composto pelos módulos independentes.
 *
 * Pesos:
 *   frequência   35%
 *   ticket       20%
 *   retenção     20%
 *   estabilidade 15%
 *   economia     10%
 */
export function computeEligibilityScore(metrics, economy) {
  const { visits_per_month, avg_ticket, retention_months, regularity_score, total_visits } = metrics;
  const savings = economy?.monthly_savings || 0;

  const freq  = scoreFrequency(visits_per_month);
  const tick  = scoreTicket(avg_ticket);
  const ret   = scoreRetention(retention_months);
  const stab  = scoreStability(regularity_score);
  const eco   = scoreEconomy(savings);

  const total = (freq * 0.35) + (tick * 0.20) + (ret * 0.20) + (stab * 0.15) + (eco * 0.10);

  return {
    score: r2(Math.min(100, Math.max(0, total))),
    breakdown: {
      frequency_score: freq,
      ticket_score:    tick,
      retention_score: ret,
      stability_score: stab,
      economy_score:   eco,
    },
  };
}

// ─── Critério de elegibilidade ────────────────────────────────────────────────

/**
 * Cliente é elegível se atende AO MENOS UM dos critérios:
 *
 *  1. frequência >= 0.8x/mês
 *  2. economia positiva (qualquer valor)
 *  3. recorrência estável (regularity >= 0.4 e retention >= 2 meses)
 *  4. ticket alto + alguma frequência (premium)
 *  5. histórico de 4+ meses com visitas regulares
 *
 * Não é apenas matemática de desconto — é potencial de fidelização.
 */
export function isEligibleForSubscription(metrics, economy) {
  const { visits_per_month, regularity_score, retention_months, avg_ticket, total_visits } = metrics;
  const savings = economy?.monthly_savings || 0;

  // 1. Frequência suficiente
  if (visits_per_month >= ELIGIBILITY_MIN_VISITS_PER_MONTH) {
    return { eligible: true, reason: 'frequency' };
  }

  // 2. Economia real
  if (savings > 0) {
    return { eligible: true, reason: 'economy' };
  }

  // 3. Recorrência estável mesmo com frequência menor
  if (regularity_score >= 0.4 && retention_months >= 2) {
    return { eligible: true, reason: 'stable_recurrence' };
  }

  // 4. Ticket premium + alguma visita
  if (avg_ticket >= 70 && visits_per_month >= 0.5) {
    return { eligible: true, reason: 'premium_ticket' };
  }

  // 5. Histórico longo com visitas
  if (retention_months >= 4 && total_visits >= 4) {
    return { eligible: true, reason: 'long_history' };
  }

  return { eligible: false, reason: 'insufficient' };
}

// ─── Badge e tooltip comercial ─────────────────────────────────────────────────

/**
 * Retorna badge label e tooltip humanizado para a tela de Clientes.
 * Linguagem comercial, não técnica.
 */
export function getBadgeContent(rec) {
  const { recommendation_type, monthly_savings, recommended_plan, monthly_visits } = rec;
  const planName = recommended_plan?.name || 'plano';

  // Label do badge
  const labelMap = {
    economy:          `${planName} · –R$${monthly_savings}/mês`,
    retention:        `${planName} · cliente recorrente`,
    premium:          `${planName} · potencial VIP`,
    churn_prevention: `${planName} · reter agora`,
    recovery:         `${planName} · reativar`,
  };
  const label = labelMap[recommendation_type] || `${planName} · elegível`;

  // Tooltip humanizado
  const tooltipMap = {
    economy:          `Cliente economizaria R$${monthly_savings}/mês com o plano — boa abertura para oferta.`,
    retention:        `Cliente visita a barbearia com frequência estável (${monthly_visits}x/mês) e possui bom potencial de fidelização através de assinatura.`,
    premium:          `Ticket alto e boa recorrência — assinatura aumenta retenção e reduz risco de perda para concorrentes.`,
    churn_prevention: `Mesmo sem economia direta, a assinatura pode aumentar recorrência e previsibilidade de receita.`,
    recovery:         `Cliente com histórico de visitas — plano pode reativar o relacionamento recorrente.`,
  };
  const tooltip = tooltipMap[recommendation_type] || `Elegível para assinatura com o plano "${planName}".`;

  return { label, tooltip };
}

// ─── Engine de elegibilidade completa ─────────────────────────────────────────

/**
 * Avalia elegibilidade completa de um cliente para um conjunto de planos.
 *
 * Retorna o objeto padronizado que todas as telas devem usar.
 *
 * @param {Object} params
 * @param {Object} params.metrics  - métricas do cliente (de computeCustomerMetrics)
 * @param {Array}  params.plans    - planos ativos da empresa
 * @param {Object} params.economy  - economia calculada (de computePlanEconomy) do melhor plano
 *
 * @returns {Object} EligibilityResult
 */
export function evaluateEligibility({ metrics, plans, economy, recommendedPlan }) {
  if (!metrics || metrics.insufficient_data) {
    return {
      eligible: false,
      reason: 'insufficient_data',
      confidence: 'low',
      score: 0,
      breakdown: {},
    };
  }

  const eligibility = isEligibleForSubscription(metrics, economy);
  const { score, breakdown } = computeEligibilityScore(metrics, economy);
  const recommendation_type = deriveRecommendationType(metrics, economy);
  const confidence = deriveConfidence(metrics.total_visits || 0, metrics.retention_months || 0);
  const churn_risk = deriveChurnRisk(metrics);

  return {
    eligible: eligibility.eligible,
    reason: eligibility.reason,
    score,
    breakdown,
    recommendation_type,
    confidence,
    churn_risk,
    monthly_visits: r2(metrics.visits_per_month || 0),
    monthly_savings: economy?.monthly_savings || 0,
    avg_ticket: metrics.avg_ticket || 0,
    retention_months: r2(metrics.retention_months || 0),
    regularity_score: r2(metrics.regularity_score || 0),
  };
}

// ─── Batch: múltiplos clientes de uma vez ─────────────────────────────────────

/**
 * Avalia elegibilidade para múltiplos clientes em batch.
 * Mais eficiente que chamar o backend para cada cliente individualmente.
 *
 * @param {Array}  customerAppointmentsMap - Array de { customer_id, appointments }
 * @param {Array}  plans                   - Planos ativos da empresa
 * @param {Set}    subscriberIds           - Set de customer_ids já assinantes
 *
 * @returns {Map<string, EligibilityResult>} customer_id → eligibility
 */
export function evaluateBatchEligibility(customerAppointmentsMap, plans, subscriberIds = new Set()) {
  // Import dinâmico das funções de métricas/economia evitado: recebemos os dados já processados
  // Retorna mapa customer_id → resultado
  const results = new Map();

  for (const { customer_id, metrics, economy } of customerAppointmentsMap) {
    // Assinante ativo → não elegível
    if (subscriberIds.has(customer_id)) {
      results.set(customer_id, { eligible: false, reason: 'already_subscribed', score: 0 });
      continue;
    }
    results.set(customer_id, evaluateEligibility({ metrics, plans, economy }));
  }

  return results;
}

// ─── Contagem de elegíveis (para dashboards) ───────────────────────────────────

/**
 * Conta clientes elegíveis a partir de dados já calculados.
 * Usado para garantir que Planos e Clientes mostrem o mesmo número.
 *
 * @param {Array} eligibilityResults - Array de EligibilityResult com customer_id
 * @returns {{ total: number, byType: Object, byConfidence: Object }}
 */
export function countEligible(eligibilityResults) {
  const eligible = eligibilityResults.filter(r => r.eligible);
  const byType = {};
  const byConfidence = {};
  for (const r of eligible) {
    byType[r.recommendation_type] = (byType[r.recommendation_type] || 0) + 1;
    byConfidence[r.confidence] = (byConfidence[r.confidence] || 0) + 1;
  }
  return { total: eligible.length, byType, byConfidence };
}