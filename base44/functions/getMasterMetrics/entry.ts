// getMasterMetrics — Super Admin only.
// Centro de Comando: MRR, ARR, crescimento, conversão trial→pago, parceiros, comissões.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DAY_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  console.log('JOB START: getMasterMetrics');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Unauthorized: Super Admin only' }, { status: 403 });
    }

    const now = new Date();
    const ago30 = new Date(now.getTime() - 30 * DAY_MS);
    const ago60 = new Date(now.getTime() - 60 * DAY_MS);
    const in3d = new Date(now.getTime() + 3 * DAY_MS);

    const [companies, plans, partners, commissions] = await Promise.all([
      base44.asServiceRole.entities.Company.list('-created_date', 2000),
      base44.asServiceRole.entities.Plan.list('-created_date', 100).catch(() => []),
      base44.asServiceRole.entities.Partner.list('-created_date', 1000).catch(() => []),
      base44.asServiceRole.entities.Commission.list('-created_date', 2000).catch(() => []),
    ]);

    const planById = Object.fromEntries((plans || []).map(p => [p.id, p]));
    const planByName = Object.fromEntries((plans || []).map(p => [p.name, p]));

    const priceFor = (c) => {
      const p = (c.plan_id && planById[c.plan_id]) || planByName[c.plan_name];
      return Number(p?.price_monthly || 0);
    };

    // -- Empresas / Assinaturas
    const total_companies = companies.length;
    const active = companies.filter(c => c.subscription_status === 'active');
    const trialing = companies.filter(c => c.subscription_status === 'trialing');
    const past_due = companies.filter(c => c.subscription_status === 'past_due');
    const canceled = companies.filter(c => c.subscription_status === 'canceled').length;
    const blocked = companies.filter(c => c.status === 'blocked').length;

    const mrr = active.reduce((sum, c) => sum + priceFor(c), 0);
    const arr = mrr * 12;
    const past_due_revenue = past_due.reduce((sum, c) => sum + priceFor(c), 0);

    // -- Crescimento (últimos 30d)
    const isAfter = (iso, ref) => iso && new Date(iso) >= ref;
    const new_companies_30d = companies.filter(c => isAfter(c.created_date, ago30)).length;
    const new_companies_prev_30d = companies.filter(c =>
      isAfter(c.created_date, ago60) && !isAfter(c.created_date, ago30)
    ).length;

    // Cancelamentos = subscription_status canceled OU is_blocked_by_billing nos últimos 30 dias
    // Aproximação: usa updated_date como proxy para "quando virou canceled"
    const canceled_30d = companies.filter(c =>
      c.subscription_status === 'canceled' && isAfter(c.updated_date, ago30)
    ).length;

    // -- Conversão trial → pago (baseada em quem JÁ saiu do trial)
    // Trial-ended pool = active + past_due + canceled (todos que um dia foram trial).
    // Aproximação razoável para SaaS jovem.
    const trial_ended_pool = active.length + past_due.length + canceled;
    const trial_to_paid_rate = trial_ended_pool > 0
      ? Math.round((active.length / trial_ended_pool) * 1000) / 10
      : 0;

    // -- Trials expirando em <= 3 dias
    const trial_ending_soon = trialing.filter(c =>
      c.trial_ends_at && new Date(c.trial_ends_at) <= in3d && new Date(c.trial_ends_at) >= now
    ).length;

    // -- Parceiros
    const active_partners = (partners || []).filter(p => p.status === 'active').length;
    const pending_partners = (partners || []).filter(p => p.status === 'pending').length;
    const total_partners = (partners || []).length;

    // -- Comissões (pendentes = aprovadas mas não pagas)
    const pending_commissions = (commissions || []).filter(c => c.status === 'approved');
    const pending_commissions_amount = pending_commissions.reduce((s, c) => s + Number(c.amount || 0), 0);
    const pending_commissions_count = pending_commissions.length;
    const hold_commissions_count = (commissions || []).filter(c => c.status === 'pending').length;

    // -- Subcontas Asaas pendentes (KYC)
    const pending_subaccounts = companies.filter(c => c.asaas_subaccount_status === 'pending').length;
    const rejected_subaccounts = companies.filter(c => c.asaas_subaccount_status === 'rejected').length;

    return Response.json({
      success: true,
      // Receita
      mrr,
      arr,
      active_revenue: mrr,
      past_due_revenue,
      // Empresas
      total_companies,
      active_subscriptions: active.length,
      trialing: trialing.length,
      past_due: past_due.length,
      canceled,
      blocked,
      // Crescimento
      new_companies_30d,
      new_companies_prev_30d,
      canceled_30d,
      trial_to_paid_rate,
      trial_ending_soon,
      // Parceiros
      active_partners,
      pending_partners,
      total_partners,
      // Comissões
      pending_commissions_amount,
      pending_commissions_count,
      hold_commissions_count,
      // Operação
      pending_subaccounts,
      rejected_subaccounts,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('JOB ERROR: getMasterMetrics:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});