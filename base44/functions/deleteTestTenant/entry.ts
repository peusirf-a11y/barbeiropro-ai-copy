// ============================================================================
// deleteTestTenant — Remove COMPLETAMENTE um tenant E2E.
// ============================================================================
//
// Apaga: Company + todas as entidades dependentes do company_id.
// Use em teardown de pipelines (afterAll) ou quando precisar reciclar slugs.
//
// PAYLOAD: { slug?: string = "e2e-barbershop" }
// AUTH: super_admin OU ALLOW_E2E_SEED=true.
// GUARD: slug DEVE começar com "e2e-" — nunca toca em produção.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function purgeEntity(sdk, entityName, filter) {
  let total = 0;
  for (let i = 0; i < 50; i++) {
    const batch = await sdk.entities[entityName].filter(filter, '-created_date', 200).catch(() => []);
    if (!batch || batch.length === 0) break;
    for (const item of batch) {
      try {
        await sdk.entities[entityName].delete(item.id);
        total++;
      } catch (err) {
        console.warn(`[deleteTestTenant] delete ${entityName}/${item.id} falhou:`, err.message);
      }
    }
    if (batch.length < 200) break;
  }
  return total;
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const slug = body.slug || 'e2e-barbershop';

    // Authorization
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
        route: 'deleteTestTenant',
        details: { reason: 'unauthorized_caller', slug },
        blocked: true,
      }).catch(() => {});
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // Slug guard
    if (typeof slug !== 'string' || !slug.startsWith('e2e-')) {
      return Response.json({ ok: false, error: 'slug must start with "e2e-"' }, { status: 400 });
    }

    // Resolve company_id
    const companies = await sdk.entities.Company.filter({ slug }, '-created_date', 1).catch(() => []);
    const company = companies?.[0];
    if (!company) {
      return Response.json({ ok: true, message: 'Tenant não existe — nada a fazer', slug, elapsed_ms: Date.now() - t0 });
    }
    const company_id = company.id;

    // Purge dependentes (mesmo conjunto do reset + tudo que possa referenciar company_id)
    const entities = [
      'Appointment', 'FinancialEntry', 'CashRegister', 'CustomerSubscription',
      'SubscriptionUsage', 'Customer', 'Professional', 'Service', 'ServiceCategory',
      'Unit', 'Review', 'BlockedTime', 'WhatsAppMessage', 'CustomerConsent',
      'PrivacyAuditLog', 'AuditLog', 'AdminAuditLog', 'TeamMember', 'CustomerPlan',
      'SecurityRateLimit', 'UserSession', 'IdempotencyKey', 'SlotReservation',
      'EmailLog', 'UserEvent', 'TotpSession', 'ImpersonationSession',
    ];
    const counts = {};
    for (const e of entities) {
      counts[e] = await purgeEntity(sdk, e, { company_id });
    }

    // Plan privado do E2E (escopo global, sem company_id) — limpa por nome.
    const e2ePlans = await sdk.entities.Plan.filter({ name: '[E2E] Plano Enterprise Teste' }, '-created_date', 10).catch(() => []);
    for (const p of e2ePlans) {
      await sdk.entities.Plan.delete(p.id).catch(() => {});
    }
    counts.Plan = e2ePlans.length;

    // Por fim, a própria Company
    await sdk.entities.Company.delete(company_id);
    counts.Company = 1;

    // Audit final (sem company_id pois ela já não existe)
    await sdk.entities.AuditLog.create({
      actor_email: actor,
      actor_type: 'system',
      action: 'E2E_SEED_DELETED',
      target_type: 'company',
      target_id: company_id,
      severity: 'warning',
      metadata: { slug, mode, counts, elapsed_ms: Date.now() - t0 },
    }).catch(() => {});

    return Response.json({
      ok: true,
      slug,
      company_id,
      actor, mode,
      elapsed_ms: Date.now() - t0,
      deleted: counts,
    });
  } catch (error) {
    console.error('[deleteTestTenant] erro:', error.message);
    return Response.json({ ok: false, error: error.message, elapsed_ms: Date.now() - t0 }, { status: 500 });
  }
});