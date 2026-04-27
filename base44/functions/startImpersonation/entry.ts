// startImpersonation — Super Admin only. Valida e registra início de impersonação.
// Não emite token de sessão da empresa (o frontend usa o estado local + leitura
// "as service role" via outras rotas se necessário). Aqui só validamos + log.
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
  console.log('JOB START: startImpersonation');
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`imp_${ip}`)) {
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

    const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.AuditLog.create({
      actor_email: user.email,
      actor_is_super_admin: true,
      action: 'START_IMPERSONATION',
      target_type: 'Company',
      target_id: company_id,
      ip,
      metadata: { company_name: company.name, expires_at, reason: reason || null },
    });

    return Response.json({
      success: true,
      company_id,
      company_name: company.name,
      expires_at,
    });
  } catch (error) {
    console.error('JOB ERROR: startImpersonation:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});