// backfillAuditLogCompanyId — P0.5 one-off (idempotente).
//
// Antes do P0.5, AuditLog gravava company_id apenas em `metadata.company_id`.
// Agora `company_id` é coluna nativa indexada. Este job:
//   1. Lista AuditLog onde company_id é null/ausente.
//   2. Tenta inferir company_id de:
//      a) metadata.company_id (caminho comum)
//      b) impersonated_company_id (impersonação)
//      c) target_id quando target_type='Company' (BLOCK/ACTIVATE_COMPANY)
//   3. Atualiza apenas o campo company_id (sem tocar nada mais).
//
// IDEMPOTENTE: re-rodar não faz nada se todos já tiverem company_id preenchido.
// ADMIN-ONLY: só super-admin pode invocar.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BATCH_LIMIT = 500;

function inferCompanyId(log) {
  if (log.company_id) return log.company_id; // já tem (idempotência)
  const meta = log.metadata || {};
  if (meta.company_id) return meta.company_id;
  if (log.impersonated_company_id) return log.impersonated_company_id;
  if (log.target_type === 'Company' && log.target_id) return log.target_id;
  return null;
}

Deno.serve(async (req) => {
  console.log('[backfillAuditLogCompanyId] start');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (!user.is_super_admin) {
      console.warn('[backfillAuditLogCompanyId] non-super-admin attempt:', user.email);
      return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { dry_run = false, limit = BATCH_LIMIT } = await req.json().catch(() => ({}));
    const sdk = base44.asServiceRole;

    // Busca registros SEM company_id (Base44: filter por null funciona em campos opcionais).
    const candidates = await sdk.entities.AuditLog.filter({ company_id: null }, '-created_date', limit);
    console.log('[backfillAuditLogCompanyId] candidates:', candidates.length, 'dry_run:', dry_run);

    const stats = { total: candidates.length, updated: 0, skipped_no_inference: 0, errors: 0, samples: [] };

    for (const log of candidates) {
      const inferred = inferCompanyId(log);
      if (!inferred) {
        stats.skipped_no_inference += 1;
        if (stats.samples.length < 5) stats.samples.push({ id: log.id, action: log.action, reason: 'no_inference' });
        continue;
      }
      if (dry_run) {
        stats.updated += 1;
        if (stats.samples.length < 5) stats.samples.push({ id: log.id, action: log.action, would_set: inferred });
        continue;
      }
      try {
        await sdk.entities.AuditLog.update(log.id, { company_id: inferred });
        stats.updated += 1;
      } catch (err) {
        stats.errors += 1;
        console.error('[backfillAuditLogCompanyId] update failed:', log.id, err.message);
      }
    }

    console.log('[backfillAuditLogCompanyId] done:', stats);
    return Response.json({ success: true, ...stats });
  } catch (error) {
    console.error('[backfillAuditLogCompanyId] error:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});