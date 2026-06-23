// getCompany360 — Super Admin only.
// Agrega em uma única chamada tudo que a Central de Clientes precisa:
// dados da empresa, plano, contagens, receita gerada, status Asaas, audit log recente.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: getCompany360');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Unauthorized: Super Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const companyId = body.company_id;
    if (!companyId) {
      return Response.json({ success: false, error: 'company_id required' }, { status: 400 });
    }

    const company = await base44.asServiceRole.entities.Company.get(companyId);
    if (!company) {
      return Response.json({ success: false, error: 'Company not found' }, { status: 404 });
    }

    // Plano vinculado
    let plan = null;
    if (company.plan_id) {
      plan = await base44.asServiceRole.entities.Plan.get(company.plan_id).catch(() => null);
    }
    if (!plan && company.plan_name) {
      const plans = await base44.asServiceRole.entities.Plan.filter({ name: company.plan_name }).catch(() => []);
      plan = plans?.[0] || null;
    }

    // Contagens (paralelas, com limites altos pra obter total real em SaaS jovem;
    // para tenants gigantes, trocar por aggregator específico mais tarde)
    const [customers, appointments, professionals, financials, audit] = await Promise.all([
      base44.asServiceRole.entities.Customer.filter({ company_id: companyId }, '-created_date', 5000).catch(() => []),
      base44.asServiceRole.entities.Appointment.filter({ company_id: companyId }, '-created_date', 5000).catch(() => []),
      base44.asServiceRole.entities.Professional.filter({ company_id: companyId }, '-created_date', 200).catch(() => []),
      base44.asServiceRole.entities.FinancialEntry.filter({ company_id: companyId }, '-created_date', 5000).catch(() => []),
      base44.asServiceRole.entities.AuditLog.filter({ company_id: companyId }, '-created_date', 30).catch(() => []),
    ]);

    // KPIs operacionais
    const total_customers = customers.length;
    const total_appointments = appointments.length;
    const total_professionals = professionals.filter(p => p.active !== false).length;
    const completed_appointments = appointments.filter(a => a.status === 'concluido').length;

    // Receita gerada pela barbearia (entradas confirmadas) — exclui deleted
    const generated_revenue = financials
      .filter(f => (f.type === 'entrada' || f.entry_kind === 'entrada') && f.status === 'confirmado' && !f.deleted_at)
      .reduce((s, f) => s + Number(f.amount || 0), 0);

    // Receita últimos 30 dias
    const ago30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const revenue_30d = financials
      .filter(f => {
        if (!(f.type === 'entrada' || f.entry_kind === 'entrada')) return false;
        if (f.status !== 'confirmado' || f.deleted_at) return false;
        return new Date(f.date || f.created_date) >= ago30;
      })
      .reduce((s, f) => s + Number(f.amount || 0), 0);

    // Último acesso = max(created_by audit) — fallback updated_date
    const last_activity = audit?.[0]?.created_date || company.updated_date;

    return Response.json({
      success: true,
      company,
      plan,
      counters: {
        total_customers,
        total_appointments,
        completed_appointments,
        total_professionals,
      },
      financial: {
        generated_revenue,
        revenue_30d,
      },
      last_activity,
      audit_log: audit,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('JOB ERROR: getCompany360:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});