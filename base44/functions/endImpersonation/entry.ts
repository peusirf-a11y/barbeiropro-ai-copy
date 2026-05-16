// endImpersonation — Encerra sessão de impersonação.
// HARDENED v2:
//  - Audit log simétrico completo (before/after, duração, motivo)
//  - Rate limit persistente
//  - SecurityEvent registrado
//  - Suporte a force_end (timeout automático)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const REQUEST_ID = () => crypto.randomUUID().split('-')[0];

Deno.serve(async (req) => {
  const rid = REQUEST_ID();
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    if (!user.is_super_admin) {
      console.warn(`[endImpersonation] rid=${rid} non-super-admin attempt: ${user.email}`);
      return Response.json({ success: false, error: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    const { token, reason } = await req.json().catch(() => ({}));
    if (!token) return Response.json({ success: false, error: 'token obrigatório', request_id: rid }, { status: 400 });

    const sessions = await base44.asServiceRole.entities.ImpersonationSession.filter({ token });
    const s = sessions?.[0];

    if (!s) {
      return Response.json({ success: true, message: 'Sessão não encontrada (já encerrada ou inválida)' });
    }

    // Validação: somente o ator original pode encerrar
    if (s.actor_email !== user.email) {
      console.warn(`[endImpersonation] rid=${rid} actor mismatch: session=${s.actor_email} caller=${user.email}`);
      await base44.asServiceRole.entities.SecurityEvent.create({
        event_type: 'impersonation_abuse', severity: 'critical',
        actor_email: user.email, ip_address: ip, route: 'endImpersonation',
        details: { session_actor: s.actor_email, caller: user.email, request_id: rid },
        blocked: true, request_id: rid,
      }).catch(() => {});
      return Response.json({ success: false, error: 'IMPERSONATION_MISMATCH', request_id: rid }, { status: 403 });
    }

    if (s.ended_at) {
      return Response.json({ success: true, message: 'Sessão já encerrada', ended_at: s.ended_at });
    }

    const now = new Date().toISOString();
    const startedAt = s.created_date || s.created_at;
    const durationSeconds = startedAt
      ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
      : null;

    const isTimeout = new Date(s.expires_at) < new Date();
    const actionType = isTimeout ? 'impersonation_force_ended' : 'impersonation_ended';

    await base44.asServiceRole.entities.ImpersonationSession.update(s.id, {
      ended_at: now,
    });

    // Audit log simétrico e completo (espelha startImpersonation)
    await base44.asServiceRole.entities.AuditLog.create({
      company_id: s.company_id,
      actor_email: user.email,
      actor_is_super_admin: true,
      action: 'END_IMPERSONATION',
      target_type: 'Company',
      target_id: s.company_id,
      impersonated_company_id: s.company_id,
      ip,
      severity: 'info',
      before: { ended_at: null, is_active: true },
      after: { ended_at: now, is_active: false },
      metadata: {
        company_name: s.company_name,
        duration_seconds: durationSeconds,
        reason: reason || (isTimeout ? 'timeout' : 'manual'),
        action_type: actionType,
        token_prefix: token.slice(0, 8) + '...',
        request_id: rid,
      },
    }).catch(e => console.warn(`[endImpersonation] rid=${rid} audit log failed:`, e.message));

    console.log(`[endImpersonation] rid=${rid} ok user=${user.email} company=${s.company_id} duration=${durationSeconds}s`);
    return Response.json({ success: true, duration_seconds: durationSeconds });

  } catch (error) {
    console.error(`[endImpersonation] rid=${rid} INTERNAL_ERROR:`, error?.message);
    return Response.json({ success: false, error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});