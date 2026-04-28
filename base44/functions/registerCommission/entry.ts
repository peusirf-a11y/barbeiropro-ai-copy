// Calcula e registra a comissão de um profissional ao concluir um atendimento.
// IDEMPOTENTE TRIPLO:
//   1) flag commission_created no Appointment (rápido)
//   2) busca em Commission por appointment_id (defensivo)
//   3) marca commission_created=true após criar
// Pode ser chamado pelo frontend (admin/financeiro) OU pela automação `onAppointmentConcluded`.
//
// HARDENING: RBAC inline. Ordem: caller → fetch via serviceRole → ensureSameCompany+ensureRole.
// Automação chama sem user logado → bypass RBAC (mas continua usando serviceRole).

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
// Best-effort: registra tentativas bloqueadas para detecção de abuso. Falha não interrompe o fluxo.
async function logBlockedAttempt(sdk, { actor_email, action, code, target_id, metadata }) {
  try {
    await sdk.entities.AuditLog.create({
      actor_email: actor_email || 'unknown',
      action: 'BLOCKED_ATTEMPT',
      target_type: 'Function',
      target_id: action,
      metadata: { reason: code, original_target_id: target_id, ...metadata },
    });
  } catch (e) { console.warn('[logBlockedAttempt] failed:', e.message); }
}
async function ensureCompanyNotBlocked(sdk, company_id, user_email, action) {
  if (!company_id) return;
  let co;
  try { co = await sdk.entities.Company.get(company_id); } catch { return; }
  if (!co) return;
  if (co.status === 'blocked' || co.is_blocked_by_billing === true) {
    await logBlockedAttempt(sdk, { actor_email: user_email, action, code: 'COMPANY_BLOCKED', target_id: company_id });
    throw new AuthzError('COMPANY_BLOCKED', 403);
  }
}

Deno.serve(async (req) => {
  console.log('[registerCommission] start');
  try {
    const base44 = createClientFromRequest(req);

    // Aceita payload direto (frontend) OU payload de automação de entidade
    const body = await req.json().catch(() => ({}));
    const appointment_id = body.appointment_id
      || body?.event?.entity_id
      || body?.data?.id;

    if (!appointment_id) {
      return Response.json({ success: false, error: 'appointment_id required' }, { status: 400 });
    }

    // Detecta automação (sem user) vs. chamada de usuário logado
    let user = null;
    try { user = await base44.auth.me(); } catch { /* automation/no auth */ }

    // RBAC quando vem de usuário logado
    let caller = null;
    if (user) {
      caller = await getCallerContext(base44, user);
      ensureRole(caller, ['admin', 'financeiro']);
    }

    // Service role: leitura defensiva mesmo em automação
    const sdk = base44.asServiceRole;

    let appt;
    try {
      appt = await sdk.entities.Appointment.get(appointment_id);
    } catch (_e) {
      return notFound();
    }
    if (!appt) return notFound();

    // Tenant check (só para usuário logado)
    if (caller) ensureSameCompany(caller, appt);

    // Bloqueia mutação em empresa bloqueada (manual ou inadimplência) — só p/ usuários, não automação
    if (caller) await ensureCompanyNotBlocked(sdk, appt.company_id, user?.email, 'registerCommission');

    // Só processa se concluído
    if (appt.status !== 'concluido') {
      console.log('[registerCommission] skipped: not concluded', { appointment_id, status: appt.status });
      return Response.json({ success: true, skipped: true, reason: 'not_concluded' });
    }

    // 1) Flag idempotente
    if (appt.commission_created) {
      console.log('[registerCommission] skipped: flag already set', { appointment_id });
      return Response.json({ success: true, skipped: true, reason: 'flag_set' });
    }

    // 2) Defesa extra: já existe Commission para esse appointment_id?
    const existing = await sdk.entities.Commission.filter({ appointment_id });
    if (existing && existing.length > 0) {
      await sdk.entities.Appointment.update(appointment_id, { commission_created: true });
      console.log('[registerCommission] skipped: existing commission', { appointment_id, commission_id: existing[0].id });
      return Response.json({ success: true, skipped: true, commission_id: existing[0].id });
    }

    let pro;
    try {
      pro = await sdk.entities.Professional.get(appt.professional_id);
    } catch (_e) {
      return Response.json({ success: false, error: 'PROFESSIONAL_NOT_FOUND' }, { status: 404 });
    }
    if (!pro) return Response.json({ success: false, error: 'PROFESSIONAL_NOT_FOUND' }, { status: 404 });

    // Defesa extra: Professional precisa pertencer ao mesmo tenant do appointment
    if (pro.company_id !== appt.company_id) {
      console.error('[registerCommission] tenant mismatch pro vs appt', { appointment_id, pro_company: pro.company_id, appt_company: appt.company_id });
      return Response.json({ success: false, error: 'TENANT_MISMATCH' }, { status: 409 });
    }

    const price = Number(appt.price) || 0;
    const type = pro.commission_type || 'percent';
    const value = Number(pro.commission_value) || 0;

    let amount = 0;
    if (type === 'percent') amount = +(price * value / 100).toFixed(2);
    else amount = value;

    const commission = await sdk.entities.Commission.create({
      company_id: appt.company_id,
      professional_id: pro.id,
      professional_name: pro.name,
      appointment_id: appt.id,
      service_name: appt.service_name,
      service_price: price,
      commission_type: type,
      commission_value: value,
      amount,
      earned_at: appt.completed_at || new Date().toISOString(),
      status: 'pendente',
    });

    // 3) Marca flag para garantir idempotência mesmo em chamadas concorrentes
    await sdk.entities.Appointment.update(appointment_id, { commission_created: true });

    console.log('[registerCommission] ok', {
      user: user?.email || 'automation',
      company_id: appt.company_id,
      appointment_id,
      commission_id: commission.id,
      amount,
    });
    return Response.json({ success: true, commission_id: commission.id, amount });
  } catch (error) {
    const az = authzErrorResponse(error);
    if (az) {
      console.warn('[registerCommission] authz blocked:', error.code);
      // Loga tentativa bloqueada para detecção de abuso (best-effort)
      try {
        const sdk = createClientFromRequest(req).asServiceRole;
        let u = null; try { u = await createClientFromRequest(req).auth.me(); } catch { /* noop */ }
        await logBlockedAttempt(sdk, { actor_email: u?.email, action: 'registerCommission', code: error.code });
      } catch (_e) { /* noop */ }
      return az;
    }
    console.error('[registerCommission] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});