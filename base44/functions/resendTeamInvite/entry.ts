// resendTeamInvite — Reenvia o e-mail de convite para um TeamMember existente.
// Útil quando o e-mail original foi para spam ou perdido.
//
// RBAC: admin/owner do tenant (ou super_admin)

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
  if (co?.length) return { role: 'admin', company_id: co[0].id, email: user.email, is_owner: true };
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

const ROLE_LABELS = {
  admin: 'Administrador', recepcao: 'Recepção', barbeiro: 'Barbeiro', financeiro: 'Financeiro',
};

function buildInviteEmail({ inviteeName, companyName, role, appUrl }) {
  const roleLabel = ROLE_LABELS[role] || role;
  const subject = `Lembrete: convite para ${companyName} no BarberTrimly`;
  const body = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F7F8FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#2563EB 0%,#60A5FA 100%);padding:32px 28px;color:white;">
      <div style="font-size:13px;font-weight:600;opacity:0.85;letter-spacing:0.06em;text-transform:uppercase;">Lembrete de convite</div>
      <div style="font-size:24px;font-weight:800;margin-top:6px;">Sua barbearia está esperando você</div>
    </div>
    <div style="padding:28px;color:#1B1C1E;line-height:1.55;font-size:15px;">
      <p>Olá <strong>${inviteeName}</strong>,</p>
      <p><strong>${companyName}</strong> reenviou o convite para você acessar o painel como <strong>${roleLabel}</strong>.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${appUrl}" style="display:inline-block;background:#2563EB;color:white;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;">
          Acessar o painel →
        </a>
      </div>
      <p style="color:#6B7280;font-size:13px;">Use o seu e-mail (${inviteeName ? '' : ''}) ao fazer login.</p>
    </div>
  </div>
</body>
</html>`.trim();
  return { subject, body };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);
    ensureRole(caller, ['admin']);

    const { team_member_id } = await req.json().catch(() => ({}));
    if (!team_member_id) return Response.json({ success: false, error: 'team_member_id required' }, { status: 400 });

    const sdk = base44.asServiceRole;

    let member;
    try {
      member = await sdk.entities.TeamMember.get(team_member_id);
    } catch (_e) {
      return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
    }
    if (!member) return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });

    ensureSameCompany(caller, member);

    let company;
    try { company = await sdk.entities.Company.get(member.company_id); } catch { company = null; }
    if (!company) return Response.json({ success: false, error: 'COMPANY_NOT_FOUND' }, { status: 404 });

    const origin = req.headers.get('origin')
      || req.headers.get('referer')?.replace(/\/[^/]*$/, '')
      || 'https://barbertrimly.base44.app';
    const appUrl = `${origin.replace(/\/$/, '')}/app/dashboard`;

    const { subject, body: html } = buildInviteEmail({
      inviteeName: member.name,
      companyName: company.name,
      role: member.role,
      appUrl,
    });
    const res = await sdk.functions.invoke('sendAuditedEmail', {
      to: member.email,
      subject,
      body: html,
      from_name: company.name,
      type: 'other',
      company_id: member.company_id,
      metadata: { team_member_id: member.id, role: member.role, kind: 'team_invite_resend' },
    });
    const emailResult = res?.data || res || { ok: false };

    try {
      await sdk.entities.AuditLog.create({
        actor_email: user.email,
        actor_is_super_admin: !!caller.is_super_admin,
        action: 'RESEND_TEAM_INVITE',
        target_type: 'TeamMember',
        target_id: member.id,
        metadata: { company_id: member.company_id, email_sent: !!emailResult?.ok },
      });
    } catch (auditErr) {
      console.warn('[resendTeamInvite] audit log failed:', auditErr.message);
    }

    return Response.json({
      success: true,
      email_sent: !!emailResult?.ok,
      email_error: emailResult?.ok ? null : (emailResult?.error || 'EMAIL_FAILED'),
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      try {
        const sdk = createClientFromRequest(req).asServiceRole;
        let u = null; try { u = await createClientFromRequest(req).auth.me(); } catch { /* noop */ }
        await logBlockedAttempt(sdk, { actor_email: u?.email, action: 'resendTeamInvite', code: error.code });
      } catch (_e) { /* noop */ }
      return Response.json({ success: false, error: error.code }, { status: error.status });
    }
    console.error('[resendTeamInvite] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});