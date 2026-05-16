/**
 * subscriptionRecommendationEngine.js
 *
 * Engine de recomendação inteligente de planos de assinatura.
 * Foco: retenção, recorrência, lucratividade, aderência e chance de conversão.
 *
 * Usada tanto pelo frontend (visualização no modal) quanto pode ser portada
 * para o backend (recommendPlanForCustomer) para scoring server-side.
 */

// ─── Constantes ────────────────────────────────────────────────────────────────
const ANALYSIS_DAYS = 180;
const DAYS_PER_MONTH = 30;
const MONTHS_IN_WINDOW = ANALYSIS_DAYS / DAYS_PER_MONTH; // 6
const AVG_SERVICE_COST_RATIO = 0.55; // custo operacional médio estimado (55% da receita)

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Arredonda para 2 casas decimais no padrão BRL */
export function roundBRL(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** Arredonda para inteiro com 0 como fallback */
export function roundInt(v) {
  return Math.round(v) || 0;
}

// ─── Métricas do Cliente ───────────────────────────────────────────────────────

/**
 * Calcula todas as métricas comportamentais do cliente
 * a partir do array de appointments concluídos.
 *
 * @param {Array} appointments - todos agendamentos concluídos do cliente
 * @param {number} windowDays - janela de análise em dias (default: 180)
 * @returns {Object} métricas calculadas
 */
export function computeCustomerMetrics(appointments, windowDays = ANALYSIS_DAYS) {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceISO = since.toISOString();

  // Filtra pela janela
  const inWindow = appointments
    .filter(a => a.status === 'concluido' && a.scheduled_at >= sinceISO)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  const monthsInWindow = windowDays / DAYS_PER_MONTH;
  const totalVisits = inWindow.length;

  if (totalVisits === 0) {
    return {
      total_visits: 0,
      visits_per_month: 0,
      avg_ticket: 0,
      avg_days_between_visits: null,
      revenue_last_90_days: 0,
      revenue_last_180_days: 0,
      retention_months: 0,
      regularity_score: 0,
      preferred_services: [],
      insufficient_data: true,
    };
  }

  // Ticket médio (ignora preços zerados para não contaminar)
  const priced = inWindow.filter(a => (a.price || 0) > 0);
  const avg_ticket = priced.length > 0
    ? roundBRL(priced.reduce((s, a) => s + a.price, 0) / priced.length)
    : 0;

  // Frequência mensal
  const visits_per_month = roundBRL(totalVisits / monthsInWindow);

  // Intervalo médio entre visitas
  let avg_days_between_visits = null;
  if (inWindow.length >= 2) {
    const gaps = [];
    for (let i = 1; i < inWindow.length; i++) {
      const diff = (new Date(inWindow[i].scheduled_at) - new Date(inWindow[i - 1].scheduled_at)) / 86400000;
      gaps.push(diff);
    }
    avg_days_between_visits = roundBRL(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  }

  // Receita
  const now = new Date();
  const since90 = new Date(now.getTime() - 90 * 86400000).toISOString();
  const revenue_last_90_days = roundBRL(
    appointments
      .filter(a => a.status === 'concluido' && a.scheduled_at >= since90)
      .reduce((s, a) => s + (a.price || 0), 0)
  );
  const revenue_last_180_days = roundBRL(
    inWindow.reduce((s, a) => s + (a.price || 0), 0)
  );

  // Meses de retenção (da primeira visita na janela até hoje)
  const firstVisit = inWindow[0]?.scheduled_at;
  const retention_months = firstVisit
    ? roundBRL((now - new Date(firstVisit)) / (DAYS_PER_MONTH * 86400000))
    : 0;

  // Score de regularidade (0-1): quão consistente é o intervalo entre visitas
  // Alta regularidade = cliente previsível = maior conversão
  let regularity_score = 0;
  if (inWindow.length >= 3 && avg_days_between_visits) {
    const gaps = [];
    for (let i = 1; i < inWindow.length; i++) {
      gaps.push((new Date(inWindow[i].scheduled_at) - new Date(inWindow[i - 1].scheduled_at)) / 86400000);
    }
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const variance = gaps.reduce((s, g) => s + Math.pow(g - mean, 2), 0) / gaps.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1; // coeficiente de variação
    regularity_score = roundBRL(Math.max(0, Math.min(1, 1 - cv)));
  } else if (inWindow.length >= 2) {
    regularity_score = 0.4; // dados mínimos
  }

  // Serviços preferidos
  const svcCount = {};
  inWindow.forEach(a => {
    if (a.service_name) svcCount[a.service_name] = (svcCount[a.service_name] || 0) + 1;
  });
  const preferred_services = Object.entries(svcCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  return {
    total_visits: totalVisits,
    visits_per_month,
    avg_ticket,
    avg_days_between_visits,
    revenue_last_90_days,
    revenue_last_180_days,
    retention_months,
    regularity_score,
    preferred_services,
    insufficient_data: totalVisits < 2,
    monthly_avulso: roundBRL(visits_per_month * avg_ticket),
  };
}

// ─── Cálculo de Economia Real ──────────────────────────────────────────────────

/**
 * Calcula a economia REAL do cliente ao aderir a um plano.
 *
 * NOVO: usa min(visitas_mensais, limite_plano) × ticket_médio
 * e nunca mostra economia negativa ou irreal.
 *
 * @param {Object} metrics - métricas do cliente
 * @param {Object} plan - plano candidato
 * @returns {{ real_usage_value, monthly_savings, annual_savings, economy_level }}
 */
export function computePlanEconomy(metrics, plan) {
  const { visits_per_month, avg_ticket } = metrics;
  const planPrice = plan.price_monthly || 0;

  // Usos realmente cobertos pelo plano
  const effective_uses = plan.type === 'unlimited'
    ? visits_per_month
    : Math.min(plan.usage_limit || 1, visits_per_month);

  // Valor real que o cliente economiza em serviços cobertos
  const real_usage_value = roundBRL(effective_uses * avg_ticket);

  // Economia = valor dos serviços cobertos − preço do plano
  const raw_savings = real_usage_value - planPrice;
  const monthly_savings = roundBRL(Math.max(0, raw_savings));
  const annual_savings = roundBRL(monthly_savings * 12);

  // Nível de economia para barra visual
  let economy_level = 'baixa';
  if (monthly_savings >= 50) economy_level = 'alta';
  else if (monthly_savings >= 20) economy_level = 'média';

  return {
    effective_uses: roundBRL(effective_uses),
    real_usage_value,
    monthly_savings,
    annual_savings,
    economy_level,
  };
}

// ─── Lucro Estimado da Barbearia ───────────────────────────────────────────────

/**
 * Estima o lucro mensal da barbearia ao converter este cliente para assinante.
 *
 * Leva em conta:
 * - Receita garantida do plano (price_monthly)
 * - Custo operacional estimado dos atendimentos (AVG_SERVICE_COST_RATIO)
 * - Frequência prevista de uso do plano
 * - "Desconto implícito" que o plano representa
 *
 * @param {Object} metrics
 * @param {Object} plan
 * @returns {number} lucro mensal estimado em R$
 */
export function computeBarbershopProfit(metrics, plan) {
  const { visits_per_month, avg_ticket } = metrics;
  const planPrice = plan.price_monthly || 0;

  const effective_uses = plan.type === 'unlimited'
    ? Math.min(visits_per_month * 1.1, visits_per_month + 1) // ilimitado pode aumentar frequência levemente
    : Math.min(plan.usage_limit || 1, visits_per_month);

  const operationalCost = effective_uses * avg_ticket * AVG_SERVICE_COST_RATIO;
  const profit = planPrice - operationalCost;

  return roundBRL(profit);
}

// ─── Chance de Conversão ──────────────────────────────────────────────────────

/**
 * Estima a probabilidade de adesão ao plano.
 *
 * Fatores:
 * - Frequência (alta = mais provável assinar)
 * - Regularidade (previsível = mais receptivo)
 * - Retenção (cliente antigo = mais fidelizado)
 * - Gasto médio (ticket alto = mais a perder avulso)
 * - Economia real (maior economia = mais motivação)
 *
 * @returns {{ label: 'baixa'|'média'|'alta', score: number, pct: number }}
 */
export function computeConversionProbability(metrics, economy) {
  let score = 0;

  // Frequência (0-30pts)
  if (metrics.visits_per_month >= 3) score += 30;
  else if (metrics.visits_per_month >= 2) score += 20;
  else if (metrics.visits_per_month >= 1) score += 10;

  // Regularidade (0-25pts)
  score += Math.round(metrics.regularity_score * 25);

  // Retenção/antiguidade (0-20pts)
  if (metrics.retention_months >= 6) score += 20;
  else if (metrics.retention_months >= 3) score += 12;
  else if (metrics.retention_months >= 1) score += 6;

  // Ticket médio (0-15pts)
  if (metrics.avg_ticket >= 60) score += 15;
  else if (metrics.avg_ticket >= 40) score += 10;
  else if (metrics.avg_ticket >= 20) score += 5;

  // Economia real (0-10pts)
  if (economy.monthly_savings >= 50) score += 10;
  else if (economy.monthly_savings >= 25) score += 6;
  else if (economy.monthly_savings >= 10) score += 3;

  const pct = Math.min(100, score);
  let label = 'baixa';
  if (pct >= 70) label = 'alta';
  else if (pct >= 45) label = 'média';

  return { label, score: pct, pct };
}

// ─── Score do Plano ────────────────────────────────────────────────────────────

/**
 * Calcula o recommendation_score de um plano para um cliente.
 *
 * Pesos:
 *   aderência de uso    → 35%
 *   lucro previsto      → 25%
 *   retenção esperada   → 20%
 *   chance de conversão → 20%
 *
 * @returns {number} score 0-100
 */
export function computePlanScore(metrics, plan, economy, profit, conversion) {
  // Aderência de uso (0-100): quão bem o plano se encaixa na frequência do cliente
  const usageAdherence = (() => {
    if (plan.type === 'unlimited') {
      // Ilimitado é perfeito para clientes de alta frequência
      return Math.min(100, metrics.visits_per_month >= 3 ? 90 : metrics.visits_per_month >= 2 ? 70 : 50);
    }
    const limit = plan.usage_limit || 1;
    const ratio = limit / Math.max(metrics.visits_per_month, 0.1);
    if (ratio >= 1 && ratio <= 1.5) return 100; // cobre exatamente, sem desperdício
    if (ratio > 1.5) return Math.max(0, 100 - (ratio - 1.5) * 30); // sobra uso → desperdício
    return Math.max(0, ratio * 80); // cobre parcialmente
  })();

  // Lucro previsto (0-100): normalizado
  const profitScore = Math.min(100, Math.max(0, profit * 3 + 50));

  // Retenção esperada (0-100): planos que cobrem bem a frequência retêm mais
  const retentionScore = Math.min(100,
    (metrics.regularity_score * 40) +
    (metrics.retention_months >= 3 ? 30 : metrics.retention_months * 10) +
    (economy.monthly_savings >= 20 ? 30 : economy.monthly_savings * 1.5)
  );

  // Conversão (0-100)
  const conversionScore = conversion.pct;

  const score =
    (usageAdherence * 0.35) +
    (profitScore * 0.25) +
    (retentionScore * 0.20) +
    (conversionScore * 0.20);

  return roundBRL(Math.min(100, Math.max(0, score)));
}

// ─── Selos Inteligentes ────────────────────────────────────────────────────────

/**
 * Determina os selos a exibir para um plano recomendado.
 *
 * @returns {Array<{ label: string, color: string }>}
 */
export function computeBadges(metrics, plan, economy, profit, conversion, isTopRanked) {
  const badges = [];

  if (conversion.label === 'alta') {
    badges.push({ label: 'Alta chance de adesão', color: 'emerald' });
  }

  if (metrics.visits_per_month >= 3 && metrics.regularity_score >= 0.6) {
    badges.push({ label: 'Cliente ideal para assinatura', color: 'blue' });
  }

  if (isTopRanked && profit > 15) {
    badges.push({ label: 'Plano mais lucrativo', color: 'violet' });
  }

  if (economy.economy_level === 'alta') {
    badges.push({ label: 'Melhor custo-benefício', color: 'amber' });
  }

  if (metrics.regularity_score >= 0.7) {
    badges.push({ label: 'Melhor retenção', color: 'indigo' });
  }

  // Retorna no máximo 2 selos para não poluir
  return badges.slice(0, 2);
}

// ─── Saúde do Plano (perspectiva da barbearia) ────────────────────────────────

/**
 * Avalia o risco do plano para a barbearia.
 * "Arriscado" = cliente provavelmente usa mais do que o plano comporta com margem.
 *
 * @returns {{ label: string, color: string, description: string }}
 */
export function computePlanHealth(metrics, plan, profit) {
  const planPrice = plan.price_monthly || 0;
  const effectiveUses = plan.type === 'unlimited'
    ? Math.min(metrics.visits_per_month * 1.1, metrics.visits_per_month + 1)
    : Math.min(plan.usage_limit || 1, metrics.visits_per_month);
  const costCover = effectiveUses * metrics.avg_ticket * AVG_SERVICE_COST_RATIO;
  const marginPct = planPrice > 0 ? (profit / planPrice) * 100 : 0;

  if (marginPct >= 30) return { label: 'Excelente margem', color: 'emerald', description: 'Cliente usa pouco comparado ao limite — ótima margem.' };
  if (marginPct >= 10) return { label: 'Saudável', color: 'blue', description: 'Uso dentro do esperado — plano equilibrado.' };
  if (marginPct >= 0)  return { label: 'Atenção', color: 'amber', description: 'Cliente quase empata com o custo do plano.' };
  return { label: 'Arriscado', color: 'red', description: 'Cliente provavelmente dará prejuízo com este plano.' };
}

/**
 * Calcula métricas financeiras para o dono da barbearia.
 * Foco: recorrência, LTV, previsibilidade.
 */
export function computeBusinessMetrics(metrics, plan, profit, conversion) {
  const planPrice = plan.price_monthly || 0;

  // Receita recorrente anual estimada
  const annual_recurring_revenue = roundBRL(planPrice * 12);

  // LTV estimado: receita × meses esperados de retenção
  // Retenção esperada em meses baseada na regularidade e conversão
  const retention_months_expected = (() => {
    if (conversion.label === 'alta' && metrics.regularity_score >= 0.6) return 18;
    if (conversion.label === 'alta') return 12;
    if (conversion.label === 'média') return 8;
    return 4;
  })();
  const ltv_estimate = roundBRL(planPrice * retention_months_expected);

  // Frequência esperada após conversão (assinantes costumam ir um pouco mais)
  const expected_frequency = plan.type === 'unlimited'
    ? roundBRL(Math.min(metrics.visits_per_month * 1.15, metrics.visits_per_month + 0.5))
    : roundBRL(Math.min(plan.usage_limit || metrics.visits_per_month, metrics.visits_per_month));

  // Risco de churn: clientes irregulares cancelam mais
  const churn_risk = metrics.regularity_score >= 0.6 ? 'baixo' : metrics.regularity_score >= 0.3 ? 'médio' : 'alto';

  return {
    annual_recurring_revenue,
    ltv_estimate,
    retention_months_expected,
    expected_frequency,
    churn_risk,
  };
}

/**
 * Gera justificativas automáticas de "Por que este plano?" focadas no negócio.
 */
export function generateBusinessJustifications(metrics, plan, economy, profit, conversion, health) {
  const reasons = [];

  if (metrics.visits_per_month >= 2) {
    reasons.push(`Cliente possui frequência de ${metrics.visits_per_month}x/mês — compatível com recorrência.`);
  }

  if (metrics.regularity_score >= 0.6) {
    reasons.push('Comportamento previsível — alta probabilidade de manter o plano ativo.');
  }

  if (profit > 0) {
    reasons.push('Plano aumenta recorrência sem comprometer margem operacional.');
  }

  if (conversion.label === 'alta') {
    reasons.push('Cliente já demonstra comportamento de fidelidade — ideal para conversão.');
  }

  if (metrics.retention_months >= 3) {
    reasons.push(`Cliente há ${Math.round(metrics.retention_months)} meses — vínculo estabelecido.`);
  }

  if (plan.type === 'unlimited' && metrics.visits_per_month >= 3) {
    reasons.push('Alta frequência justifica plano ilimitado — reduz risco de perda para concorrentes.');
  }

  if (economy.monthly_savings <= 5) {
    reasons.push('Foco na conveniência e fidelização — não apenas economia financeira.');
  }

  return reasons.slice(0, 3);
}

/**
 * Gera alertas inteligentes focados na operação.
 */
export function generateAlerts(metrics, plan, profit, conversion, health) {
  const alerts = [];

  if (health.color === 'red') {
    alerts.push({ type: 'danger', message: 'Plano pode gerar uso acima da margem saudável — avalie o preço.' });
  } else if (health.color === 'amber') {
    alerts.push({ type: 'warning', message: 'Cliente quase empata com o custo — monitore a frequência de uso.' });
  } else if (conversion.label === 'alta' && metrics.regularity_score >= 0.7) {
    alerts.push({ type: 'success', message: 'Cliente ideal para recorrência — alta chance de fidelização.' });
  }

  if (metrics.visits_per_month < 1.5 && plan.type !== 'unlimited') {
    alerts.push({ type: 'warning', message: 'Frequência baixa para este plano — considere um plano menor.' });
  }

  if (metrics.regularity_score < 0.3 && metrics.total_visits >= 3) {
    alerts.push({ type: 'warning', message: 'Padrão de visitas irregular — risco de abandono do plano.' });
  }

  return alerts.slice(0, 2);
}

// ─── Engine Principal ──────────────────────────────────────────────────────────

/**
 * Executa toda a análise e retorna o ranking de planos com o melhor no topo.
 *
 * @param {Object} params
 * @param {Array}  params.appointments - todos agendamentos do cliente
 * @param {Array}  params.plans        - planos ativos da empresa
 * @param {number} params.windowDays   - janela de análise (default: 180)
 *
 * @returns {Object} resultado completo da análise
 */
export function runRecommendationEngine({ appointments, plans, windowDays = ANALYSIS_DAYS }) {
  if (!plans || plans.length === 0) {
    return { no_plans_available: true };
  }

  const metrics = computeCustomerMetrics(appointments, windowDays);

  if (metrics.insufficient_data) {
    return {
      insufficient_data: true,
      visits_in_window: metrics.total_visits,
      metrics,
    };
  }

  // Filtra planos que cobrem minimamente a frequência
  const candidates = plans.filter(p => {
    if (p.type === 'unlimited') return true;
    return (p.usage_limit || 0) >= Math.floor(Math.max(metrics.visits_per_month, 1));
  });

  if (candidates.length === 0) {
    return {
      no_match: true,
      metrics,
      visits_per_month: metrics.visits_per_month,
      monthly_avulso: metrics.monthly_avulso,
    };
  }

  // Calcula score para cada plano candidato
  const scored = candidates.map(plan => {
    const economy = computePlanEconomy(metrics, plan);
    const profit = computeBarbershopProfit(metrics, plan);
    const conversion = computeConversionProbability(metrics, economy);
    const score = computePlanScore(metrics, plan, economy, profit, conversion);

    return { plan, economy, profit, conversion, score };
  });

  // Ordena por score desc; empate: lucro → retenção → menor desconto
  scored.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.5) return b.score - a.score;
    if (Math.abs(b.profit - a.profit) > 0.5) return b.profit - a.profit;
    return (a.plan.price_monthly || 0) - (b.plan.price_monthly || 0);
  });

  const best = scored[0];

  // Verifica se o melhor plano realmente gera economia positiva
  if (best.economy.monthly_savings <= 0) {
    return {
      no_savings: true,
      metrics,
      visits_per_month: metrics.visits_per_month,
      monthly_avulso: metrics.monthly_avulso,
    };
  }

  const badges = computeBadges(metrics, best.plan, best.economy, best.profit, best.conversion, true);
  const planHealth = computePlanHealth(metrics, best.plan, best.profit);
  const businessMetrics = computeBusinessMetrics(metrics, best.plan, best.profit, best.conversion);
  const justifications = generateBusinessJustifications(metrics, best.plan, best.economy, best.profit, best.conversion, planHealth);
  const alerts = generateAlerts(metrics, best.plan, best.profit, best.conversion, planHealth);

  return {
    success: true,
    metrics,
    recommended_plan: {
      id: best.plan.id,
      name: best.plan.name,
      price_monthly: best.plan.price_monthly,
      type: best.plan.type,
      usage_limit: best.plan.usage_limit,
    },
    economy: best.economy,
    profit: best.profit,
    conversion: best.conversion,
    recommendation_score: best.score,
    plan_health: planHealth,
    business_metrics: businessMetrics,
    justifications,
    alerts,
    badges,
    ranked_plans: scored.map(s => ({
      plan_id: s.plan.id,
      plan_name: s.plan.name,
      score: s.score,
      monthly_savings: s.economy.monthly_savings,
      profit: s.profit,
    })),
    // Compatibilidade retroativa
    visits_per_month: roundBRL(metrics.visits_per_month),
    monthly_avulso: roundInt(metrics.monthly_avulso),
    monthly_savings: best.economy.monthly_savings,
    annual_savings: best.economy.annual_savings,
    avg_ticket: metrics.avg_ticket,
    regularity_score: metrics.regularity_score,
    retention_months: metrics.retention_months,
  };
}