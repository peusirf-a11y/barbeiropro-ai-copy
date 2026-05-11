// blockCompany — Super Admin only. Exige TOTP session válido. Bloqueia uma empresa e grava AuditLog.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const buckets = new Map();
function rateLimit(key, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

async function requireValidTotpSession(base44, totp_session_token, user_email) {
  if (!totp_session_token) return { ok: false, error: '2FA obrigatório' };
  const sessions = await base44.asServiceRole.entities.TotpSession.filter({ token: totp_session_token });
  const s = sessions?.[0];
  if (!s) return { ok: false, error: 'Sessão 2FA inválida' };
  if (s.ended_at) return { ok: false, error: 'Sessão 2FA encerrada' };
  if (new Date(s.expires_at).getTime() <= Date.now()) return { ok: false, error: 'Sessão 2FA expirada' };
  if (s.user_email !== user_email) return { ok: false, error: 'Sessão 2FA não pertence a este usuário' };
  return { ok: true };
}

Deno.serve(async (req) => {
  console.log('JOB START: blockCompany');
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`block_${ip}`)) {
      return Response.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    if (!user.is_super_admin) {
      console.warn('[blockCompany] non-super-admin attempt:', user.email);
      // Tentativa de privilégio escalado → audita
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          actor_email: user.email,
          action: 'BLOCKED_ATTEMPT',
          target_type: 'Function',
          target_id: 'blockCompany',
          ip,
          metadata: { reason: 'FORBIDDEN_ROLE' },
        });
      } catch (_e) { /* noop */ }
      return Response.json({ success: false, error: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    const { company_id, reason, totp_session_token } = await req.json();
    if (!company_id) {
      return Response.json({ success: false, error: 'company_id required' }, { status: 400 });
    }

    const totpCheck = await requireValidTotpSession(base44, totp_session_token, user.email);
    if (!totpCheck.ok) {
      return Response.json({ success: false, error: totpCheck.error, totp_required: true }, { status: 401 });
    }

    let company;
    try {
      company = await base44.asServiceRole.entities.Company.get(company_id);
    } catch (_e) {
      return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
    }
    if (!company) return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });

    const before = { status: company.status };
    await base44.asServiceRole.entities.Company.update(company_id, { status: 'blocked' });
    const after = { status: 'blocked' };

    await base44.asServiceRole.entities.AuditLog.create({
      company_id, // P0.5: coluna nativa
      actor_email: user.email,
      actor_is_super_admin: true,
      action: 'BLOCK_COMPANY',
      target_type: 'Company',
      target_id: company_id,
      before,
      after,
      ip,
      metadata: reason ? { reason } : undefined,
    });

    try {
      await base44.asServiceRole.entities.SystemAlert.create({
        type: 'company_blocked',
        severity: 'warning',
        message: `Empresa "${company.name}" bloqueada manualmente por ${user.email}`,
        company_id,
        metadata: reason ? { reason } : undefined,
      });
    } catch (alertErr) {
      console.error('Falha ao criar SystemAlert:', alertErr.message);
    }

    console.log('[blockCompany] ok', { user: user.email, company_id });
    return Response.json({ success: true });
  } catch (error) {
    console.error('[blockCompany] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});