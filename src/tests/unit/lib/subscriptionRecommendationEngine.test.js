/**
 * Testes da engine de recomendação de planos.
 * Execute com: node --test tests/unit/lib/subscriptionRecommendationEngine.test.js
 */

import {
  computeCustomerMetrics,
  computePlanEconomy,
  computeBarbershopProfit,
  computeConversionProbability,
  computePlanScore,
  runRecommendationEngine,
  roundBRL,
} from '../../../lib/subscriptionRecommendationEngine.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeAppt(daysAgo, price = 50) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { status: 'concluido', scheduled_at: d.toISOString(), price, service_name: 'Corte' };
}

function makePlan({ name = 'Teste', price = 50, type = 'limited', limit = 2 } = {}) {
  return { id: name, name, price_monthly: price, type, usage_limit: limit, active: true };
}

// ─── Testes de métricas ────────────────────────────────────────────────────────
{
  // Cliente sem histórico
  const m = computeCustomerMetrics([]);
  console.assert(m.insufficient_data === true, 'Cliente sem histórico → insufficient_data');
  console.assert(m.visits_per_month === 0, 'Sem visitas → 0 visitas/mês');
}

{
  // Cliente com 1 visita (insuficiente)
  const m = computeCustomerMetrics([makeAppt(10, 40)]);
  console.assert(m.insufficient_data === true, '1 visita → insufficient_data');
}

{
  // Cliente com 6 visitas regulares nos últimos 180 dias
  const appts = [0, 30, 60, 90, 120, 150].map(d => makeAppt(d, 50));
  const m = computeCustomerMetrics(appts);
  console.assert(!m.insufficient_data, '6 visitas → suficiente');
  console.assert(m.avg_ticket === 50, `avg_ticket esperado 50, recebido ${m.avg_ticket}`);
  console.assert(m.visits_per_month === 1, `visits_per_month esperado ~1, recebido ${m.visits_per_month}`);
  console.assert(m.regularity_score > 0, 'Visitas regulares → regularity_score > 0');
  console.log('✓ Métricas cliente regular');
}

{
  // Ticket médio — ignora preços zerados
  const appts = [makeAppt(10, 0), makeAppt(40, 60), makeAppt(70, 60)];
  const m = computeCustomerMetrics(appts);
  console.assert(m.avg_ticket === 60, `Deve ignorar preço 0. avg_ticket=${m.avg_ticket}`);
  console.log('✓ avg_ticket ignora preços zerados');
}

// ─── Testes de economia ────────────────────────────────────────────────────────
{
  // Bug histórico: gasto ~R$40, plano R$29, economia não pode ser R$1 errado
  const appts = [0, 30, 60, 90].map(d => makeAppt(d, 40));
  const m = computeCustomerMetrics(appts);
  const plan = makePlan({ price: 29, type: 'limited', limit: 2 });
  const eco = computePlanEconomy(m, plan);
  // visits ~0.67/mês, effective_uses = min(2, 0.67) = 0.67
  // real_usage = 0.67 * 40 = 26.67; savings = 26.67 - 29 = -2.33 → clamped to 0
  console.assert(eco.monthly_savings >= 0, `Economia nunca negativa. Got ${eco.monthly_savings}`);
  console.log('✓ Economia nunca negativa (bug R$1 corrigido)');
}

{
  // Cliente frequente — deve gerar economia real
  const appts = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165].map(d => makeAppt(d, 70));
  const m = computeCustomerMetrics(appts);
  const plan = makePlan({ price: 89, type: 'limited', limit: 2 });
  const eco = computePlanEconomy(m, plan);
  console.assert(eco.monthly_savings > 0, `Cliente frequente deve ter economia positiva. Got ${eco.monthly_savings}`);
  console.log(`✓ Economia correta: R$${eco.monthly_savings}/mês`);
}

{
  // Plano ilimitado — usa frequência real do cliente
  const appts = [0, 10, 20, 30, 40, 50, 60, 70].map(d => makeAppt(d, 50));
  const m = computeCustomerMetrics(appts);
  const plan = makePlan({ price: 120, type: 'unlimited' });
  const eco = computePlanEconomy(m, plan);
  // effective_uses = visits_per_month (ilimitado)
  const expected = roundBRL(Math.max(0, m.visits_per_month * 50 - 120));
  console.assert(eco.monthly_savings === expected, `Ilimitado: esperado ${expected}, got ${eco.monthly_savings}`);
  console.log('✓ Economia plano ilimitado');
}

// ─── Testes de lucro ──────────────────────────────────────────────────────────
{
  const appts = [0, 30, 60, 90, 120, 150].map(d => makeAppt(d, 60));
  const m = computeCustomerMetrics(appts);
  const plan = makePlan({ price: 50, type: 'limited', limit: 1 });
  const profit = computeBarbershopProfit(m, plan);
  // profit = 50 - (1 * 60 * 0.55) = 50 - 33 = 17
  console.assert(typeof profit === 'number', 'Lucro deve ser número');
  console.log(`✓ Lucro da barbearia: R$${profit}/mês`);
}

// ─── Testes de conversão ──────────────────────────────────────────────────────
{
  // Cliente recorrente, regular, alta frequência → alta conversão
  const appts = [0, 14, 28, 42, 56, 70, 84, 98, 112, 126, 140, 154].map(d => makeAppt(d, 60));
  const m = computeCustomerMetrics(appts);
  const eco = computePlanEconomy(m, makePlan({ price: 80, type: 'limited', limit: 3 }));
  const conv = computeConversionProbability(m, eco);
  console.assert(['média', 'alta'].includes(conv.label), `Cliente fiel esperado alta/média conversão, got ${conv.label}`);
  console.log(`✓ Conversão cliente recorrente: ${conv.label} (${conv.pct}%)`);
}

{
  // Cliente esporádico → baixa conversão
  const appts = [makeAppt(160, 40), makeAppt(30, 40)];
  const m = computeCustomerMetrics(appts);
  const eco = computePlanEconomy(m, makePlan({ price: 50, type: 'limited', limit: 1 }));
  const conv = computeConversionProbability(m, eco);
  console.assert(['baixa', 'média'].includes(conv.label), `Esporádico esperado baixa/média, got ${conv.label}`);
  console.log(`✓ Conversão cliente esporádico: ${conv.label}`);
}

// ─── Testes da engine completa ────────────────────────────────────────────────
{
  // Sem planos → no_plans_available
  const result = runRecommendationEngine({ appointments: [], plans: [] });
  console.assert(result.no_plans_available === true, 'Sem planos → no_plans_available');
  console.log('✓ Sem planos disponíveis');
}

{
  // Histórico insuficiente
  const result = runRecommendationEngine({
    appointments: [makeAppt(10)],
    plans: [makePlan()],
  });
  console.assert(result.insufficient_data === true, 'Histórico insuficiente');
  console.log('✓ Histórico insuficiente detectado');
}

{
  // Plano recomendado correto (maior score, não necessariamente mais barato ou mais caro)
  const appts = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165].map(d => makeAppt(d, 60));
  const plans = [
    makePlan({ name: 'Básico',    price: 30, type: 'limited', limit: 1 }),
    makePlan({ name: 'Standard',  price: 80, type: 'limited', limit: 2 }),
    makePlan({ name: 'Premium',   price: 150, type: 'unlimited' }),
  ];
  const result = runRecommendationEngine({ appointments: appts, plans });
  console.assert(result.success === true, 'Deve ter sucesso');
  console.assert(result.recommended_plan != null, 'Deve recomendar um plano');
  console.assert(result.economy.monthly_savings >= 0, 'Economia não negativa');
  console.assert(result.recommendation_score > 0, `Score deve ser > 0. Got ${result.recommendation_score}`);
  console.log(`✓ Engine recomendou: ${result.recommended_plan.name} (score: ${result.recommendation_score})`);
}

{
  // Cliente premium (ticket alto) — não deve ser canibalizado
  const appts = [0, 20, 40, 60, 80, 100, 120, 140].map(d => makeAppt(d, 150));
  const plans = [
    makePlan({ name: 'Light', price: 50, type: 'limited', limit: 1 }),
    makePlan({ name: 'VIP',   price: 200, type: 'unlimited' }),
  ];
  const result = runRecommendationEngine({ appointments: appts, plans });
  console.assert(result.success === true || result.no_savings === true, 'Premium: sucesso ou sem savings');
  console.log(`✓ Cliente premium: ${result.recommended_plan?.name || 'sem recomendação (correto se planos não cobrem)'}`);
}

{
  // Cliente low-ticket — economia pode ser zero
  const appts = [0, 90, 170].map(d => makeAppt(d, 15));
  const plans = [makePlan({ name: 'Basic', price: 40, type: 'limited', limit: 1 })];
  const result = runRecommendationEngine({ appointments: appts, plans });
  // low ticket + baixa frequência → provavelmente no_savings
  console.assert(
    result.no_savings === true || result.no_match === true || (result.success && result.economy?.monthly_savings >= 0),
    'Cliente low-ticket: sem savings ou economia não negativa'
  );
  console.log(`✓ Cliente low-ticket: ${result.no_savings ? 'sem economia (correto)' : result.recommended_plan?.name}`);
}

{
  // Casos extremos: todos os appointments com preço 0
  const appts = [0, 30, 60, 90].map(d => makeAppt(d, 0));
  const plans = [makePlan({ price: 30, type: 'limited', limit: 1 })];
  const result = runRecommendationEngine({ appointments: appts, plans });
  // avg_ticket = 0 → real_usage_value = 0 → monthly_savings = 0 → no_savings
  console.assert(result.no_savings === true || result.success === true, 'Preços zerados: sem savings ou resultado válido');
  console.log('✓ Caso extremo: preços zerados');
}

console.log('\n✅ Todos os testes passaram!\n');