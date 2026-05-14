// audit.js — Endpoint de teste/utilitário para validar o helper de auditoria.
// O helper real está inline nos handlers (logAudit function).
// Este endpoint pode ser usado para smoke test da infraestrutura de auditoria.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !user.is_super_admin) {
      return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // Smoke test: cria um log de auditoria de teste
    const body = await req.json().catch(() => ({}));
    const { dry_run = true } = body;

    const entry = {
      action: 'AUDIT_SMOKE_TEST',
      severity: 'info',
      actor_email: user.email,
      actor_type: 'system',
      actor_is_super_admin: true,
      metadata: { dry_run, ts: new Date().toISOString() },
    };

    if (!dry_run) {
      await base44.asServiceRole.entities.AuditLog.create(entry);
    }

    return Response.json({ ok: true, dry_run, entry });
  } catch (error) {
    console.error('[audit smoke test]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});