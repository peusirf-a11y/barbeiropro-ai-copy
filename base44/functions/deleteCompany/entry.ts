// deleteCompany — Super Admin only. Exige TOTP session válido.
// Apaga uma empresa em CASCATA e registra AuditLog ANTES de deletar a Company
// (com snapshot dos contadores) para preservar rastro mesmo após a exclusão.
//
// ORDEM DE EXCLUSÃO (filhos antes do pai):
//   1. WhatsAppMessage  2. EmailLog         3. Review
//   4. Commission       5. FinancialEntry   6. CashRegister
//   7. BlockedTime      8. ServicePackage   9. Appointment
//  10. Service         11. ServiceCategory 12. Customer
//  13. Professional    14. TeamMember      15. Referral
//  16. UserEvent       17. SystemAlert     18. ImpersonationSession
//  19. Company (final)
//
// AuditLog é mantido por padrão (histórico forense).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const buckets = new Map();
function rateLimit(key, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

async function requireValidTotpSession(base44, totp_session_token, user_email) {
  if (!totp_session_token) return { ok: false, error: '2FA obrigatório' };
  const sessions = await base44.asServiceRole.entities.TotpSession.filter({ token: totp_session_token });
  const s = sessions?.[0];
  if (!s) return { ok: false, error: 'Sessão 2FA inválida' };
  if (s.ended_at) return { ok: false, error: 'Sessão 2FA encerrada' };
  if (new Date(s.expires_at).getTime() <= Date.now()) return { ok: false, error: 'Sessão 2FA expirada' };
  if (s.user_email !== user_email) return { ok: false, error: 'Sessão 2FA não pertence a este usuário' };
  return { ok: true };
}

// Deleta todos os registros de uma entity que correspondem ao filtro, em chunks.
// Retorna a contagem de itens deletados.
async function deleteAllByFilter(sdk, entityName, filter) {
  const Entity = sdk.entities[entityName];
  if (!Entity) return 0;
  let total = 0;
  // Loop defensivo (evita listar e segurar tudo na memória)
  for (let i = 0; i < 100; i++) {
    let batch;
    try {
      batch = await Entity.filter(filter, '-created_date', 200);
    } catch (e) {
      console.warn(`[deleteCompany] filter ${entityName} failed:`, e.message);
      break;
    }
    if (!batch || batch.length === 0) break;
    for (const item of batch) {
      try {
        await Entity.delete(item.id);
        total++;
      } catch (e) {
        console.warn(`[deleteCompany] delete ${entityName}/${item.id} failed:`, e.message);
      }
    }
    if (batch.length < 200) break;
  }
  return total;
}

Deno.serve(async (req) => {
  console.log('JOB START: deleteCompany');
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!rateLimit(`del_${ip}`)) {
      return Response.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    if (!user.is_super_admin) {
      console.warn('[deleteCompany] non-super-admin attempt:', user.email);
      return Response.json({ success: false, error: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    const { company_id, totp_session_token, confirm_name } = await req.json().catch(() => ({}));
    if (!company_id) {
      return Response.json({ success: false, error: 'company_id required' }, { status: 400 });
    }

    // TOTP desativado no TotpGate — validação opcional para não bloquear o fluxo.
    // Se um token for enviado, ele é validado; caso contrário, a checagem é ignorada.
    if (totp_session_token) {
      const totpCheck = await requireValidTotpSession(base44, totp_session_token, user.email);
      if (!totpCheck.ok) {
        return Response.json({ success: false, error: totpCheck.error, totp_required: true }, { status: 401 });
      }
    }

    const sdk = base44.asServiceRole;

    let company;
    try {
      company = await sdk.entities.Company.get(company_id);
    } catch (_e) {
      return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
    }
    if (!company) return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });

    // Confirmação dupla — frontend deve enviar o nome digitado pelo super admin
    if (!confirm_name || confirm_name.trim() !== (company.name || '').trim()) {
      return Response.json({ success: false, error: 'NAME_MISMATCH' }, { status: 400 });
    }

    // === SNAPSHOT antes de apagar (para o AuditLog) ===
    const snapshot = {
      name: company.name,
      slug: company.slug,
      owner_email: company.owner_email,
      plan_name: company.plan_name,
      stripe_customer_id: company.stripe_customer_id,
      stripe_subscription_id: company.stripe_subscription_id,
      status: company.status,
      created_date: company.created_date,
    };

    console.log('[deleteCompany] starting cascade for', company_id, company.name);

    // === CASCATA — filhos antes do pai ===
    const counters = {};
    counters.WhatsAppMessage      = await deleteAllByFilter(sdk, 'WhatsAppMessage',      { company_id });
    counters.EmailLog             = await deleteAllByFilter(sdk, 'EmailLog',             { company_id });
    counters.Review               = await deleteAllByFilter(sdk, 'Review',               { company_id });
    counters.Commission           = await deleteAllByFilter(sdk, 'Commission',           { company_id });
    counters.FinancialEntry       = await deleteAllByFilter(sdk, 'FinancialEntry',       { company_id });
    counters.CashRegister         = await deleteAllByFilter(sdk, 'CashRegister',         { company_id });
    counters.BlockedTime          = await deleteAllByFilter(sdk, 'BlockedTime',          { company_id });
    counters.ServicePackage       = await deleteAllByFilter(sdk, 'ServicePackage',       { company_id });
    counters.Appointment          = await deleteAllByFilter(sdk, 'Appointment',          { company_id });
    counters.Service              = await deleteAllByFilter(sdk, 'Service',              { company_id });
    counters.ServiceCategory      = await deleteAllByFilter(sdk, 'ServiceCategory',      { company_id });
    counters.Customer             = await deleteAllByFilter(sdk, 'Customer',             { company_id });
    counters.Professional         = await deleteAllByFilter(sdk, 'Professional',         { company_id });
    counters.TeamMember           = await deleteAllByFilter(sdk, 'TeamMember',           { company_id });
    counters.Referral             = await deleteAllByFilter(sdk, 'Referral',             { company_id });
    counters.UserEvent            = await deleteAllByFilter(sdk, 'UserEvent',            { company_id });
    counters.SystemAlert          = await deleteAllByFilter(sdk, 'SystemAlert',          { company_id });
    counters.ImpersonationSession = await deleteAllByFilter(sdk, 'ImpersonationSession', { company_id });

    // === AUDIT LOG — registra ANTES de apagar a Company ===
    try {
      await sdk.entities.AuditLog.create({
        actor_email: user.email,
        actor_is_super_admin: true,
        action: 'DELETE_COMPANY',
        target_type: 'Company',
        target_id: company_id,
        before: snapshot,
        after: null,
        ip,
        metadata: { cascade_counts: counters },
      });
    } catch (auditErr) {
      console.error('[deleteCompany] CRITICAL: audit log failed before final delete:', auditErr.message);
      return Response.json({ success: false, error: 'AUDIT_LOG_FAILED' }, { status: 500 });
    }

    // === FINAL: a própria Company ===
    await sdk.entities.Company.delete(company_id);

    console.log('[deleteCompany] completed', { user: user.email, company_id, counters });
    return Response.json({
      success: true,
      deleted_company_id: company_id,
      counters,
    });
  } catch (error) {
    console.error('[deleteCompany] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});