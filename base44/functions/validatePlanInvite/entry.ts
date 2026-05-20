// validatePlanInvite — Consome um invite_token e libera o plano (Plan ou CustomerPlan)
// para o ator que apresentou o token.
//
// Payload: { kind: 'platform' | 'customer', token: string, customer_token?: string, slug?: string }
//   - kind='platform': consumidor é uma Company (tenant SaaS). Caller deve ser admin/owner autenticado.
//   - kind='customer': consumidor é um Customer (cliente da barbearia). Caller usa customer_token + slug.
//
// Fluxo:
//   1) Busca o plano por invite_token (somente service role)
//   2) Valida (visibility=invite_only + token + expira + max_uses)
//   3) Adiciona company_id/customer_id ao allowed_*_ids e incrementa uses_count (atômico via re-read)
//   4) Auditoria + SecurityEvent em caso de falha
//   5) Retorna { success, plan: { id, name, price_monthly } }
//
// Importante: NUNCA retorna dados do plano se a validação falhar (anti-enumeração).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class ValidationError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}

async function logSecurityEvent(base44, { event_type, severity, details, actor_email, ip, route }) {
  try {
    await base44.asServiceRole.entities.SecurityEvent.create({
      event_type, severity: severity || 'medium',
      actor_email, ip_address: ip, route,
      details: details || {}, blocked: true,
    });
  } catch (_e) { /* nunca quebrar por log */ }
}

async function logAudit(base44, { actor_email, action, target_id, metadata }) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      actor_email, action, target_type: 'Plan',
      target_id, metadata: metadata || {},
      severity: 'info', actor_type: 'user',
    });
  } catch (_e) { /* idem */ }
}

function validateLogic(plan, token) {
  if (!plan) return { valid: false, reason: 'not_found' };
  if (plan.visibility !== 'invite_only') return { valid: false, reason: 'not_invite_only' };
  if (!plan.invite_token || plan.invite_token !== token) return { valid: false, reason: 'token_mismatch' };
  if (plan.invite_token_expires_at && new Date(plan.invite_token_expires_at) < new Date()) {
    return { valid: false, reason: 'expired' };
  }
  const max = Number(plan.invite_max_uses || 0);
  const used = Number(plan.invite_uses_count || 0);
  if (max > 0 && used >= max) return { valid: false, reason: 'max_uses_reached' };
  return { valid: true };
}

Deno.serve(async (req) => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '';
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { kind, token, customer_token, slug } = body || {};

    if (!token || typeof token !== 'string' || token.length < 8) {
      throw new ValidationError('INVALID_TOKEN', 400);
    }
    if (!['platform', 'customer'].includes(kind)) {
      throw new ValidationError('INVALID_KIND', 400);
    }

    // Resolve quem está consumindo o invite.
    let actor_email = null;
    let company_id = null;
    let customer_id = null;
    let entityName = null;

    if (kind === 'platform') {
      const user = await base44.auth.me().catch(() => null);
      if (!user?.email) {
        await logSecurityEvent(base44, { event_type: 'invalid_token', severity: 'low',
          details: { reason: 'unauthenticated', token_prefix: token.slice(0, 6) }, ip, route: 'validatePlanInvite' });
        throw new ValidationError('UNAUTHORIZED', 401);
      }
      actor_email = user.email;
      // Resolve Company do caller (admin/owner)
      const tm = await base44.asServiceRole.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
      if (tm?.[0]?.active !== false && tm?.[0]?.company_id) {
        company_id = tm[0].company_id;
      } else {
        const co = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
        if (co?.[0]) company_id = co[0].id;
      }
      if (!company_id) throw new ValidationError('NO_COMPANY', 403);
      entityName = 'Plan';
    } else {
      // kind=customer: precisa de slug + customer_token
      if (!slug || !customer_token) throw new ValidationError('MISSING_CUSTOMER_AUTH', 400);
      const companies = await base44.asServiceRole.entities.Company.filter({ slug });
      const company = companies[0];
      if (!company) throw new ValidationError('COMPANY_NOT_FOUND', 404);
      const customers = await base44.asServiceRole.entities.Customer.filter({
        company_id: company.id, auth_token: customer_token,
      });
      const customer = customers[0];
      if (!customer) throw new ValidationError('CUSTOMER_AUTH_EXPIRED', 401);
      if (customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) < new Date()) {
        throw new ValidationError('CUSTOMER_AUTH_EXPIRED', 401);
      }
      actor_email = customer.email || '';
      company_id = company.id;
      customer_id = customer.id;
      entityName = 'CustomerPlan';
    }

    // Busca o plano por invite_token usando service role (single point of trust).
    // Aceita só prefixos longos pra evitar enumeração trivial.
    const candidates = await base44.asServiceRole.entities[entityName].filter({ invite_token: token });
    const plan = candidates[0];
    const v = validateLogic(plan, token);
    if (!v.valid) {
      await logSecurityEvent(base44, {
        event_type: v.reason === 'expired' ? 'invalid_token' : (v.reason === 'max_uses_reached' ? 'rate_limit_exceeded' : 'invalid_token'),
        severity: 'medium',
        actor_email,
        ip, route: 'validatePlanInvite',
        details: { reason: v.reason, kind, token_prefix: token.slice(0, 6) },
      });
      // Mensagem genérica pro frontend (não expor reason fine-grained)
      throw new ValidationError(v.reason === 'expired' ? 'INVITE_EXPIRED' : 'INVALID_INVITE', 403);
    }

    // Para CustomerPlan, o invite só vale dentro do tenant correto.
    if (kind === 'customer' && plan.company_id !== company_id) {
      await logSecurityEvent(base44, {
        event_type: 'cross_tenant_attempt', severity: 'high',
        actor_email, ip, route: 'validatePlanInvite',
        details: { plan_id: plan.id, plan_company_id: plan.company_id, caller_company_id: company_id },
      });
      throw new ValidationError('INVALID_INVITE', 403);
    }

    // Adiciona ao allowed list (idempotente) e incrementa contador.
    const updatePayload = {
      invite_uses_count: Number(plan.invite_uses_count || 0) + 1,
    };
    if (kind === 'platform') {
      const list = Array.isArray(plan.allowed_company_ids) ? plan.allowed_company_ids : [];
      if (!list.includes(company_id)) updatePayload.allowed_company_ids = [...list, company_id];
    } else {
      const list = Array.isArray(plan.allowed_customer_ids) ? plan.allowed_customer_ids : [];
      if (!list.includes(customer_id)) updatePayload.allowed_customer_ids = [...list, customer_id];
    }
    await base44.asServiceRole.entities[entityName].update(plan.id, updatePayload);

    await logAudit(base44, {
      actor_email, action: 'PLAN_INVITE_CONSUMED', target_id: plan.id,
      metadata: { kind, company_id, customer_id, plan_name: plan.name },
    });

    return Response.json({
      success: true,
      plan: {
        id: plan.id,
        name: plan.name,
        price_monthly: plan.price_monthly,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ success: false, error: error.code }, { status: error.status });
    }
    console.error('[validatePlanInvite] error:', error?.message);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});