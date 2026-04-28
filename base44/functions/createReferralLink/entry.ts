// createReferralLink — Cria/recupera o código de indicação único da empresa.
// Reutiliza código existente se já criado (1 código por empresa).
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

function genCode() {
  return 'REF-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);
    if (caller.is_super_admin || !caller.company_id) {
      return Response.json({ success: false, error: 'NO_COMPANY' }, { status: 400 });
    }
    if (caller.role !== 'admin') {
      return Response.json({ success: false, error: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    const sdk = base44.asServiceRole;

    const existing = await sdk.entities.Referral.filter({ company_id: caller.company_id, status: 'pending' }, '-created_date', 1);
    let referral = existing && existing[0];

    if (!referral) {
      // Garante unicidade simples
      let code = genCode();
      for (let i = 0; i < 5; i++) {
        const dup = await sdk.entities.Referral.filter({ code });
        if (!dup || dup.length === 0) break;
        code = genCode();
      }
      referral = await sdk.entities.Referral.create({
        company_id: caller.company_id,
        code,
        status: 'pending',
        reward_type: 'extra_trial_days',
        reward_value: 7,
      });
      try {
        await sdk.entities.UserEvent.create({
          company_id: caller.company_id,
          actor_email: user.email,
          event_type: 'referral_created',
          source: 'backend',
          metadata: { code },
        });
      } catch { /* best effort */ }
    }

    const baseUrl = req.headers.get('origin')
      || `https://${req.headers.get('host') || 'barbertrimly.base44.app'}`;

    return Response.json({
      success: true,
      code: referral.code,
      url: `${baseUrl}/checkout?ref=${referral.code}`,
      reward: { type: referral.reward_type, value: referral.reward_value },
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ success: false, error: error.code }, { status: error.status });
    }
    console.error('[createReferralLink]', error.message);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});