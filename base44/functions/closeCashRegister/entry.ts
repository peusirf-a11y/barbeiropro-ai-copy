// Fecha um caixa calculando entradas/saídas no SERVIDOR (fonte da verdade).
// Frontend só envia: register_id e final_amount (saldo contado).
// Backend: busca lançamentos desde a abertura, calcula expected_amount e difference.
//
// HARDENING: RBAC inline com ordem CallerContext → fetch via serviceRole → ensureSameCompany+ensureRole.
// Erros 404 genéricos para não vazar existência de recursos cross-tenant.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// === RBAC helpers (inlined: backend functions são deploy independente) ===
class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}
async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  if (user.is_super_admin) return { role: 'super_admin', is_super_admin: true, email: user.email };
  const tm = await base44.asServiceRole.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  if (tm?.length) {
    if (tm[0].active === false) throw new AuthzError('USER_INACTIVE', 403);
    return { role: tm[0].role, company_id: tm[0].company_id, professional_id: tm[0].professional_id || null, email: user.email };
  }
  const co = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (co?.length) return { role: 'admin', company_id: co[0].id, email: user.email, is_owner: true };
  throw new AuthzError('NO_TEAM_MEMBER', 403);
}
function ensureSameCompany(caller, entity) {
  if (caller.is_super_admin) return;
  if (!entity?.company_id) throw new AuthzError('ENTITY_NO_COMPANY', 400);
  if (caller.company_id !== entity.company_id) throw new AuthzError('FORBIDDEN_TENANT', 403);
}
function ensureRole(caller, allowed) {
  if (caller.is_super_admin) return;
  if (!allowed.includes(caller.role)) throw new AuthzError('FORBIDDEN_ROLE', 403);
}
function authzErrorResponse(error) {
  if (error instanceof AuthzError) return Response.json({ success: false, error: error.code }, { status: error.status });
  return null;
}
const FINANCE_ROLES = ['admin', 'financeiro'];

// 404 genérico — não distingue "não existe" de "existe em outro tenant"
function notFound() {
  return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
}
async function logBlockedAttempt(sdk, { actor_email, action, code, target_id, metadata }) {
  try {
    await sdk.entities.AuditLog.create({
      actor_email: actor_email || 'unknown',
      action: 'BLOCKED_ATTEMPT',
      target_type: 'Function',
      target_id: action,
      metadata: { reason: code, original_target_id: target_id, ...metadata },
    });
  } catch (e) { console.warn('[logBlockedAttempt] failed:', e.message); }
}
async function ensureCompanyNotBlocked(sdk, company_id, user_email, action) {
  if (!company_id) return;
  let co;
  try { co = await sdk.entities.Company.get(company_id); } catch { return; }
  if (!co) return;
  if (co.status === 'blocked' || co.is_blocked_by_billing === true) {
    await logBlockedAttempt(sdk, { actor_email: user_email, action, code: 'COMPANY_BLOCKED', target_id: company_id });
    throw new AuthzError('COMPANY_BLOCKED', 403);
  }
}

Deno.serve(async (req) => {
  console.log('[closeCashRegister] start');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const { register_id, final_amount, notes } = await req.json().catch(() => ({}));
    if (!register_id) return Response.json({ success: false, error: 'register_id required' }, { status: 400 });
    if (typeof final_amount !== 'number' && typeof final_amount !== 'string') {
      return Response.json({ success: false, error: 'final_amount required' }, { status: 400 });
    }

    // ORDEM CORRETA: caller PRIMEIRO, depois fetch via serviceRole, depois RBAC tenant+role
    const caller = await getCallerContext(base44, user);

    let reg;
    try {
      reg = await base44.asServiceRole.entities.CashRegister.get(register_id);
    } catch (_e) {
      return notFound(); // SDK lança 404 quando id não existe — devolve genérico
    }
    if (!reg) return notFound();

    ensureSameCompany(caller, reg);
    ensureRole(caller, FINANCE_ROLES);
    await ensureCompanyNotBlocked(base44.asServiceRole, reg.company_id, user.email, 'closeCashRegister');

    if (reg.status === 'fechado') {
      return Response.json({ success: false, error: 'ALREADY_CLOSED' }, { status: 400 });
    }

    // Busca todos os lançamentos da empresa criados após a abertura do caixa.
    // Em multi-unidade, filtra também pela unidade do caixa (entries sem unit_id são considerados legados/compartilhados).
    const all = await base44.asServiceRole.entities.FinancialEntry.filter({ company_id: reg.company_id }, '-created_date', 1000);
    const since = new Date(reg.opened_at);
    const entries = all.filter(e => {
      const matchTime = new Date(e.created_date || e.date) >= since;
      if (!matchTime) return false;
      if (!reg.unit_id) return true; // caixa legado sem unit_id => pega tudo
      return !e.unit_id || e.unit_id === reg.unit_id;
    });

    const totalIn = entries.filter(e => e.type === 'entrada').reduce((s, e) => s + (e.amount || 0), 0);
    const totalOut = entries.filter(e => e.type === 'saida').reduce((s, e) => s + (e.amount || 0), 0);
    const expected = +((reg.initial_amount || 0) + totalIn - totalOut).toFixed(2);
    const final = +Number(final_amount).toFixed(2);
    const difference = +(final - expected).toFixed(2);

    const updated = await base44.asServiceRole.entities.CashRegister.update(register_id, {
      closed_at: new Date().toISOString(),
      final_amount: final,
      expected_amount: expected,
      difference,
      closed_by: user.email,
      notes: [reg.notes, notes].filter(Boolean).join(' · '),
      status: 'fechado',
    });

    // AuditLog (mutation crítica)
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_email: user.email,
        actor_is_super_admin: !!caller.is_super_admin,
        action: 'CLOSE_CASH_REGISTER',
        target_type: 'CashRegister',
        target_id: register_id,
        before: { status: 'aberto', initial_amount: reg.initial_amount },
        after: { status: 'fechado', final_amount: final, expected_amount: expected, difference },
        metadata: { company_id: reg.company_id, totalIn, totalOut },
      });
    } catch (auditErr) {
      console.warn('[closeCashRegister] audit log failed:', auditErr.message);
    }

    console.log('[closeCashRegister] ok', { user: user.email, company_id: reg.company_id, register_id, expected, final, difference });
    return Response.json({ success: true, register: updated, totals: { totalIn, totalOut, expected, final, difference } });
  } catch (error) {
    const az = authzErrorResponse(error);
    if (az) {
      console.warn('[closeCashRegister] authz blocked:', error.code);
      try {
        const sdk = createClientFromRequest(req).asServiceRole;
        let u = null; try { u = await createClientFromRequest(req).auth.me(); } catch { /* noop */ }
        await logBlockedAttempt(sdk, { actor_email: u?.email, action: 'closeCashRegister', code: error.code });
      } catch (_e) { /* noop */ }
      return az;
    }
    console.error('[closeCashRegister] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});