// ============================================================================
// resetTestTenant — Atalho de conveniência para reset completo do tenant E2E.
// ============================================================================
//
// Equivale a chamar seedTestTenant com reset=true.
// Mantido como function separada para clareza de intenção em pipelines CI.
//
// PAYLOAD: { slug?: string = "e2e-barbershop" }
// AUTH: super_admin OU ALLOW_E2E_SEED=true (mesma política do seed).
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const slug = body.slug || 'e2e-barbershop';

    // Authorization gate (mesma do seed)
    let isAuthorized = false;
    let actor = 'env:ALLOW_E2E_SEED';
    let mode = 'env_flag';
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin') {
        isAuthorized = true;
        actor = user.email;
        mode = 'super_admin';
      }
    } catch { /* sem sessão */ }
    if (!isAuthorized && Deno.env.get('ALLOW_E2E_SEED') === 'true') {
      isAuthorized = true;
    }
    if (!isAuthorized) {
      await sdk.entities.SecurityEvent.create({
        event_type: 'privilege_escalation_attempt',
        severity: 'critical',
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
        route: 'resetTestTenant',
        details: { reason: 'unauthorized_caller', slug },
        blocked: true,
      }).catch(() => {});
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    if (typeof slug !== 'string' || !slug.startsWith('e2e-')) {
      return Response.json({ ok: false, error: 'slug must start with "e2e-"' }, { status: 400 });
    }

    // Delega para seedTestTenant via invoke. Single source of truth.
    const res = await base44.asServiceRole.functions.invoke('seedTestTenant', { slug, reset: true });

    return Response.json({
      ok: true,
      elapsed_ms: Date.now() - t0,
      actor, mode,
      delegated_to: 'seedTestTenant',
      seed_result: res?.data || res,
    });
  } catch (error) {
    console.error('[resetTestTenant] erro:', error.message);
    return Response.json({ ok: false, error: error.message, elapsed_ms: Date.now() - t0 }, { status: 500 });
  }
});