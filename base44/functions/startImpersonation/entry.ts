// startImpersonation — Super Admin only. Cria ImpersonationSession (TTL 15min).
// HARDENED v2:
//  - Rate limit persistente no banco (não em memória — sobrevive cold starts)
//  - 5 tentativas / 10 min → bloqueio 1h
//  - 15 tentativas → bloqueio crítico 24h
//  - SecurityEvent registrado em todo bloqueio
//  - Audit log simétrico (started → ended)
//  - TOTP rastreado com impersonation_count para limitar reutilização
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const REQUEST_ID = () => crypto.randomUUID().split('-')[0];

// Rate limit persistente — inline (Deno não permite local imports em functions/)
// Espelha lib/security/persistentRateLimit.js
async function checkPersistentRateLimit(sdk, { action, identifier, ip, limitPerWindow = 5, windowMinutes = 10, hardLimitMultiplier = 3, hardBlockHours = 24, softBlockHours = 1 }) {
  const key = `${action}:${identifier}:${ip}`;
  const now = new Date();
  const windowMs = windowMinutes * 60 * 1000;
  const existing = await sdk.entities.SecurityRateLimit.filter({ key }, '-created_date', 1).catch(() => []);
  const record = existing?.[0];

  if (record?.is_blocked && record?.blocked_until) {
    const blockedUntil = new Date(record.blocked_until);
    if (blockedUntil > now) {
      return { allowed: false, blocked_until: record.blocked_until, reason: record.attempts >= limitPerWindow * hardLimitMultiplier ? 'HARD_BLOCKED' : 'SOFT_BLOCKED', attempts: record.attempts };
    }
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: 1, window_start: now.toISOString(), window_end: new Date(now.getTime() + windowMs).toISOString(), is_blocked: false, blocked_until: null }).catch(() => {});
    return { allowed: true, attempts: 1 };
  }

  if (record && record.window_end && new Date(record.window_end) > now) {
    const newAttempts = (record.attempts || 0) + 1;
    if (newAttempts >= limitPerWindow * hardLimitMultiplier) {
      const blocked_until = new Date(now.getTime() + hardBlockHours * 60 * 60 * 1000).toISOString();
      await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts, is_blocked: true, blocked_until }).catch(() => {});
      return { allowed: false, blocked_until, reason: 'HARD_BLOCKED', attempts: newAttempts };
    }
    if (newAttempts >= limitPerWindow) {
      const blocked_until = new Date(now.getTime() + softBlockHours * 60 * 60 * 1000).toISOString();
      await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts, is_blocked: true, blocked_until }).catch(() => {});
      return { allowed: false, blocked_until, reason: 'SOFT_BLOCKED', attempts: newAttempts };
    }
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts }).catch(() => {});
    return { allowed: true, attempts: newAttempts };
  }

  const window_start = now.toISOString();
  const window_end = new Date(now.getTime() + windowMs).toISOString();
  if (record) {
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: 1, window_start, window_end, is_blocked: false, blocked_until: null }).catch(() => {});
  } else {
    await sdk.entities.SecurityRateLimit.create({ key, route: action, ip, identifier, attempts: 1, window_start, window_end, is_blocked: false }).catch(() => {});
  }
  return { allowed: true, attempts: 1 };
}

async function requireValidTotpSession(base44, totp_session_token, user_email) {
  if (!totp_session_token) return { ok: false, error: '2FA obrigatório' };
  const sessions = await base44.asServiceRole.entities.TotpSession.filter({ token: totp_session_token });
  const s = sessions?.[0];
  if (!s) return { ok: false, error: 'Sessão 2FA inválida' };
  if (s.ended_at) return { ok: false, error: 'Sessão 2FA encerrada' };
  if (new Date(s.expires_at).getTime() <= Date.now()) return { ok: false, error: 'Sessão 2FA expirada' };
  if (s.user_email !== user_email) return { ok: false, error: 'Sessão 2FA não pertence a este usuário' };

  // Limitar reutilização: máximo 5 impersonações por TotpSession
  const impCount = s.impersonation_count || 0;
  if (impCount >= 5) {
    return { ok: false, error: 'Sessão 2FA esgotada. Faça novo 2FA.', totp_exhausted: true };
  }

  return { ok: true, session_id: s.id, impersonation_count: impCount };
}

Deno.serve(async (req) => {
  const rid = REQUEST_ID();
  console.log(`[startImpersonation] rid=${rid} start`);
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    if (!user.is_super_admin) {
      console.warn(`[startImpersonation] rid=${rid} non-super-admin attempt: ${user.email}`);
      await base44.asServiceRole.entities.SecurityEvent.create({
        event_type: 'privilege_escalation_attempt', severity: 'critical',
        actor_email: user.email, ip_address: ip, route: 'startImpersonation',
        details: { request_id: rid }, blocked: true, request_id: rid,
      }).catch(() => {});
      return Response.json({ success: false, error: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    // Rate limit persistente (substitui o Map em memória)
    const rl = await checkPersistentRateLimit(base44.asServiceRole, {
      action: 'startImpersonation',
      identifier: user.email,
      ip,
      limitPerWindow: 5,
      windowMinutes: 10,
      hardLimitMultiplier: 3, // 15 tentativas → bloqueio 24h
      hardBlockHours: 24,
      softBlockHours: 1,
    });

    if (!rl.allowed) {
      console.warn(`[startImpersonation] rid=${rid} RATE_LIMITED: ${user.email} reason=${rl.reason}`);
      await base44.asServiceRole.entities.SecurityEvent.create({
        event_type: 'rate_limit_exceeded', severity: rl.reason === 'HARD_BLOCKED' ? 'critical' : 'high',
        actor_email: user.email, ip_address: ip, route: 'startImpersonation',
        details: { reason: rl.reason, attempts: rl.attempts, blocked_until: rl.blocked_until, request_id: rid },
        blocked: true, request_id: rid,
      }).catch(() => {});
      return Response.json({ success: false, error: 'Muitas tentativas. Tente novamente mais tarde.', blocked_until: rl.blocked_until }, { status: 429 });
    }

    const { company_id, reason, totp_session_token } = await req.json();
    if (!company_id) return Response.json({ success: false, error: 'company_id obrigatório', request_id: rid }, { status: 400 });

    // TOTP com rastreamento de uso (máx 5 impersonações por sessão)
    const totpCheck = await requireValidTotpSession(base44, totp_session_token, user.email);
    if (!totpCheck.ok) {
      await base44.asServiceRole.entities.SecurityEvent.create({
        event_type: 'invalid_impersonation', severity: 'high',
        actor_email: user.email, ip_address: ip, route: 'startImpersonation',
        details: { error: totpCheck.error, request_id: rid }, blocked: true, request_id: rid,
      }).catch(() => {});
      return Response.json({ success: false, error: totpCheck.error, totp_required: !totpCheck.totp_exhausted, totp_exhausted: !!totpCheck.totp_exhausted }, { status: 401 });
    }

    let company;
    try {
      company = await base44.asServiceRole.entities.Company.get(company_id);
    } catch {
      return Response.json({ success: false, error: 'NOT_FOUND', request_id: rid }, { status: 404 });
    }
    if (!company) return Response.json({ success: false, error: 'NOT_FOUND', request_id: rid }, { status: 404 });

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

    // Incrementa impersonation_count no TotpSession para limitar reutilização
    await base44.asServiceRole.entities.TotpSession.update(totpCheck.session_id, {
      impersonation_count: (totpCheck.impersonation_count || 0) + 1,
      last_impersonation_at: new Date().toISOString(),
    }).catch(() => {});

    // Audit log completo (simétrico com endImpersonation)
    await base44.asServiceRole.entities.AuditLog.create({
      company_id,
      actor_email: user.email,
      actor_is_super_admin: true,
      action: 'START_IMPERSONATION',
      target_type: 'Company',
      target_id: company_id,
      impersonated_company_id: company_id,
      ip,
      severity: 'warning',
      metadata: {
        company_name: company.name,
        expires_at,
        reason: reason || null,
        totp_impersonation_count: (totpCheck.impersonation_count || 0) + 1,
        request_id: rid,
      },
    });

    // SecurityEvent de auditoria positiva
    await base44.asServiceRole.entities.SecurityEvent.create({
      event_type: 'impersonation_abuse', // reutilizando tipo existente — campo details esclarece
      severity: 'low',
      actor_email: user.email,
      ip_address: ip,
      route: 'startImpersonation',
      details: { action: 'impersonation_started', company_id, company_name: company.name, expires_at, request_id: rid },
      blocked: false,
      request_id: rid,
    }).catch(() => {});

    console.log(`[startImpersonation] rid=${rid} ok user=${user.email} company=${company_id} expires=${expires_at}`);
    return Response.json({ success: true, token, company_id, company_name: company.name, expires_at });

  } catch (error) {
    console.error(`[startImpersonation] rid=${rid} INTERNAL_ERROR:`, error?.message);
    return Response.json({ success: false, error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});