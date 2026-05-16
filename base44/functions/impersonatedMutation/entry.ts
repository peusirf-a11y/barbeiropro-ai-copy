// impersonatedMutation — Executa mutações em nome de uma empresa via impersonação.
// Valida ImpersonationSession (TTL, super admin, company_id), garante isolamento
// e registra AuditLog com impersonated_company_id.
//
// Payload: { token, company_id, entity, op: 'create'|'update'|'delete', data?, id? }
// Entities permitidas: Customer, Service, ServiceCategory, Professional, Appointment,
//                      FinancialEntry, BlockedTime, ServicePackage, TeamMember, Review,
//                      Company (apenas update de campos não-sensíveis)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_ENTITIES = new Set([
  'Customer', 'Service', 'ServiceCategory', 'Professional', 'Appointment',
  'FinancialEntry', 'BlockedTime', 'ServicePackage', 'TeamMember', 'Review',
  'Company',
]);

// Para Company, só permite atualizar estes campos (nada de status/plano/billing)
const COMPANY_ALLOWED_FIELDS = new Set([
  'name', 'logo_url', 'primary_color', 'secondary_color', 'phone', 'whatsapp',
  'address', 'business_hours', 'whatsapp_settings', 'slug',
]);

// Rate limit persistente no banco (substitui Map volátil em memória)
async function checkPersistentRateLimit(sdk, email, ip) {
  const key = `impersonatedMutation:${email}:${ip}`;
  const now = new Date();
  const windowMs = 60 * 1000; // 1 minuto
  const limit = 60;

  const existing = await sdk.entities.SecurityRateLimit.filter({ key }, '-created_date', 1).catch(() => []);
  const record = existing?.[0];

  if (record?.is_blocked && record?.blocked_until && new Date(record.blocked_until) > now) {
    return false;
  }
  if (record && record.window_end && new Date(record.window_end) > now) {
    const newAttempts = (record.attempts || 0) + 1;
    if (newAttempts >= limit) {
      const blocked_until = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
      await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts, is_blocked: true, blocked_until }).catch(() => {});
      return false;
    }
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts }).catch(() => {});
    return true;
  }
  const window_start = now.toISOString();
  const window_end = new Date(now.getTime() + windowMs).toISOString();
  if (record) {
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: 1, window_start, window_end, is_blocked: false, blocked_until: null }).catch(() => {});
  } else {
    await sdk.entities.SecurityRateLimit.create({ key, route: 'impersonatedMutation', ip, identifier: email, attempts: 1, window_start, window_end, is_blocked: false }).catch(() => {});
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    if (!user.is_super_admin) {
      console.warn('[impersonatedMutation] non-super-admin attempt:', user.email);
      return Response.json({ success: false, error: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    const { token, company_id, entity, op, data, id } = await req.json();
    if (!token || !company_id || !entity || !op) {
      return Response.json({ success: false, error: 'token, company_id, entity e op required' }, { status: 400 });
    }
    if (!ALLOWED_ENTITIES.has(entity)) {
      return Response.json({ success: false, error: 'ENTITY_NOT_ALLOWED' }, { status: 400 });
    }
    if (!await checkPersistentRateLimit(base44.asServiceRole, user.email, ip)) {
      console.warn(`[impersonatedMutation] RATE_LIMITED: ${user.email} ip=${ip}`);
      await base44.asServiceRole.entities.SecurityEvent.create({
        event_type: 'rate_limit_exceeded', severity: 'high',
        actor_email: user.email, ip_address: ip, route: 'impersonatedMutation',
        details: { reason: 'persistent_rate_limit' }, blocked: true,
      }).catch(() => {});
      return Response.json({ success: false, error: 'RATE_LIMIT' }, { status: 429 });
    }

    // Valida sessão de impersonação
    const sessions = await base44.asServiceRole.entities.ImpersonationSession.filter({ token });
    const s = sessions?.[0];
    if (!s) return Response.json({ success: false, error: 'IMPERSONATION_INVALID' }, { status: 401 });
    if (s.ended_at) return Response.json({ success: false, error: 'IMPERSONATION_ENDED' }, { status: 401 });
    if (new Date(s.expires_at).getTime() <= Date.now()) {
      return Response.json({ success: false, error: 'IMPERSONATION_EXPIRED' }, { status: 401 });
    }
    if (s.actor_email !== user.email) {
      return Response.json({ success: false, error: 'IMPERSONATION_USER_MISMATCH' }, { status: 401 });
    }
    if (s.company_id !== company_id) {
      console.warn('[impersonatedMutation] company_id mismatch with session', { user: user.email, session_company: s.company_id, requested_company: company_id });
      return Response.json({ success: false, error: 'IMPERSONATION_COMPANY_MISMATCH' }, { status: 403 });
    }

    const Entity = base44.asServiceRole.entities[entity];
    if (!Entity) return Response.json({ success: false, error: 'ENTITY_NOT_AVAILABLE' }, { status: 400 });

    // Helper local: 404 genérico (não vaza existência cross-tenant)
    const safeGet = async (idToGet) => {
      try { return await Entity.get(idToGet); } catch { return null; }
    };

    let before = null;
    let result = null;

    if (op === 'create') {
      // Força isolamento por company_id — Company não pode ser criada via impersonação
      if (entity === 'Company') {
        return Response.json({ success: false, error: 'COMPANY_CREATE_FORBIDDEN_IN_IMPERSONATION' }, { status: 403 });
      }
      const payload = { ...(data || {}), company_id };
      result = await Entity.create(payload);
    } else if (op === 'update') {
      if (!id) return Response.json({ success: false, error: 'id required' }, { status: 400 });
      const existing = await safeGet(id);
      if (!existing) return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });

      // Isolamento: registro deve pertencer à empresa impersonada
      if (entity === 'Company') {
        if (existing.id !== company_id) {
          console.warn('[impersonatedMutation] cross-tenant company update attempt', { user: user.email, target: existing.id, session: company_id });
          return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
        }
        // Filtra apenas campos permitidos
        const safe = {};
        for (const [k, v] of Object.entries(data || {})) {
          if (COMPANY_ALLOWED_FIELDS.has(k)) safe[k] = v;
        }
        before = { ...existing };
        result = await Entity.update(id, safe);
      } else {
        if (existing.company_id !== company_id) {
          console.warn('[impersonatedMutation] cross-tenant update attempt', { user: user.email, entity, target_company: existing.company_id, session_company: company_id });
          return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
        }
        // Não permite trocar company_id via update
        const { company_id: _ignore, ...safe } = data || {};
        before = { ...existing };
        result = await Entity.update(id, safe);
      }
    } else if (op === 'delete') {
      if (!id) return Response.json({ success: false, error: 'id required' }, { status: 400 });
      if (entity === 'Company') {
        return Response.json({ success: false, error: 'COMPANY_DELETE_FORBIDDEN' }, { status: 403 });
      }
      const existing = await safeGet(id);
      if (!existing) return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
      if (existing.company_id !== company_id) {
        console.warn('[impersonatedMutation] cross-tenant delete attempt', { user: user.email, entity, target_company: existing.company_id, session_company: company_id });
        return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
      }
      before = { ...existing };
      await Entity.delete(id);
      result = { id, deleted: true };
    } else {
      return Response.json({ success: false, error: 'INVALID_OP' }, { status: 400 });
    }

    // AuditLog
    await base44.asServiceRole.entities.AuditLog.create({
      company_id, // P0.5: coluna nativa
      actor_email: user.email,
      actor_is_super_admin: true,
      impersonated_company_id: company_id,
      action: `IMPERSONATED_${op.toUpperCase()}_${entity.toUpperCase()}`,
      target_type: entity,
      target_id: id || result?.id,
      before: before || undefined,
      after: result || undefined,
      ip,
    });

    console.log('[impersonatedMutation] ok', { user: user.email, company_id, entity, op, target_id: id || result?.id });
    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error('[impersonatedMutation] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});