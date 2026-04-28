// Estorna comissão quando um appointment já concluído é alterado para
// "cancelado" ou "faltou". Disparado pela automação `onAppointmentReversed`.
// Idempotente: se a Commission já foi removida, retorna sucesso silenciosamente.
//
// HARDENING: RBAC inline. Ordem: caller → fetch via serviceRole → ensureSameCompany+ensureRole.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// === RBAC inline (ver lib/serverPermissions.js — fonte canônica) ===
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
function ensureSameCompany(caller, entity) {
  if (caller.is_super_admin) return;
  if (!entity?.company_id) throw new AuthzError('ENTITY_NO_COMPANY', 400);
  if (caller.company_id !== entity.company_id) throw new AuthzError('FORBIDDEN_TENANT', 403);
}
function ensureRole(caller, allowed) {
  if (caller.is_super_admin) return;
  if (!allowed.includes(caller.role)) throw new AuthzError('FORBIDDEN_ROLE', 403);
}
function authzErrorResponse(error) {
  if (error instanceof AuthzError) return Response.json({ success: false, error: error.code }, { status: error.status });
  return null;
}
function notFound() {
  return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
}

Deno.serve(async (req) => {
  console.log('[reverseCommission] start');
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Aceita tanto chamada manual { appointment_id } quanto payload de automação
    const appointmentId = body.appointment_id || body?.event?.entity_id;
    if (!appointmentId) {
      return Response.json({ success: false, error: 'appointment_id required' }, { status: 400 });
    }

    // Detecta automação vs. usuário logado
    let user = null;
    try { user = await base44.auth.me(); } catch { /* automation */ }

    // RBAC quando vem de usuário logado
    let caller = null;
    if (user) {
      caller = await getCallerContext(base44, user);
      ensureRole(caller, ['admin', 'financeiro']);
    }

    const sdk = base44.asServiceRole;

    let appt;
    try {
      appt = await sdk.entities.Appointment.get(appointmentId);
    } catch (_e) {
      return notFound();
    }
    if (!appt) return notFound();

    if (caller) ensureSameCompany(caller, appt);

    // Só estorna se status atual é cancelado/faltou
    if (!['cancelado', 'faltou'].includes(appt.status)) {
      console.log('[reverseCommission] skipped: invalid status', { appointmentId, status: appt.status });
      return Response.json({ success: true, skipped: true, reason: 'invalid_status' });
    }

    // Busca comissão associada (idempotente: pode não existir se nunca foi concluído)
    const commissions = await sdk.entities.Commission.filter({ appointment_id: appointmentId }, '-created_date', 5);
    if (!commissions || commissions.length === 0) {
      console.log('[reverseCommission] no commission to reverse', { appointmentId });
      if (appt.commission_created) {
        await sdk.entities.Appointment.update(appointmentId, { commission_created: false });
      }
      return Response.json({ success: true, skipped: true, reason: 'no_commission' });
    }

    // Bloqueia estorno se já foi paga (evita inconsistência financeira)
    const paid = commissions.find(c => c.status === 'pago');
    if (paid) {
      console.warn('[reverseCommission] commission already paid', { appointmentId, commission_id: paid.id });
      return Response.json({ success: false, error: 'COMMISSION_ALREADY_PAID', commission_id: paid.id }, { status: 409 });
    }

    // Defesa extra: comissões devem pertencer ao mesmo tenant
    const wrongTenant = commissions.find(c => c.company_id !== appt.company_id);
    if (wrongTenant) {
      console.error('[reverseCommission] tenant mismatch on commission', { appointmentId, commission_id: wrongTenant.id });
      return Response.json({ success: false, error: 'TENANT_MISMATCH' }, { status: 409 });
    }

    // Deleta todas as comissões pendentes vinculadas
    const deletedIds = [];
    for (const c of commissions) {
      await sdk.entities.Commission.delete(c.id);
      deletedIds.push(c.id);
    }

    // Reseta o flag para manter consistência
    await sdk.entities.Appointment.update(appointmentId, {
      commission_created: false,
      completed_at: null,
    });

    // AuditLog
    try {
      await sdk.entities.AuditLog.create({
        actor_email: user?.email || 'automation',
        actor_is_super_admin: !!caller?.is_super_admin,
        action: 'REVERSE_COMMISSION',
        target_type: 'Appointment',
        target_id: appointmentId,
        metadata: { company_id: appt.company_id, deleted_commission_ids: deletedIds, status: appt.status },
      });
    } catch (auditErr) {
      console.warn('[reverseCommission] audit log failed:', auditErr.message);
    }

    console.log('[reverseCommission] ok', {
      user: user?.email || 'automation',
      company_id: appt.company_id,
      appointmentId,
      reversed: deletedIds.length,
    });
    return Response.json({ success: true, reversed: deletedIds.length, commission_ids: deletedIds });
  } catch (error) {
    const az = authzErrorResponse(error);
    if (az) {
      console.warn('[reverseCommission] authz blocked:', error.code);
      return az;
    }
    console.error('[reverseCommission] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});