// generatePlanInvite — Gera (ou regenera) um invite_token para um Plan ou CustomerPlan.
//
// Payload: { entity: 'Plan' | 'CustomerPlan', plan_id, expires_in_days?, max_uses? }
//
// RBAC:
//   - entity='Plan'         → apenas super_admin (planos da plataforma SaaS)
//   - entity='CustomerPlan' → admin do tenant dono do plano OU super_admin
//
// Side effects: força visibility='invite_only', gera token novo, reseta invite_uses_count.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

function genToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function resolveCaller(base44, user) {
  if (user.is_super_admin) return { role: 'super_admin', is_super_admin: true, email: user.email };
  const tm = await base44.asServiceRole.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  if (tm?.[0]?.active !== false && tm?.[0]) {
    return { role: tm[0].role, company_id: tm[0].company_id, email: user.email };
  }
  const co = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (co?.[0]) return { role: 'admin', company_id: co[0].id, email: user.email, is_owner: true };
  throw new AuthzError('NO_TEAM_MEMBER', 403);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.email) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await resolveCaller(base44, user);
    const body = await req.json().catch(() => ({}));
    const { entity, plan_id, expires_in_days, max_uses } = body || {};

    if (!['Plan', 'CustomerPlan'].includes(entity)) {
      return Response.json({ success: false, error: 'INVALID_ENTITY' }, { status: 400 });
    }
    if (!plan_id) return Response.json({ success: false, error: 'plan_id required' }, { status: 400 });

    let plan;
    try { plan = await base44.asServiceRole.entities[entity].get(plan_id); }
    catch { return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 }); }

    // RBAC por entity
    if (entity === 'Plan') {
      if (!caller.is_super_admin) throw new AuthzError('FORBIDDEN', 403);
    } else {
      if (!caller.is_super_admin) {
        if (caller.role !== 'admin' || plan.company_id !== caller.company_id) {
          throw new AuthzError('FORBIDDEN', 403);
        }
      }
    }

    const token = genToken();
    const updatePayload = {
      visibility: 'invite_only',
      invite_token: token,
      invite_uses_count: 0,
    };
    if (Number(expires_in_days) > 0) {
      const exp = new Date(Date.now() + Number(expires_in_days) * 86400_000);
      updatePayload.invite_token_expires_at = exp.toISOString();
    } else {
      updatePayload.invite_token_expires_at = null;
    }
    if (Number(max_uses) > 0) updatePayload.invite_max_uses = Number(max_uses);
    else updatePayload.invite_max_uses = null;

    await base44.asServiceRole.entities[entity].update(plan_id, updatePayload);

    // Audit
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_email: user.email,
        actor_is_super_admin: !!caller.is_super_admin,
        action: 'PLAN_INVITE_GENERATED',
        target_type: entity,
        target_id: plan_id,
        metadata: {
          plan_name: plan.name,
          expires_in_days: expires_in_days || null,
          max_uses: max_uses || null,
        },
        severity: 'info',
      });
    } catch (_e) { /* ignore */ }

    return Response.json({
      success: true,
      token,
      expires_at: updatePayload.invite_token_expires_at,
      max_uses: updatePayload.invite_max_uses,
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ success: false, error: error.code }, { status: error.status });
    }
    console.error('[generatePlanInvite] error:', error?.message);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});