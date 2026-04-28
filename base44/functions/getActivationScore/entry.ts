// getActivationScore — Calcula o "Activation Score" da empresa (0-100) no servidor.
// Fonte canônica: ninguém deve replicar essa lógica no frontend.
//
// Pesos:
//   onboarding completo                  +30
//   1º agendamento criado (first_appointment ou existe Appointment)  +20
//   1º cliente criado                    +10
//   1º pagamento processado              +20
//   1º profissional ativo                +20
//
// Status:
//   0–30   INACTIVE
//   31–70  ACTIVATING
//   71–100 ACTIVE
//
// Retorna também `next_recommended_action` (texto curto pra UI).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}
async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  if (user.is_super_admin) return { role: 'super_admin', is_super_admin: true, email: user.email };
  const tm = await base44.asServiceRole.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  if (tm?.length) {
    if (tm[0].active === false) throw new AuthzError('USER_INACTIVE', 403);
    return { role: tm[0].role, company_id: tm[0].company_id, email: user.email };
  }
  const co = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (co?.length) return { role: 'admin', company_id: co[0].id, email: user.email };
  throw new AuthzError('NO_TEAM_MEMBER', 403);
}

function statusFromScore(score) {
  if (score <= 30) return 'INACTIVE';
  if (score <= 70) return 'ACTIVATING';
  return 'ACTIVE';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);

    // Super admin pode passar company_id; usuário comum sempre o próprio.
    let company_id = caller.company_id;
    if (caller.is_super_admin) {
      const body = await req.json().catch(() => ({}));
      company_id = body.company_id || null;
    }
    if (!company_id) return Response.json({ success: false, error: 'NO_COMPANY' }, { status: 400 });

    const sdk = base44.asServiceRole;

    let company;
    try {
      company = await sdk.entities.Company.get(company_id);
    } catch (_e) {
      return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
    }
    if (!company) return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });

    // Coletas em paralelo
    const [appts, customers, pros, payments] = await Promise.all([
      sdk.entities.Appointment.filter({ company_id }, '-created_date', 1),
      sdk.entities.Customer.filter({ company_id }, '-created_date', 1),
      sdk.entities.Professional.filter({ company_id, active: true }, '-created_date', 1),
      sdk.entities.FinancialEntry.filter({ company_id, type: 'entrada' }, '-created_date', 1),
    ]);

    const checks = {
      onboarding: !!company.onboarding_completed,
      first_appointment: appts.length > 0,
      first_customer: customers.length > 0,
      first_professional: pros.length > 0,
      first_payment: payments.length > 0,
    };

    const score =
      (checks.onboarding ? 30 : 0) +
      (checks.first_appointment ? 20 : 0) +
      (checks.first_customer ? 10 : 0) +
      (checks.first_professional ? 20 : 0) +
      (checks.first_payment ? 20 : 0);

    let next = null;
    if (!checks.onboarding) next = { key: 'onboarding', text: 'Complete o onboarding da sua barbearia', href: '/onboarding' };
    else if (!checks.first_professional) next = { key: 'professional', text: 'Cadastre o primeiro profissional', href: '/app/profissionais' };
    else if (!checks.first_appointment) next = { key: 'appointment', text: 'Crie seu primeiro agendamento', href: '/app/agenda' };
    else if (!checks.first_customer) next = { key: 'customer', text: 'Cadastre seu primeiro cliente', href: '/app/clientes' };
    else if (!checks.first_payment) next = { key: 'payment', text: 'Registre sua primeira entrada financeira', href: '/app/financeiro' };

    return Response.json({
      success: true,
      score,
      status: statusFromScore(score),
      checks,
      next_recommended_action: next,
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ success: false, error: error.code }, { status: error.status });
    }
    console.error('[getActivationScore] error:', error.message);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});