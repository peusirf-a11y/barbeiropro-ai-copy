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

const buckets = new Map();
function rateLimit(key, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

Deno.serve(async (req) => {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Super Admin only' }, { status: 403 });
    }

    const { token, company_id, entity, op, data, id } = await req.json();
    if (!token || !company_id || !entity || !op) {
      return Response.json({ success: false, error: 'token, company_id, entity e op são obrigatórios' }, { status: 400 });
    }
    if (!ALLOWED_ENTITIES.has(entity)) {
      return Response.json({ success: false, error: `Entity ${entity} não permitida` }, { status: 400 });
    }
    if (!rateLimit(`imp_mut_${user.email}`)) {
      return Response.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Valida sessão de impersonação
    const sessions = await base44.asServiceRole.entities.ImpersonationSession.filter({ token });
    const s = sessions?.[0];
    if (!s) return Response.json({ success: false, error: 'Sessão de impersonação inválida' }, { status: 401 });
    if (s.ended_at) return Response.json({ success: false, error: 'Sessão encerrada' }, { status: 401 });
    if (new Date(s.expires_at).getTime() <= Date.now()) {
      return Response.json({ success: false, error: 'Sessão expirada' }, { status: 401 });
    }
    if (s.actor_email !== user.email) {
      return Response.json({ success: false, error: 'Sessão não pertence a este usuário' }, { status: 401 });
    }
    if (s.company_id !== company_id) {
      return Response.json({ success: false, error: 'company_id divergente da sessão' }, { status: 403 });
    }

    const Entity = base44.asServiceRole.entities[entity];
    if (!Entity) return Response.json({ success: false, error: `Entity ${entity} não disponível` }, { status: 400 });

    let before = null;
    let result = null;

    if (op === 'create') {
      // Força isolamento por company_id (exceto a própria Company)
      const payload = entity === 'Company'
        ? { ...(data || {}) }
        : { ...(data || {}), company_id };
      result = await Entity.create(payload);
    } else if (op === 'update') {
      if (!id) return Response.json({ success: false, error: 'id obrigatório para update' }, { status: 400 });
      const existing = await Entity.get(id);
      if (!existing) return Response.json({ success: false, error: 'Registro não encontrado' }, { status: 404 });

      // Isolamento: registro deve pertencer à empresa impersonada
      if (entity === 'Company') {
        if (existing.id !== company_id) {
          return Response.json({ success: false, error: 'Tentativa de editar outra empresa' }, { status: 403 });
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
          return Response.json({ success: false, error: 'Registro não pertence à empresa' }, { status: 403 });
        }
        // Não permite trocar company_id via update
        const { company_id: _ignore, ...safe } = data || {};
        before = { ...existing };
        result = await Entity.update(id, safe);
      }
    } else if (op === 'delete') {
      if (!id) return Response.json({ success: false, error: 'id obrigatório para delete' }, { status: 400 });
      if (entity === 'Company') {
        return Response.json({ success: false, error: 'Delete de Company não permitido via impersonação' }, { status: 403 });
      }
      const existing = await Entity.get(id);
      if (!existing) return Response.json({ success: false, error: 'Registro não encontrado' }, { status: 404 });
      if (existing.company_id !== company_id) {
        return Response.json({ success: false, error: 'Registro não pertence à empresa' }, { status: 403 });
      }
      before = { ...existing };
      await Entity.delete(id);
      result = { id, deleted: true };
    } else {
      return Response.json({ success: false, error: `op ${op} inválido` }, { status: 400 });
    }

    // AuditLog
    await base44.asServiceRole.entities.AuditLog.create({
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

    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error('JOB ERROR: impersonatedMutation:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});