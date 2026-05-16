// BFF — Lista de Appointments com tenant + unit + role scope no servidor.
// HARDENED: campos sensíveis removidos (confirm_token, review_token, payment_intent_id, payer_tax_id).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

// Campos SEGUROS — nunca incluir tokens públicos, payment secrets, CPF
const APPOINTMENT_SAFE_FIELDS = [
  'id', 'company_id', 'unit_id', 'customer_id', 'professional_id', 'service_id',
  'service_name', 'professional_name', 'customer_name', 'customer_phone', 'customer_email',
  'scheduled_at', 'status', 'notes', 'source', 'completed_at',
  'price', 'custom_duration_minutes', 'is_flexible_assignment',
  'confirmation_email_sent', 'payment_method', 'subscription_id',
  'paid', 'paid_at', 'paid_online', 'payment_status', 'payment_expires_at',
  'commission_created', 'confirmed_at', 'reviewed_at',
  'created_date', 'updated_date', 'created_by',
];

function sanitizeAppointment(appt) {
  if (!appt) return null;
  return Object.fromEntries(APPOINTMENT_SAFE_FIELDS.filter(f => f in appt).map(f => [f, appt[f]]));
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

  if (user.is_super_admin) throw new AuthzError('USE_MASTER_PANEL', 403);

  const ownerHits = await sdk.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (ownerHits?.length) return { role: 'admin', company_id: ownerHits[0].id, company: ownerHits[0], email: user.email };

  const tmHits = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  const tm = tmHits?.[0];
  if (!tm) throw new AuthzError('NO_TEAM_MEMBER', 403);
  if (tm.active === false) throw new AuthzError('USER_INACTIVE', 403);

  const company = await sdk.entities.Company.get(tm.company_id).catch(() => null);
  if (!company) throw new AuthzError('COMPANY_NOT_FOUND', 404);
  return { role: tm.role, company_id: tm.company_id, company, email: user.email, professional_id: tm.professional_id || null, unit_ids: tm.unit_ids || [] };
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { active_unit_id, from, to, status, impersonation_token } = body || {};
    const caller = await getCallerContext(base44, user, impersonation_token);
    const limit = Math.min(Math.max(parseInt(body?.limit) || 500, 1), 2000);
    const sdk = base44.asServiceRole;

    const filter = { company_id: caller.company_id };

    // Barbeiro só vê seus próprios atendimentos
    if (caller.role === 'barbeiro') {
      if (!caller.professional_id) return Response.json({ appointments: [], total: 0, scope: { company_id: caller.company_id } });
      filter.professional_id = caller.professional_id;
    }

    if (from) filter.scheduled_at = { ...(filter.scheduled_at || {}), $gte: from };
    if (to) filter.scheduled_at = { ...(filter.scheduled_at || {}), $lte: to };
    if (status) {
      if (Array.isArray(status) && status.length > 0) filter.status = { $in: status };
      else if (typeof status === 'string') filter.status = status;
    }

    let appointments = await sdk.entities.Appointment.filter(filter, '-scheduled_at', limit);

    const multiUnit = !!caller.company?.multi_unit_enabled;
    if (multiUnit && active_unit_id) {
      appointments = appointments.filter(a => !a.unit_id || a.unit_id === active_unit_id);
    }

    // HARDENING: sanitiza todos os agendamentos antes de retornar
    const safeAppointments = appointments.map(sanitizeAppointment);

    return Response.json({
      appointments: safeAppointments,
      total: safeAppointments.length,
      scope: { company_id: caller.company_id, professional_id: caller.role === 'barbeiro' ? caller.professional_id : undefined, unit_id: (multiUnit && active_unit_id) || undefined },
    });

  } catch (error) {
    if (error instanceof AuthzError) return Response.json({ error: error.code }, { status: error.status });
    console.error(`[listAppointments] rid=${rid} INTERNAL_ERROR:`, error?.message, error?.stack);
    return Response.json({ error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});