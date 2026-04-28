// Estorna comissão quando um appointment já concluído é alterado para
// "cancelado" ou "faltou". Disparado pela automação `onAppointmentReversed`.
// Idempotente: se a Commission já foi removida, retorna sucesso silenciosamente.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// === RBAC inline (ver lib/serverPermissions.js — fonte canônica) ===
class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}
async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  if (user.is_super_admin) return { role: 'super_admin', is_super_admin: true };
  const tm = await base44.asServiceRole.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  if (tm?.length) {
    if (tm[0].active === false) throw new AuthzError('USER_INACTIVE', 403);
    return { role: tm[0].role, company_id: tm[0].company_id };
  }
  const co = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (co?.length) return { role: 'admin', company_id: co[0].id };
  throw new AuthzError('NO_TEAM_MEMBER', 403);
}
function ensureSameCompany(caller, entity) {
  if (caller.is_super_admin) return;
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

Deno.serve(async (req) => {
  console.log('JOB START: reverseCommission');
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Aceita tanto chamada manual { appointment_id } quanto payload de automação
    // de entidade { event: { entity_id }, data, old_data }.
    const appointmentId = body.appointment_id || body?.event?.entity_id;
    if (!appointmentId) {
      return Response.json({ success: false, error: 'appointment_id required' }, { status: 400 });
    }

    const appt = await base44.asServiceRole.entities.Appointment.get(appointmentId);
    if (!appt) {
      return Response.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    // RBAC: usuário logado (não-automação) precisa ser admin/financeiro do tenant.
    let user = null;
    try { user = await base44.auth.me(); } catch { /* automation */ }
    if (user) {
      const caller = await getCallerContext(base44, user);
      ensureSameCompany(caller, appt);
      ensureRole(caller, ['admin', 'financeiro']);
    }

    // Só estorna se status atual é cancelado/faltou
    if (!['cancelado', 'faltou'].includes(appt.status)) {
      console.log('Skipped: status is not cancelado/faltou', { status: appt.status });
      return Response.json({ success: true, skipped: true, reason: 'invalid_status' });
    }

    // Busca comissão associada (idempotente: pode não existir se nunca foi concluído)
    const commissions = await base44.asServiceRole.entities.Commission.filter({ appointment_id: appointmentId }, '-created_date', 5);
    if (!commissions || commissions.length === 0) {
      console.log('No commission to reverse');
      // Garante que o flag fica em false para permitir registro futuro se reabrirem
      if (appt.commission_created) {
        await base44.asServiceRole.entities.Appointment.update(appointmentId, { commission_created: false });
      }
      return Response.json({ success: true, skipped: true, reason: 'no_commission' });
    }

    // Bloqueia estorno se já foi paga ao profissional (evita inconsistência financeira)
    const paid = commissions.find(c => c.status === 'pago');
    if (paid) {
      console.warn('Commission already paid, cannot reverse', { commission_id: paid.id });
      return Response.json({ success: false, error: 'Comissão já paga ao profissional. Estorne manualmente.', commission_id: paid.id }, { status: 409 });
    }

    // Deleta todas as comissões pendentes vinculadas
    const deletedIds = [];
    for (const c of commissions) {
      await base44.asServiceRole.entities.Commission.delete(c.id);
      deletedIds.push(c.id);
    }

    // Reseta o flag para manter consistência (caso o dono reabra o appointment)
    await base44.asServiceRole.entities.Appointment.update(appointmentId, {
      commission_created: false,
      completed_at: null,
    });

    console.log('JOB END: reverseCommission', { reversed: deletedIds.length, ids: deletedIds });
    return Response.json({ success: true, reversed: deletedIds.length, commission_ids: deletedIds });
  } catch (error) {
    const az = authzErrorResponse(error);
    if (az) return az;
    console.error('JOB ERROR: reverseCommission:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});