// getMasterActivityFeed — Super Admin only.
// Feed operacional unificado: novas empresas, churns, pagamentos de parceiros,
// audit logs críticos, comissões pagas. Categorizado para visão executiva.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: getMasterActivityFeed');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Unauthorized: Super Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const since = body.since ? new Date(body.since).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const category = body.category || null; // null = todas

    // Buscas paralelas dos últimos 7 dias
    const [companies, commissions, partners, audit] = await Promise.all([
      base44.asServiceRole.entities.Company.list('-created_date', 200).catch(() => []),
      base44.asServiceRole.entities.Commission.list('-created_date', 200).catch(() => []),
      base44.asServiceRole.entities.Partner.list('-created_date', 200).catch(() => []),
      base44.asServiceRole.entities.AuditLog.filter({ severity: 'critical' }, '-created_date', 50).catch(() => []),
    ]);

    const events = [];

    // ── Novas empresas (último 7d) ───────────────────────────────────────
    companies.forEach(c => {
      const t = new Date(c.created_date).getTime();
      if (t < since) return;
      events.push({
        id: `company-created-${c.id}`,
        timestamp: c.created_date,
        category: 'growth',
        type: 'company_created',
        severity: 'success',
        title: `Nova empresa cadastrada`,
        subject: c.name,
        description: `Plano ${c.plan_name || 'Starter'} · ${c.owner_email || 'sem email'}`,
        company_id: c.id,
        link: `/master/barbearias/${c.id}`,
      });
    });

    // ── Churns (canceladas/bloqueadas no período) ────────────────────────
    companies.forEach(c => {
      if (!['canceled', 'inactive'].includes(c.subscription_status) && c.status !== 'blocked') return;
      const t = new Date(c.updated_date || c.created_date).getTime();
      if (t < since) return;
      const isBlocked = c.status === 'blocked';
      events.push({
        id: `company-churn-${c.id}-${t}`,
        timestamp: c.updated_date || c.created_date,
        category: 'churn',
        type: isBlocked ? 'company_blocked' : 'company_canceled',
        severity: 'danger',
        title: isBlocked ? 'Empresa suspensa' : 'Assinatura cancelada',
        subject: c.name,
        description: `Plano ${c.plan_name || 'Starter'} · status ${c.subscription_status || 'inactive'}`,
        company_id: c.id,
        link: `/master/barbearias/${c.id}`,
      });
    });

    // ── Inadimplentes (past_due/unpaid) ─────────────────────────────────
    companies.forEach(c => {
      if (!['past_due', 'unpaid'].includes(c.subscription_status)) return;
      const t = new Date(c.updated_date || c.created_date).getTime();
      if (t < since) return;
      events.push({
        id: `company-pastdue-${c.id}-${t}`,
        timestamp: c.updated_date || c.created_date,
        category: 'billing',
        type: 'company_past_due',
        severity: 'warning',
        title: 'Pagamento em atraso',
        subject: c.name,
        description: `Status ${c.subscription_status} · ${c.plan_name || 'Starter'}`,
        company_id: c.id,
        link: `/master/barbearias/${c.id}`,
      });
    });

    // ── Comissões pagas a parceiros ──────────────────────────────────────
    const partnerById = Object.fromEntries(partners.map(p => [p.id, p]));
    commissions.forEach(co => {
      if (co.status !== 'paid' || !co.paid_at) return;
      const t = new Date(co.paid_at).getTime();
      if (t < since) return;
      const partner = partnerById[co.partner_id];
      events.push({
        id: `commission-paid-${co.id}`,
        timestamp: co.paid_at,
        category: 'partners',
        type: 'commission_paid',
        severity: 'success',
        title: 'Comissão paga ao parceiro',
        subject: partner?.name || 'Parceiro',
        description: `R$ ${Number(co.amount || 0).toFixed(2)} · ciclo ${co.billing_cycle || '?'}`,
        link: `/master/partners`,
      });
    });

    // ── Novos parceiros cadastrados ─────────────────────────────────────
    partners.forEach(p => {
      const t = new Date(p.created_date).getTime();
      if (t < since) return;
      events.push({
        id: `partner-registered-${p.id}`,
        timestamp: p.created_date,
        category: 'partners',
        type: 'partner_registered',
        severity: p.status === 'pending' ? 'warning' : 'info',
        title: p.status === 'pending' ? 'Novo parceiro aguardando aprovação' : 'Novo parceiro ativo',
        subject: p.name,
        description: `${p.email} · código ${p.referral_code}`,
        link: `/master/partners`,
      });
    });

    // ── Audit logs críticos ─────────────────────────────────────────────
    audit.forEach(log => {
      const t = new Date(log.created_date).getTime();
      if (t < since) return;
      events.push({
        id: `audit-${log.id}`,
        timestamp: log.created_date,
        category: 'security',
        type: log.action,
        severity: 'danger',
        title: 'Evento crítico de segurança',
        subject: log.action,
        description: `Ator: ${log.actor_name || log.actor_email || log.actor_id || 'sistema'}${log.target_type ? ` · ${log.target_type}` : ''}`,
        company_id: log.company_id,
        link: log.company_id ? `/master/barbearias/${log.company_id}` : `/master/auditoria`,
      });
    });

    // Ordena por mais recente
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filtro por categoria
    const filtered = category ? events.filter(e => e.category === category) : events;

    // Contagens por categoria (sobre TODOS os eventos do período, não filtrados)
    const counts = {
      all: events.length,
      growth:   events.filter(e => e.category === 'growth').length,
      churn:    events.filter(e => e.category === 'churn').length,
      billing:  events.filter(e => e.category === 'billing').length,
      partners: events.filter(e => e.category === 'partners').length,
      security: events.filter(e => e.category === 'security').length,
    };

    return Response.json({
      success: true,
      events: filtered.slice(0, 100),
      counts,
      since: new Date(since).toISOString(),
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('JOB ERROR: getMasterActivityFeed:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});