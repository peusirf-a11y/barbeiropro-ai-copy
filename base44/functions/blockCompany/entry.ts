// blockCompany — Super Admin only. Bloqueia uma empresa e grava AuditLog.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const buckets = new Map();
function rateLimit(key, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

Deno.serve(async (req) => {
  console.log('JOB START: blockCompany');
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`block_${ip}`)) {
      return Response.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Unauthorized: Super Admin only' }, { status: 403 });
    }

    const { company_id, reason } = await req.json();
    if (!company_id) {
      return Response.json({ success: false, error: 'company_id é obrigatório' }, { status: 400 });
    }

    const company = await base44.asServiceRole.entities.Company.get(company_id);
    if (!company) {
      return Response.json({ success: false, error: 'Empresa não encontrada' }, { status: 404 });
    }

    const before = { status: company.status };
    await base44.asServiceRole.entities.Company.update(company_id, { status: 'blocked' });
    const after = { status: 'blocked' };

    await base44.asServiceRole.entities.AuditLog.create({
      actor_email: user.email,
      actor_is_super_admin: true,
      action: 'BLOCK_COMPANY',
      target_type: 'Company',
      target_id: company_id,
      before,
      after,
      ip,
      metadata: reason ? { reason } : undefined,
    });

    // Alerta para visibilidade no painel Master
    try {
      await base44.asServiceRole.entities.SystemAlert.create({
        type: 'company_blocked',
        severity: 'warning',
        message: `Empresa "${company.name}" bloqueada manualmente por ${user.email}`,
        company_id,
        metadata: reason ? { reason } : undefined,
      });
    } catch (alertErr) {
      console.error('Falha ao criar SystemAlert:', alertErr.message);
    }

    console.log(`JOB END: blockCompany ${company_id} by ${user.email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('JOB ERROR: blockCompany:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});