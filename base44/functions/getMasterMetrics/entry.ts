// getMasterMetrics — Super Admin only. Devolve visão mínima de receita/assinaturas.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: getMasterMetrics');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Unauthorized: Super Admin only' }, { status: 403 });
    }

    const companies = await base44.asServiceRole.entities.Company.list('-created_date', 1000);

    const total_companies = companies.length;
    const active_subscriptions = companies.filter(c => c.subscription_status === 'active').length;
    const trialing = companies.filter(c => c.subscription_status === 'trialing').length;
    const past_due = companies.filter(c => c.subscription_status === 'past_due').length;
    const canceled = companies.filter(c => c.subscription_status === 'canceled').length;
    const blocked = companies.filter(c => c.status === 'blocked').length;

    return Response.json({
      success: true,
      total_companies,
      active_subscriptions,
      trialing,
      past_due,
      canceled,
      blocked,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('JOB ERROR: getMasterMetrics:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});