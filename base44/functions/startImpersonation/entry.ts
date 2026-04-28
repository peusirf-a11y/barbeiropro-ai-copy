// startImpersonation — Super Admin only. Cria ImpersonationSession (TTL 15min)
// e exige totp_session_token válido. Retorna token para o frontend usar nas mutações.
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
  console.log('JOB START: startImpersonation');
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`imp_${ip}`)) {
      return Response.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    if (!user.is_super_admin) {
      console.warn('[startImpersonation] non-super-admin attempt:', user.email);
      return Response.json({ success: false, error: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    const { company_id, reason, totp_session_token } = await req.json();
    if (!company_id) {
      return Response.json({ success: false, error: 'company_id required' }, { status: 400 });
    }

    // Exige 2FA válido para iniciar impersonação
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

    const token = crypto.randomUUID() + '.' + crypto.randomUUID();
    const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.ImpersonationSession.create({
      token,
      actor_email: user.email,
      company_id,
      company_name: company.name,
      expires_at,
      ip,
    });

    await base44.asServiceRole.entities.AuditLog.create({
      actor_email: user.email,
      actor_is_super_admin: true,
      action: 'START_IMPERSONATION',
      target_type: 'Company',
      target_id: company_id,
      impersonated_company_id: company_id,
      ip,
      metadata: { company_name: company.name, expires_at, reason: reason || null },
    });

    console.log('[startImpersonation] ok', { user: user.email, company_id, expires_at });
    return Response.json({
      success: true,
      token,
      company_id,
      company_name: company.name,
      expires_at,
    });
  } catch (error) {
    console.error('[startImpersonation] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});