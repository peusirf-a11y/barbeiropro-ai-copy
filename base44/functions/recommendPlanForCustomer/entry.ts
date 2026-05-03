// Recomenda o plano ideal para um cliente específico, baseado no histórico
// de visitas concluídas nos últimos 180 dias.
//
// Lógica:
//  - Calcula visitas/mês do cliente (FM)
//  - Calcula ticket médio do cliente
//  - Compara com os planos ATIVOS da barbearia
//  - Retorna o plano que maximiza economia (avulso × plano) e cobre a frequência
//
// Usado na tela de Clientes (uma chamada por cliente, leve).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ANALYSIS_DAYS = 180;
const DAYS_PER_MONTH = 30;
const MONTHS_IN_WINDOW = ANALYSIS_DAYS / DAYS_PER_MONTH;

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

    const since = new Date();
    since.setDate(since.getDate() - ANALYSIS_DAYS);
    const sinceISO = since.toISOString();

    const [appointments, plans, activeSubs] = await Promise.all([
      base44.asServiceRole.entities.Appointment.filter(
        { company_id, customer_id, status: 'concluido' }, '-scheduled_at', 200,
      ),
      base44.asServiceRole.entities.CustomerPlan.filter({ company_id, active: true }),
      base44.asServiceRole.entities.CustomerSubscription.filter({
        company_id, customer_id, status: 'active',
      }),
    ]);

    // Já tem plano? Não recomenda.
    if (activeSubs.length > 0) {
      return Response.json({
        success: true,
        already_subscribed: true,
        current_plan_name: activeSubs[0].plan_name_snapshot,
      });
    }

    const inWindow = appointments.filter(a => a.scheduled_at >= sinceISO);
    if (inWindow.length < 2) {
      return Response.json({ success: true, insufficient_data: true, visits_in_window: inWindow.length });
    }

    const visitsPerMonth = inWindow.length / MONTHS_IN_WINDOW;
    const totalSpent = inWindow.reduce((s, a) => s + (a.price || 0), 0);
    const customerTicket = totalSpent / inWindow.length;
    const monthlyAvulso = visitsPerMonth * customerTicket;

    if (plans.length === 0) {
      return Response.json({
        success: true,
        no_plans_available: true,
        visits_per_month: Math.round(visitsPerMonth * 10) / 10,
        monthly_avulso: Math.round(monthlyAvulso),
      });
    }

    // Filtra planos que cobrem a frequência do cliente
    // Ilimitado sempre cobre. Limited cobre se usage_limit >= visitsPerMonth (com tolerância)
    const candidates = plans.filter(p => {
      if (p.type === 'unlimited') return true;
      return (p.usage_limit || 0) >= Math.floor(visitsPerMonth);
    });

    if (candidates.length === 0) {
      return Response.json({
        success: true,
        no_match: true,
        visits_per_month: Math.round(visitsPerMonth * 10) / 10,
        monthly_avulso: Math.round(monthlyAvulso),
      });
    }

    // Escolhe o plano com maior economia ABSOLUTA mensal (preço avulso esperado − preço do plano)
    let best = null;
    let bestSavings = -Infinity;
    candidates.forEach(p => {
      const expectedUses = p.type === 'unlimited' ? Math.max(visitsPerMonth, 1) : Math.min(p.usage_limit || 1, visitsPerMonth);
      const avulsoCost = expectedUses * customerTicket;
      const savings = avulsoCost - (p.price_monthly || 0);
      if (savings > bestSavings) {
        bestSavings = savings;
        best = { plan: p, savings, expectedUses };
      }
    });

    if (!best || best.savings <= 0) {
      // Plano não economiza para esse cliente → não recomenda
      return Response.json({
        success: true,
        no_savings: true,
        visits_per_month: Math.round(visitsPerMonth * 10) / 10,
        monthly_avulso: Math.round(monthlyAvulso),
      });
    }

    return Response.json({
      success: true,
      visits_per_month: Math.round(best.expectedUses * 10) / 10,
      monthly_avulso: Math.round(monthlyAvulso),
      recommended_plan: {
        id: best.plan.id,
        name: best.plan.name,
        price_monthly: best.plan.price_monthly,
        type: best.plan.type,
        usage_limit: best.plan.usage_limit,
      },
      monthly_savings: Math.round(best.savings),
      annual_savings: Math.round(best.savings * 12),
    });
  } catch (error) {
    console.error('[recommendPlanForCustomer] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});