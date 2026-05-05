// inviteTeamMember — Convida um novo membro para a equipe da empresa.
//
// Fluxo:
//   1) RBAC: caller deve ser admin do tenant (ou super_admin) → ensureRole(['admin'])
//   2) Valida payload (name, email, role)
//   3) Se já existe TeamMember com mesmo email+company_id → bloqueia (DUPLICATE)
//   4) Cria TeamMember (active=true)
//   5) Dispara e-mail via sendAuditedEmail (assunto + corpo HTML)
//   6) AuditLog INVITE_TEAM_MEMBER
//
// Como o "login com convite" funciona na Base44:
//   Não há token customizado. Quando o convidado faz login normal (magic-link ou
//   Google) com o e-mail cadastrado, getCallerContext já vincula automaticamente
//   ao TeamMember correspondente. O e-mail apenas direciona para /app/dashboard.

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

const ROLE_LABELS = {
  admin: 'Administrador',
  recepcao: 'Recepção',
  barbeiro: 'Barbeiro',
  financeiro: 'Financeiro',
};

function buildInviteEmail({ inviteeName, companyName, role, appUrl }) {
  const roleLabel = ROLE_LABELS[role] || role;
  const subject = `Convite para a equipe ${companyName} no O CORTE`;
  const body = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F7F8FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#2563EB 0%,#60A5FA 100%);padding:32px 28px;color:white;">
      <div style="font-size:13px;font-weight:600;opacity:0.85;letter-spacing:0.06em;text-transform:uppercase;">Convite de equipe</div>
      <div style="font-size:24px;font-weight:800;margin-top:6px;letter-spacing:0.04em;">Você foi convidado para O CORTE</div>
    </div>
    <div style="padding:28px;color:#1B1C1E;line-height:1.55;font-size:15px;">
      <p>Olá <strong>${inviteeName}</strong>,</p>
      <p><strong>${companyName}</strong> adicionou você à equipe como <strong>${roleLabel}</strong>.</p>
      <p style="margin:20px 0;">Para acessar o painel, basta entrar com este mesmo e-mail no link abaixo:</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${appUrl}" style="display:inline-block;background:#2563EB;color:white;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;">
          Acessar o painel →
        </a>
      </div>
      <p style="color:#6B7280;font-size:13px;margin-top:24px;">
        Você receberá um link de login no seu e-mail ao clicar em "Entrar". Não compartilhe este convite com terceiros.
      </p>
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
      <p style="color:#9CA3AF;font-size:12px;margin:0;">
        O CORTE · Sistema de gestão para barbearias<br/>
        Este convite foi enviado por um administrador de ${companyName}.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
  return { subject, body };
}

Deno.serve(async (req) => {
  console.log('[inviteTeamMember] start');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);
    ensureRole(caller, ['admin']);

    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || 'recepcao').trim();
    const targetCompanyId = caller.is_super_admin ? body.company_id : caller.company_id;

    if (!name) return Response.json({ success: false, error: 'NAME_REQUIRED' }, { status: 400 });
    if (!email || !email.includes('@')) return Response.json({ success: false, error: 'EMAIL_INVALID' }, { status: 400 });
    if (!['admin', 'recepcao', 'barbeiro', 'financeiro'].includes(role)) {
      return Response.json({ success: false, error: 'ROLE_INVALID' }, { status: 400 });
    }
    if (!targetCompanyId) return Response.json({ success: false, error: 'NO_COMPANY' }, { status: 400 });

    const sdk = base44.asServiceRole;

    // Garante que a empresa existe e busca o nome para o e-mail
    let company;
    try {
      company = await sdk.entities.Company.get(targetCompanyId);
    } catch (_e) {
      return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
    }
    if (!company) return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });

    // Empresa bloqueada não pode convidar
    if (!caller.is_super_admin && (company.status === 'blocked' || company.is_blocked_by_billing === true)) {
      await logBlockedAttempt(sdk, { actor_email: user.email, action: 'inviteTeamMember', code: 'COMPANY_BLOCKED', target_id: targetCompanyId });
      return Response.json({ success: false, error: 'COMPANY_BLOCKED' }, { status: 403 });
    }

    // Bloqueia duplicidade no mesmo tenant
    const existing = await sdk.entities.TeamMember.filter({ company_id: targetCompanyId, email });
    if (existing && existing.length > 0) {
      return Response.json({ success: false, error: 'ALREADY_MEMBER', team_member_id: existing[0].id }, { status: 409 });
    }

    // Cria TeamMember
    const member = await sdk.entities.TeamMember.create({
      company_id: targetCompanyId,
      name,
      email,
      role,
      active: true,
    });

    // Se for barbeiro, cria Professional e vincula automaticamente.
    // Sem isso o filtro de agenda/comissões do barbeiro não funciona.
    if (role === 'barbeiro') {
      try {
        const professional = await sdk.entities.Professional.create({
          company_id: targetCompanyId,
          name,
          active: true,
        });
        await sdk.entities.TeamMember.update(member.id, { professional_id: professional.id });
        member.professional_id = professional.id;
        console.log('[inviteTeamMember] auto-created Professional', professional.id, 'for barbeiro', email);
      } catch (profErr) {
        console.error('[inviteTeamMember] failed to auto-create Professional:', profErr.message);
      }
    }

    // Determina URL do app a partir do request
    const origin = req.headers.get('origin')
      || req.headers.get('referer')?.replace(/\/[^/]*$/, '')
      || 'https://barbertrimly.base44.app';
    const appUrl = `${origin.replace(/\/$/, '')}/app/dashboard`;

    // Dispara e-mail (best-effort: erro de envio NÃO desfaz criação do TeamMember;
    // log fica em EmailLog para diagnóstico/reenvio)
    let emailResult = { ok: false };
    try {
      const { subject, body: html } = buildInviteEmail({
        inviteeName: name,
        companyName: company.name,
        role,
        appUrl,
      });
      const res = await sdk.functions.invoke('sendAuditedEmail', {
        to: email,
        subject,
        body: html,
        from_name: company.name,
        type: 'other',
        company_id: targetCompanyId,
        metadata: { team_member_id: member.id, role, kind: 'team_invite' },
      });
      emailResult = res?.data || res || { ok: false };
    } catch (mailErr) {
      console.error('[inviteTeamMember] email failed:', mailErr.message);
      emailResult = { ok: false, error: mailErr.message };
    }

    // AuditLog
    try {
      await sdk.entities.AuditLog.create({
        actor_email: user.email,
        actor_is_super_admin: !!caller.is_super_admin,
        action: 'INVITE_TEAM_MEMBER',
        target_type: 'TeamMember',
        target_id: member.id,
        after: { email, role, name },
        metadata: { company_id: targetCompanyId, email_sent: !!emailResult?.ok },
      });
    } catch (auditErr) {
      console.warn('[inviteTeamMember] audit log failed:', auditErr.message);
    }

    console.log('[inviteTeamMember] ok', { caller: user.email, company_id: targetCompanyId, member_id: member.id, email_sent: !!emailResult?.ok });
    return Response.json({
      success: true,
      team_member: member,
      email_sent: !!emailResult?.ok,
      email_error: emailResult?.ok ? null : (emailResult?.error || 'EMAIL_FAILED'),
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      try {
        const sdk = createClientFromRequest(req).asServiceRole;
        let u = null; try { u = await createClientFromRequest(req).auth.me(); } catch { /* noop */ }
        await logBlockedAttempt(sdk, { actor_email: u?.email, action: 'inviteTeamMember', code: error.code });
      } catch (_e) { /* noop */ }
      return Response.json({ success: false, error: error.code }, { status: error.status });
    }
    console.error('[inviteTeamMember] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});