// BFF — Lista de clientes com isolamento tenant + unit aplicado no servidor.
// HARDENED: campos sensíveis removidos da resposta (sanitizeCustomer).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

// Campos SEGUROS para retornar — nunca incluir password_hash, auth_token, reset_token
const CUSTOMER_SAFE_FIELDS = [
  'id', 'company_id', 'unit_id', 'name', 'phone', 'email', 'notes', 'tags',
  'status', 'lifecycle_status', 'lifecycle_updated_at',
  'total_appointments', 'last_appointment_at', 'last_completed_at',
  'favorite_service', 'favorite_professional',
  'created_date', 'updated_date', 'created_by',
  'vip_dismissed_at', 'lifecycle_campaigns_log',
];

function sanitizeCustomer(customer) {
  if (!customer) return null;
  return Object.fromEntries(CUSTOMER_SAFE_FIELDS.filter(f => f in customer).map(f => [f, customer[f]]));
}

async function getCallerContext(base44, user, impersonation_token) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  const sdk = base44.asServiceRole;

  if (impersonation_token && user.is_super_admin) {
    const sessions = await sdk.entities.ImpersonationSession.filter({ token: impersonation_token }, '-created_date', 1);
    const session = sessions?.[0];
    if (!session || session.ended_at || new Date(session.expires_at).getTime() < Date.now()) throw new AuthzError('IMPERSONATION_INVALID', 403);
    if (session.actor_email !== user.email) throw new AuthzError('IMPERSONATION_MISMATCH', 403);
    const company = await sdk.entities.Company.get(session.company_id).catch(() => null);
    if (!company) throw new AuthzError('COMPANY_NOT_FOUND', 404);
    return { role: 'admin', company_id: company.id, company, email: user.email, is_impersonating: true };
  }

  if (user.is_super_admin) return { role: 'super_admin', is_super_admin: true, email: user.email };

  const ownerHits = await sdk.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (ownerHits?.length) return { role: 'admin', company_id: ownerHits[0].id, company: ownerHits[0], email: user.email, is_owner: true };

  const tmHits = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  const tm = tmHits?.[0];
  if (!tm) throw new AuthzError('NO_TEAM_MEMBER', 403);
  if (tm.active === false) throw new AuthzError('USER_INACTIVE', 403);

  const company = await sdk.entities.Company.get(tm.company_id).catch(() => null);
  if (!company) throw new AuthzError('COMPANY_NOT_FOUND', 404);
  return { role: tm.role, company_id: tm.company_id, company, email: user.email, unit_ids: tm.unit_ids || [] };
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const caller = await getCallerContext(base44, user, body?.impersonation_token);

    if (caller.is_super_admin) return Response.json({ error: 'USE_MASTER_PANEL' }, { status: 403 });

    const { active_unit_id = null, lifecycle_status = null, status = null, limit = 500, sort = '-created_date' } = body || {};
    const cap = Math.min(Math.max(Number(limit) || 500, 1), 2000);
    const sdk = base44.asServiceRole;

    const ALLOWED_SORTS = new Set(['-created_date','created_date','-last_appointment_at','last_appointment_at','-last_completed_at','last_completed_at','-name','name','-total_appointments','total_appointments']);
    const safeSort = ALLOWED_SORTS.has(sort) ? sort : '-created_date';

    const filter = { company_id: caller.company_id };
    if (lifecycle_status) filter.lifecycle_status = lifecycle_status;
    if (status) filter.status = status;

    let customers = await sdk.entities.Customer.filter(filter, safeSort, cap);

    // Unit scoping
    const shared = caller.company?.customers_shared_across_units !== false;
    const multiUnit = !!caller.company?.multi_unit_enabled;
    const scopeByUnit = multiUnit && !shared && !!active_unit_id;
    if (scopeByUnit) customers = customers.filter(c => !c.unit_id || c.unit_id === active_unit_id);

    // HARDENING: sanitiza todos os clientes antes de retornar
    const safeCustomers = customers.map(sanitizeCustomer);

    return Response.json({ customers: safeCustomers, total: safeCustomers.length, scope: { tenant: caller.company_id, unit_scoped: scopeByUnit, active_unit_id: scopeByUnit ? active_unit_id : null } });

  } catch (error) {
    if (error instanceof AuthzError) return Response.json({ error: error.code }, { status: error.status });
    console.error(`[listCustomers] rid=${rid} INTERNAL_ERROR:`, error?.message, error?.stack);
    return Response.json({ error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});