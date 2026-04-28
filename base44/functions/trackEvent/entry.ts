// trackEvent — Frontend chama esta função para registrar UserEvent.
// SEGURANÇA: tenant-locked via RBAC inline. event_type é validado contra whitelist
// para impedir clientes inflarem dados ou criarem eventos restritos a backend.
//
// Frontend usage:
//   await base44.functions.invoke('trackEvent', { event_type: 'onboarding_started' });
//
// Eventos restritos a backend (NÃO podem vir do frontend):
//   first_appointment, first_payment, first_commission,
//   campaign_d1_sent, campaign_d3_sent, campaign_d7_sent
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
  if (co?.length) return { role: 'admin', company_id: co[0].id, email: user.email };
  throw new AuthzError('NO_TEAM_MEMBER', 403);
}

const FRONTEND_ALLOWED = new Set([
  'onboarding_started',
  'onboarding_step_completed',
  'onboarding_completed',
  'upsell_shown',
  'upsell_clicked',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);
    const { event_type, metadata } = await req.json().catch(() => ({}));

    if (!event_type) return Response.json({ success: false, error: 'event_type required' }, { status: 400 });
    if (!FRONTEND_ALLOWED.has(event_type)) {
      return Response.json({ success: false, error: 'EVENT_TYPE_NOT_ALLOWED_FROM_FRONTEND' }, { status: 403 });
    }

    if (caller.is_super_admin) {
      return Response.json({ success: false, error: 'SUPER_ADMIN_CANNOT_TRACK' }, { status: 403 });
    }
    if (!caller.company_id) {
      return Response.json({ success: false, error: 'NO_COMPANY' }, { status: 400 });
    }

    const ev = await base44.asServiceRole.entities.UserEvent.create({
      company_id: caller.company_id,
      actor_email: user.email,
      event_type,
      metadata: metadata || {},
      source: 'frontend',
    });

    return Response.json({ success: true, id: ev.id });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ success: false, error: error.code }, { status: error.status });
    }
    console.error('[trackEvent] error:', error.message);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});