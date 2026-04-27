// endImpersonation — Encerra a sessão de impersonação no servidor.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Super Admin only' }, { status: 403 });
    }

    const { token } = await req.json();
    if (!token) return Response.json({ success: false, error: 'token obrigatório' }, { status: 400 });

    const sessions = await base44.asServiceRole.entities.ImpersonationSession.filter({ token });
    const s = sessions?.[0];
    if (s && !s.ended_at) {
      await base44.asServiceRole.entities.ImpersonationSession.update(s.id, {
        ended_at: new Date().toISOString(),
      });
      await base44.asServiceRole.entities.AuditLog.create({
        actor_email: user.email,
        actor_is_super_admin: true,
        action: 'END_IMPERSONATION',
        target_type: 'Company',
        target_id: s.company_id,
        impersonated_company_id: s.company_id,
      });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error('JOB ERROR: endImpersonation:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});