// recommendPlanForCustomer — Engine inteligente de recomendação de plano.
//
// v2 — scoring multidimensional:
//   - aderência de uso       35%
//   - lucro previsto         25%
//   - retenção esperada      20%
//   - chance de conversão    20%
//
// Economia usa: min(visitas_mensais, limite_plano) × ticket_médio − preço
// Nunca mostra economia negativa ou irreal.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ANALYSIS_DAYS = 180;
const DAYS_PER_MONTH = 30;
const MONTHS_IN_WINDOW = ANALYSIS_DAYS / DAYS_PER_MONTH; // 6
const AVG_SERVICE_COST_RATIO = 0.55;

function roundBRL(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
function roundInt(v) { return Math.round(v) || 0; }

// ─── Métricas ─────────────────────────────────────────────────────────────────
function computeMetrics(appointments, windowDays) {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceISO = since.toISOString();

  const inWindow = appointments
    .filter(a => a.status === 'concluido' && a.scheduled_at >= sinceISO)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  const totalVisits = inWindow.length;
  if (totalVisits === 0) return { totalVisits, insufficient: true };

  const monthsInWindow = windowDays / DAYS_PER_MONTH;
  const priced = inWindow.filter(a => (a.price || 0) > 0);
  const avg_ticket = priced.length > 0
    ? roundBRL(priced.reduce((s, a) => s + a.price, 0) / priced.length)
    : 0;
  const visits_per_month = roundBRL(totalVisits / monthsInWindow);

  // Regularidade (CV invertido)
  let regularity_score = 0;
  if (inWindow.length >= 3) {
    const gaps = [];
    for (let i = 1; i < inWindow.length; i++) {
      gaps.push((new Date(inWindow[i].scheduled_at) - new Date(inWindow[i - 1].scheduled_at)) / 86400000);
    }
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const variance = gaps.reduce((s, g) => s + Math.pow(g - mean, 2), 0) / gaps.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    regularity_score = roundBRL(Math.max(0, Math.min(1, 1 - cv)));
  } else if (inWindow.length >= 2) {
    regularity_score = 0.4;
  }

  // Retenção
  const firstVisit = inWindow[0]?.scheduled_at;
  const now = new Date();
  const retention_months = firstVisit
    ? roundBRL((now - new Date(firstVisit)) / (DAYS_PER_MONTH * 86400000))
    : 0;

  return {
    totalVisits, insufficient: totalVisits < 2,
    visits_per_month, avg_ticket,
    monthly_avulso: roundBRL(visits_per_month * avg_ticket),
    regularity_score, retention_months,
  };
}

// ─── Economia Real ────────────────────────────────────────────────────────────
function computeEconomy(metrics, plan) {
  const effective_uses = plan.type === 'unlimited'
    ? metrics.visits_per_month
    : Math.min(plan.usage_limit || 1, metrics.visits_per_month);
  const real_usage_value = roundBRL(effective_uses * metrics.avg_ticket);
  const monthly_savings = roundBRL(Math.max(0, real_usage_value - (plan.price_monthly || 0)));
  const annual_savings = roundBRL(monthly_savings * 12);
  let economy_level = 'baixa';
  if (monthly_savings >= 50) economy_level = 'alta';
  else if (monthly_savings >= 20) economy_level = 'média';
  return { effective_uses: roundBRL(effective_uses), real_usage_value, monthly_savings, annual_savings, economy_level };
}

// ─── Lucro da Barbearia ───────────────────────────────────────────────────────
function computeProfit(metrics, plan) {
  const effective_uses = plan.type === 'unlimited'
    ? Math.min(metrics.visits_per_month * 1.1, metrics.visits_per_month + 1)
    : Math.min(plan.usage_limit || 1, metrics.visits_per_month);
  const operationalCost = effective_uses * metrics.avg_ticket * AVG_SERVICE_COST_RATIO;
  return roundBRL((plan.price_monthly || 0) - operationalCost);
}

// ─── Conversão ────────────────────────────────────────────────────────────────
function computeConversion(metrics, economy) {
  let score = 0;
  if (metrics.visits_per_month >= 3) score += 30;
  else if (metrics.visits_per_month >= 2) score += 20;
  else if (metrics.visits_per_month >= 1) score += 10;
  score += Math.round(metrics.regularity_score * 25);
  if (metrics.retention_months >= 6) score += 20;
  else if (metrics.retention_months >= 3) score += 12;
  else if (metrics.retention_months >= 1) score += 6;
  if (metrics.avg_ticket >= 60) score += 15;
  else if (metrics.avg_ticket >= 40) score += 10;
  else if (metrics.avg_ticket >= 20) score += 5;
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
function computeScore(metrics, plan, economy, profit, conversion) {
  const usageAdherence = (() => {
    if (plan.type === 'unlimited') {
      return metrics.visits_per_month >= 3 ? 90 : metrics.visits_per_month >= 2 ? 70 : 50;
    }
    const limit = plan.usage_limit || 1;
    const ratio = limit / Math.max(metrics.visits_per_month, 0.1);
    if (ratio >= 1 && ratio <= 1.5) return 100;
    if (ratio > 1.5) return Math.max(0, 100 - (ratio - 1.5) * 30);
    return Math.max(0, ratio * 80);
  })();
  const profitScore = Math.min(100, Math.max(0, profit * 3 + 50));
  const retentionScore = Math.min(100,
    (metrics.regularity_score * 40) +
    (metrics.retention_months >= 3 ? 30 : metrics.retention_months * 10) +
    (economy.monthly_savings >= 20 ? 30 : economy.monthly_savings * 1.5)
  );
  const score =
    (usageAdherence * 0.35) +
    (profitScore * 0.25) +
    (retentionScore * 0.20) +
    (conversion.pct * 0.20);
  return roundBRL(Math.min(100, Math.max(0, score)));
}

// ─── Selos ────────────────────────────────────────────────────────────────────
function computeBadges(metrics, plan, economy, profit, conversion) {
  const badges = [];
  if (conversion.label === 'alta') badges.push({ label: 'Alta chance de adesão', color: 'emerald' });
  if (metrics.visits_per_month >= 3 && metrics.regularity_score >= 0.6) badges.push({ label: 'Cliente ideal para assinatura', color: 'blue' });
  if (profit > 15) badges.push({ label: 'Plano mais lucrativo', color: 'violet' });
  if (economy.economy_level === 'alta') badges.push({ label: 'Melhor custo-benefício', color: 'amber' });
  if (metrics.regularity_score >= 0.7) badges.push({ label: 'Melhor retenção', color: 'indigo' });
  return badges.slice(0, 2);
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { company_id, customer_id } = body;
    if (!company_id || !customer_id) {
      return Response.json({ error: 'company_id e customer_id obrigatórios' }, { status: 400 });
    }

    const [appointments, plans, activeSubs] = await Promise.all([
      base44.asServiceRole.entities.Appointment.filter(
        { company_id, customer_id }, '-scheduled_at', 300,
      ),
      base44.asServiceRole.entities.CustomerPlan.filter({ company_id, active: true }),
      base44.asServiceRole.entities.CustomerSubscription.filter(
        { company_id, customer_id, status: 'active' },
      ),
    ]);

    if (activeSubs.length > 0) {
      return Response.json({
        success: true,
        already_subscribed: true,
        current_plan_name: activeSubs[0].plan_name_snapshot,
      });
    }

    if (plans.length === 0) {
      return Response.json({ success: true, no_plans_available: true });
    }

    const metrics = computeMetrics(appointments, ANALYSIS_DAYS);
    if (metrics.insufficient) {
      return Response.json({
        success: true,
        insufficient_data: true,
        visits_in_window: metrics.totalVisits,
      });
    }

    // Candidatos que cobrem minimamente a frequência
    const candidates = plans.filter(p => {
      if (p.type === 'unlimited') return true;
      return (p.usage_limit || 0) >= Math.floor(Math.max(metrics.visits_per_month, 1));
    });

    if (candidates.length === 0) {
      return Response.json({
        success: true, no_match: true,
        visits_per_month: metrics.visits_per_month,
        monthly_avulso: roundInt(metrics.monthly_avulso),
      });
    }

    // Score de cada candidato
    const scored = candidates.map(plan => {
      const economy = computeEconomy(metrics, plan);
      const profit = computeProfit(metrics, plan);
      const conversion = computeConversion(metrics, economy);
      const score = computeScore(metrics, plan, economy, profit, conversion);
      return { plan, economy, profit, conversion, score };
    });

    // Ordena: score → lucro → menor desconto
    scored.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.5) return b.score - a.score;
      if (Math.abs(b.profit - a.profit) > 0.5) return b.profit - a.profit;
      return (a.plan.price_monthly || 0) - (b.plan.price_monthly || 0);
    });

    const best = scored[0];
    if (best.economy.monthly_savings <= 0) {
      return Response.json({
        success: true, no_savings: true,
        visits_per_month: metrics.visits_per_month,
        monthly_avulso: roundInt(metrics.monthly_avulso),
      });
    }

    const badges = computeBadges(metrics, best.plan, best.economy, best.profit, best.conversion);

    console.log('[recommendPlanForCustomer] score:', best.score, 'plan:', best.plan.name, 'conversion:', best.conversion.label);

    return Response.json({
      success: true,
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
      badges,
      ranked_plans: scored.map(s => ({
        plan_id: s.plan.id,
        plan_name: s.plan.name,
        score: s.score,
        monthly_savings: s.economy.monthly_savings,
        profit: s.profit,
      })),
      // Retrocompat
      visits_per_month: roundBRL(metrics.visits_per_month),
      monthly_avulso: roundInt(metrics.monthly_avulso),
      monthly_savings: best.economy.monthly_savings,
      annual_savings: best.economy.annual_savings,
      avg_ticket: metrics.avg_ticket,
      regularity_score: metrics.regularity_score,
      retention_months: metrics.retention_months,
    });
  } catch (error) {
    console.error('[recommendPlanForCustomer] error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});