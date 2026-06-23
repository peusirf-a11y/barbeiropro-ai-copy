// getMasterFinance — Super Admin only.
// Métricas financeiras avançadas: MRR por plano, churn 30d, receita histórica 12m,
// top empresas, custo de comissões pagas a parceiros.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: getMasterFinance');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Unauthorized: Super Admin only' }, { status: 403 });
    }

    const [companies, plans, commissions] = await Promise.all([
      base44.asServiceRole.entities.Company.list('-created_date', 2000).catch(() => []),
      base44.asServiceRole.entities.Plan.list('sort_order', 100).catch(() => []),
      base44.asServiceRole.entities.Commission.list('-created_date', 5000).catch(() => []),
    ]);

    const planByName = {};
    const planById = {};
    plans.forEach(p => {
      planByName[p.name] = p;
      planById[p.id] = p;
    });

    const getPrice = (c) => {
      const p = planById[c.plan_id] || planByName[c.plan_name];
      return Number(p?.price_monthly || 0);
    };

    const isActiveSub = (c) => ['active', 'trialing'].includes(c.subscription_status) && c.status !== 'blocked';
    const isPaying    = (c) => c.subscription_status === 'active' && c.status === 'active';
    const isCanceled  = (c) => c.subscription_status === 'canceled' || c.status === 'inactive';
    const isPastDue   = (c) => ['past_due', 'unpaid'].includes(c.subscription_status);

    // ── MRR + breakdown por plano ────────────────────────────────────────
    let mrr = 0;
    let mrr_trialing = 0;
    let mrr_past_due = 0;
    const breakdown = {}; // { plan_name: { count, mrr, price } }

    companies.forEach(c => {
      const price = getPrice(c);
      const planName = c.plan_name || 'Sem plano';
      if (!breakdown[planName]) breakdown[planName] = { plan_name: planName, count: 0, mrr: 0, price };

      if (isPaying(c)) {
        mrr += price;
        breakdown[planName].count += 1;
        breakdown[planName].mrr += price;
      } else if (c.subscription_status === 'trialing') {
        mrr_trialing += price;
      } else if (isPastDue(c)) {
        mrr_past_due += price;
      }
    });

    const breakdown_list = Object.values(breakdown)
      .filter(b => b.count > 0)
      .sort((a, b) => b.mrr - a.mrr);

    // ── Churn 30d ────────────────────────────────────────────────────────
    const now = Date.now();
    const ago30 = now - 30 * 24 * 60 * 60 * 1000;
    const ago60 = now - 60 * 24 * 60 * 60 * 1000;

    const canceledLast30 = companies.filter(c => {
      if (!isCanceled(c)) return false;
      const ref = new Date(c.updated_date || c.created_date).getTime();
      return ref >= ago30;
    }).length;

    // Base = pagantes ativos hoje + cancelados nos últimos 30 dias
    const payingNow = companies.filter(isPaying).length;
    const churnBase = payingNow + canceledLast30;
    const churn_rate_30d = churnBase > 0 ? (canceledLast30 / churnBase) * 100 : 0;

    // Lost MRR (canceladas últimos 30d × preço do plano)
    const lost_mrr_30d = companies
      .filter(c => isCanceled(c) && new Date(c.updated_date || c.created_date).getTime() >= ago30)
      .reduce((s, c) => s + getPrice(c), 0);

    // ── Receita histórica (últimos 12 meses) ─────────────────────────────
    // Aproximação: para cada mês, somar MRR das empresas que estavam ativas naquele mês.
    // Como ativação real vem do created_date e cancelamento do updated_date (canceled),
    // contamos: ativa no mês X se created_date <= fim do mês X e (não cancelada OU updated_date >= início do mês X+1).
    const history = [];
    const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      d.setMonth(d.getMonth() - i);
      const monthStart = d.getTime();
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();

      let monthMrr = 0;
      let monthCount = 0;
      companies.forEach(c => {
        const createdAt = new Date(c.created_date).getTime();
        if (createdAt > monthEnd) return;
        const isCanc = isCanceled(c);
        if (isCanc) {
          const cancAt = new Date(c.updated_date || c.created_date).getTime();
          if (cancAt < monthStart) return; // cancelada antes do mês começar
        }
        const price = getPrice(c);
        if (price > 0) {
          monthMrr += price;
          monthCount += 1;
        }
      });

      history.push({
        month: `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
        mrr: Math.round(monthMrr),
        active: monthCount,
      });
    }

    // ── Top 10 empresas por receita SaaS (MRR pago) ──────────────────────
    const top_companies = companies
      .filter(isPaying)
      .map(c => ({
        id: c.id,
        name: c.name,
        owner_email: c.owner_email,
        plan_name: c.plan_name,
        mrr: getPrice(c),
        since: c.created_date,
      }))
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 10);

    // ── Custo com parceiros (comissões pagas) ────────────────────────────
    const commissions_paid     = commissions.filter(c => c.status === 'paid');
    const commissions_pending  = commissions.filter(c => c.status === 'pending');
    const commissions_approved = commissions.filter(c => c.status === 'approved');

    const total_paid_to_partners = commissions_paid.reduce((s, c) => s + Number(c.amount || 0), 0);
    const pending_to_partners    = [...commissions_pending, ...commissions_approved].reduce((s, c) => s + Number(c.amount || 0), 0);

    const paid_30d = commissions_paid
      .filter(c => c.paid_at && new Date(c.paid_at).getTime() >= ago30)
      .reduce((s, c) => s + Number(c.amount || 0), 0);

    const paid_prev_30d = commissions_paid
      .filter(c => {
        if (!c.paid_at) return false;
        const t = new Date(c.paid_at).getTime();
        return t >= ago60 && t < ago30;
      })
      .reduce((s, c) => s + Number(c.amount || 0), 0);

    return Response.json({
      success: true,
      revenue: {
        mrr,
        arr: mrr * 12,
        mrr_trialing,
        mrr_past_due,
        net_mrr: mrr - total_paid_to_partners / 30, // proxy de receita líquida diária — visual
      },
      breakdown: breakdown_list,
      churn: {
        canceled_30d: canceledLast30,
        churn_rate_30d: Math.round(churn_rate_30d * 100) / 100,
        lost_mrr_30d,
        paying_now: payingNow,
        past_due: companies.filter(isPastDue).length,
      },
      history,
      top_companies,
      partners_cost: {
        total_paid: total_paid_to_partners,
        pending: pending_to_partners,
        paid_30d,
        paid_prev_30d,
        delta_30d: paid_prev_30d > 0 ? ((paid_30d - paid_prev_30d) / paid_prev_30d) * 100 : 0,
        commissions_paid_count: commissions_paid.length,
      },
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('JOB ERROR: getMasterFinance:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});