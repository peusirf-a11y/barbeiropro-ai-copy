// getMasterMetrics — Super Admin only. Devolve MRR real, ARR e contagens.
// MRR = soma de price_monthly dos planos das companies com subscription_status='active'.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: getMasterMetrics');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Unauthorized: Super Admin only' }, { status: 403 });
    }

    const [companies, plans] = await Promise.all([
      base44.asServiceRole.entities.Company.list('-created_date', 1000),
      base44.asServiceRole.entities.Plan.list('-created_date', 100).catch(() => []),
    ]);

    const planById = Object.fromEntries((plans || []).map(p => [p.id, p]));
    const planByName = Object.fromEntries((plans || []).map(p => [p.name, p]));

    const priceFor = (c) => {
      const p = (c.plan_id && planById[c.plan_id]) || planByName[c.plan_name];
      return Number(p?.price_monthly || 0);
    };

    const total_companies = companies.length;
    const active = companies.filter(c => c.subscription_status === 'active');
    const trialing = companies.filter(c => c.subscription_status === 'trialing').length;
    const past_due = companies.filter(c => c.subscription_status === 'past_due');
    const canceled = companies.filter(c => c.subscription_status === 'canceled').length;
    const blocked = companies.filter(c => c.status === 'blocked').length;

    const mrr = active.reduce((sum, c) => sum + priceFor(c), 0);
    const arr = mrr * 12;
    const past_due_revenue = past_due.reduce((sum, c) => sum + priceFor(c), 0);

    return Response.json({
      success: true,
      total_companies,
      active_subscriptions: active.length,
      trialing,
      past_due: past_due.length,
      canceled,
      blocked,
      mrr,
      arr,
      active_revenue: mrr,
      past_due_revenue,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('JOB ERROR: getMasterMetrics:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});