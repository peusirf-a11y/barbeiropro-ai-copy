// Devolve eventos de auditoria do módulo Caixa para a página dedicada (Fase 4).
// Combina três fontes:
//   1) AuditLog com action ∈ EDIT_FINANCIAL_ENTRY, DELETE_FINANCIAL_ENTRY, CLOSE_CASH_REGISTER, BLOCKED_ATTEMPT
//   2) CashRegister: abertura (opened_at/opened_by) e fechamento (closed_at/closed_by) — para registros antigos sem AuditLog
//   3) FinancialEntry: sangrias/suprimentos (sempre auditáveis) — usa created_by/justification
//
// Filtros (payload): { from, to, unit_id?, actor_email?, action? }
// RBAC: somente caps view_audit. Isolamento multi-unidade aplicado se caller não for admin/financeiro.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

const ROLE_DEFAULTS_AUDIT = { admin: true, financeiro: true, recepcao: false, barbeiro: false };
const CROSS_UNIT_ROLES = ['admin', 'financeiro', 'super_admin'];

function hasViewAudit(caller) {
  if (caller.is_super_admin) return true;
  const o = caller.cash_permissions || {};
  if (typeof o.view_audit === 'boolean') return o.view_audit;
  return !!ROLE_DEFAULTS_AUDIT[caller.role];
}
function canAccessUnit(caller, unit_id) {
  if (caller.is_super_admin) return true;
  if (CROSS_UNIT_ROLES.includes(caller.role)) return true;
  const allowed = caller.unit_ids || [];
  if (!allowed.length) return true;
  if (!unit_id) return true;
  return allowed.includes(unit_id);
}

async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  if (user.is_super_admin) return { role: 'super_admin', is_super_admin: true, email: user.email };
  const tm = await base44.asServiceRole.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  if (tm?.length) {
    if (tm[0].active === false) throw new AuthzError('USER_INACTIVE', 403);
    return {
      role: tm[0].role,
      company_id: tm[0].company_id,
      email: user.email,
      cash_permissions: tm[0].cash_permissions || null,
      unit_ids: tm[0].unit_ids || [],
    };
  }
  const co = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (co?.length) return { role: 'admin', company_id: co[0].id, email: user.email, is_owner: true };
  throw new AuthzError('NO_TEAM_MEMBER', 403);
}

Deno.serve(async (req) => {
  console.log('[getCashAudit] start');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const { from, to, unit_id, actor_email, action } = await req.json().catch(() => ({}));
    const caller = await getCallerContext(base44, user);

    if (!hasViewAudit(caller)) {
      return Response.json({ success: false, error: 'FORBIDDEN_CAP' }, { status: 403 });
    }
    if (!caller.company_id && !caller.is_super_admin) {
      return Response.json({ success: false, error: 'NO_COMPANY' }, { status: 403 });
    }

    const fromT = from ? new Date(from).getTime() : null;
    const toT   = to   ? new Date(to).getTime()   : null;
    const inRange = (iso) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      if (fromT != null && t < fromT) return false;
      if (toT   != null && t > toT)   return false;
      return true;
    };

    // 1) AuditLog — filtra por company via metadata.company_id (não há tenant nativo)
    const audits = await base44.asServiceRole.entities.AuditLog.filter({}, '-created_date', 1000);
    const events = [];

    const CASH_ACTIONS = new Set([
      'EDIT_FINANCIAL_ENTRY', 'DELETE_FINANCIAL_ENTRY', 'CLOSE_CASH_REGISTER', 'BLOCKED_ATTEMPT',
    ]);

    for (const a of audits) {
      if (!CASH_ACTIONS.has(a.action)) continue;
      const meta = a.metadata || {};
      const cId = meta.company_id;
      if (!caller.is_super_admin && cId !== caller.company_id) continue;
      const ts = a.created_date;
      if (!inRange(ts)) continue;
      if (actor_email && a.actor_email !== actor_email) continue;
      if (action && a.action !== action) continue;
      const unit = meta.unit_id || null;
      if (unit_id && unit !== unit_id) continue;
      if (!canAccessUnit(caller, unit)) continue;
      events.push({
        id: `audit-${a.id}`,
        kind: 'audit',
        action: a.action,
        actor_email: a.actor_email,
        timestamp: ts,
        target_type: a.target_type,
        target_id: a.target_id,
        before: a.before || null,
        after: a.after || null,
        unit_id: unit,
        cash_register_id: meta.cash_register_id || null,
        metadata: meta,
      });
    }

    // 2) CashRegister — abertura/fechamento
    if (caller.company_id || caller.is_super_admin) {
      const regs = await base44.asServiceRole.entities.CashRegister.filter(
        caller.is_super_admin ? {} : { company_id: caller.company_id },
        '-opened_at',
        500
      );
      for (const r of regs) {
        if (unit_id && r.unit_id !== unit_id) continue;
        if (!canAccessUnit(caller, r.unit_id)) continue;
        if (inRange(r.opened_at) && (!actor_email || r.opened_by === actor_email) && (!action || action === 'OPEN_CASH_REGISTER')) {
          events.push({
            id: `open-${r.id}`,
            kind: 'register',
            action: 'OPEN_CASH_REGISTER',
            actor_email: r.opened_by || 'unknown',
            timestamp: r.opened_at,
            target_type: 'CashRegister',
            target_id: r.id,
            after: { initial_amount: r.initial_amount },
            unit_id: r.unit_id || null,
            cash_register_id: r.id,
          });
        }
        if (r.closed_at && inRange(r.closed_at) && (!actor_email || r.closed_by === actor_email) && (!action || action === 'CLOSE_CASH_REGISTER')) {
          events.push({
            id: `close-${r.id}`,
            kind: 'register',
            action: 'CLOSE_CASH_REGISTER',
            actor_email: r.closed_by || 'unknown',
            timestamp: r.closed_at,
            target_type: 'CashRegister',
            target_id: r.id,
            after: { final_amount: r.final_amount, expected_amount: r.expected_amount, difference: r.difference },
            unit_id: r.unit_id || null,
            cash_register_id: r.id,
          });
        }
      }
    }

    // 3) FinancialEntry — sangrias/suprimentos como evento "criado"
    if (caller.company_id || caller.is_super_admin) {
      const entries = await base44.asServiceRole.entities.FinancialEntry.filter(
        caller.is_super_admin ? {} : { company_id: caller.company_id },
        '-created_date',
        1000
      );
      for (const e of entries) {
        const kind = e.entry_kind || (e.type === 'saida' ? 'saida' : 'entrada');
        if (kind !== 'sangria' && kind !== 'suprimento') continue;
        if (!inRange(e.created_date)) continue;
        const actName = kind === 'sangria' ? 'SANGRIA' : 'SUPRIMENTO';
        if (action && action !== actName) continue;
        if (actor_email && e.created_by !== actor_email) continue;
        if (unit_id && e.unit_id !== unit_id) continue;
        if (!canAccessUnit(caller, e.unit_id)) continue;
        events.push({
          id: `entry-${e.id}`,
          kind: 'entry',
          action: actName,
          actor_email: e.created_by || 'unknown',
          timestamp: e.created_date,
          target_type: 'FinancialEntry',
          target_id: e.id,
          after: { amount: e.amount, justification: e.justification, payment_method: e.payment_method },
          unit_id: e.unit_id || null,
          cash_register_id: e.cash_register_id || null,
        });
      }
    }

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    console.log('[getCashAudit] ok', { user: user.email, count: events.length });
    return Response.json({ success: true, events });
  } catch (error) {
    if (error instanceof AuthzError) {
      console.warn('[getCashAudit] authz blocked:', error.code);
      return Response.json({ success: false, error: error.code }, { status: error.status });
    }
    console.error('[getCashAudit] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});