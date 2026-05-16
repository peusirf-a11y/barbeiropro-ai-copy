// adminAudit — Registra ações administrativas críticas na trilha AdminAuditLog.
// Chamado por mutações destrutivas: exclusão, anonimização, alteração financeira,
// mudanças de permissão, ações Stripe, etc.
//
// NÃO aceitar chamadas de usuários não-autenticados.
// NÃO registrar secrets, tokens ou hashes.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const REQUEST_ID = () => crypto.randomUUID().split('-')[0];

Deno.serve(async (req) => {
  const rid = REQUEST_ID();
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;

    // Autenticar: admin da plataforma ou admin da empresa
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized', request_id: rid }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      action,
      company_id,
      target_entity,
      target_id,
      before,
      after,
      severity = 'info',
      metadata = {},
    } = body;

    if (!action) {
      return Response.json({ error: 'action obrigatório', request_id: rid }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ua = req.headers.get('user-agent')?.slice(0, 200) || 'unknown';

    // Detecta se ação foi feita via impersonação
    const impersonationToken = req.headers.get('x-impersonation-token') || body.impersonation_token;
    let actor_is_impersonating = false;
    if (impersonationToken) {
      const sessions = await sdk.entities.ImpersonationSession.filter(
        { token: impersonationToken, status: 'active' }, '-created_date', 1
      ).catch(() => []);
      actor_is_impersonating = sessions.length > 0;
    }

    // Remove campos sensíveis de before/after (nunca logar secrets)
    const BLOCKED_FIELDS = new Set([
      'password_hash', 'auth_token', 'reset_token', 'stripe_secret_key',
      'auth_token_expires_at', 'reset_token_expires_at', 'payment_intent_id',
      'payer_tax_id', 'token_version',
    ]);
    const cleanObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      return Object.fromEntries(
        Object.entries(obj).filter(([k]) => !BLOCKED_FIELDS.has(k))
      );
    };

    const log = await sdk.entities.AdminAuditLog.create({
      actor: user.email,
      actor_role: user.role || 'admin',
      actor_is_impersonating,
      company_id: company_id || null,
      target_entity: target_entity || null,
      target_id: target_id || null,
      action,
      before: cleanObject(before) || null,
      after: cleanObject(after) || null,
      ip,
      user_agent: ua,
      request_id: rid,
      severity,
      metadata: cleanObject(metadata) || {},
    });

    // Eventos críticos também geram SecurityEvent para o Security Center
    if (severity === 'critical') {
      await sdk.entities.SecurityEvent.create({
        event_type: 'privilege_escalation_attempt',
        severity: 'high',
        company_id,
        actor_email: user.email,
        ip_address: ip,
        user_agent: ua,
        route: `adminAudit:${action}`,
        blocked: false,
        request_id: rid,
        details: { action, target_entity, target_id },
      }).catch(() => {});
    }

    return Response.json({ success: true, log_id: log.id, request_id: rid });
  } catch (error) {
    console.error(`[adminAudit] rid=${rid} error:`, error.message);
    return Response.json({ error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});