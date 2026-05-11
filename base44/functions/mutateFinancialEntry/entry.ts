// Edita ou exclui (soft-delete) um FinancialEntry com:
// - RBAC + permissões granulares (cash_permissions)
// - Isolamento multi-unidade (TeamMember.unit_ids)
// - Bloqueio para origens 'agendamento' e 'comissao' (fonte da verdade do sistema)
// - Audit log (quem, quando, antes/depois, motivo)
//
// Payload: { action: 'edit'|'delete', entry_id, patch?, reason? }
// - edit:   patch pode conter { amount, category, description, payment_method, justification }
// - delete: reason é obrigatório

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

// ── Defaults de cash_permissions por role (espelha lib/cashPermissions.js) ──
const ROLE_DEFAULTS = {
  admin:      { edit_entry: true,  delete_entry: true },
  financeiro: { edit_entry: true,  delete_entry: true },
  recepcao:   { edit_entry: false, delete_entry: false },
  barbeiro:   { edit_entry: false, delete_entry: false },
};
const CROSS_UNIT_ROLES = ['admin', 'financeiro', 'super_admin'];

function hasCap(caller, cap) {
  if (caller.is_super_admin) return true;
  const overrides = caller.cash_permissions || {};
  if (typeof overrides[cap] === 'boolean') return overrides[cap];
  return !!(ROLE_DEFAULTS[caller.role] || {})[cap];
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
function ensureSameCompany(caller, entity) {
  if (caller.is_super_admin) return;
  if (!entity?.company_id) throw new AuthzError('ENTITY_NO_COMPANY', 400);
  if (caller.company_id !== entity.company_id) throw new AuthzError('FORBIDDEN_TENANT', 403);
}

const ALLOWED_EDIT_FIELDS = ['amount', 'category', 'description', 'payment_method', 'justification'];

function isLockedEntry(entry) {
  if (!entry) return true;
  if (entry.is_locked === true) return true;
  if (entry.origin === 'agendamento' || entry.origin === 'comissao') return true;
  if (entry.reference_appointment_id) return true;
  return false;
}

Deno.serve(async (req) => {
  console.log('[mutateFinancialEntry] start');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const { action, entry_id, patch, reason } = await req.json().catch(() => ({}));
    if (!action || !entry_id) {
      return Response.json({ success: false, error: 'action_and_entry_id_required' }, { status: 400 });
    }
    if (!['edit', 'delete'].includes(action)) {
      return Response.json({ success: false, error: 'invalid_action' }, { status: 400 });
    }

    const caller = await getCallerContext(base44, user);

    let entry;
    try {
      entry = await base44.asServiceRole.entities.FinancialEntry.get(entry_id);
    } catch (_e) {
      return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
    }
    if (!entry) return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });

    ensureSameCompany(caller, entry);

    // Capability granular conforme a ação
    const requiredCap = action === 'edit' ? 'edit_entry' : 'delete_entry';
    if (!hasCap(caller, requiredCap)) {
      console.warn('[mutateFinancialEntry] missing cap', { user: user.email, cap: requiredCap });
      return Response.json({ success: false, error: 'FORBIDDEN_CAP' }, { status: 403 });
    }

    // Isolamento por unidade (admin/financeiro passam livre)
    if (!canAccessUnit(caller, entry.unit_id)) {
      console.warn('[mutateFinancialEntry] forbidden unit', { user: user.email, unit_id: entry.unit_id });
      return Response.json({ success: false, error: 'FORBIDDEN_UNIT' }, { status: 403 });
    }

    if (entry.deleted_at) {
      return Response.json({ success: false, error: 'ALREADY_DELETED' }, { status: 400 });
    }
    if (isLockedEntry(entry)) {
      return Response.json({ success: false, error: 'ENTRY_LOCKED' }, { status: 403 });
    }

    // ─────────── EDIT ───────────
    if (action === 'edit') {
      if (!patch || typeof patch !== 'object') {
        return Response.json({ success: false, error: 'patch_required' }, { status: 400 });
      }
      const cleanPatch = {};
      for (const k of ALLOWED_EDIT_FIELDS) {
        if (k in patch) cleanPatch[k] = patch[k];
      }
      if (Object.keys(cleanPatch).length === 0) {
        return Response.json({ success: false, error: 'no_editable_fields' }, { status: 400 });
      }
      if ('amount' in cleanPatch) {
        const n = Number(cleanPatch.amount);
        if (!isFinite(n) || n < 0) {
          return Response.json({ success: false, error: 'invalid_amount' }, { status: 400 });
        }
        cleanPatch.amount = +n.toFixed(2);
      }
      if ((entry.entry_kind === 'sangria' || entry.entry_kind === 'suprimento')
        && 'justification' in cleanPatch
        && !String(cleanPatch.justification || '').trim()) {
        return Response.json({ success: false, error: 'justification_required' }, { status: 400 });
      }

      cleanPatch.edited_at = new Date().toISOString();
      cleanPatch.edited_by = user.email;

      const before = {};
      for (const k of Object.keys(cleanPatch)) before[k] = entry[k];

      const updated = await base44.asServiceRole.entities.FinancialEntry.update(entry_id, cleanPatch);

      try {
        await base44.asServiceRole.entities.AuditLog.create({
          company_id: entry.company_id, // P0.5: coluna nativa, mantém em metadata também por compat
          actor_email: user.email,
          actor_is_super_admin: !!caller.is_super_admin,
          action: 'EDIT_FINANCIAL_ENTRY',
          target_type: 'FinancialEntry',
          target_id: entry_id,
          before,
          after: cleanPatch,
          metadata: { company_id: entry.company_id, cash_register_id: entry.cash_register_id || null, unit_id: entry.unit_id || null },
        });
      } catch (e) { console.warn('[mutateFinancialEntry] audit log failed:', e.message); }

      console.log('[mutateFinancialEntry] edit ok', { user: user.email, entry_id });
      return Response.json({ success: true, entry: updated });
    }

    // ─────────── DELETE ───────────
    if (action === 'delete') {
      const kind = entry.entry_kind || (entry.type === 'saida' ? 'saida' : 'entrada');
      if (!['entrada', 'saida'].includes(kind)) {
        return Response.json({ success: false, error: 'KIND_NOT_DELETABLE' }, { status: 403 });
      }
      if (!reason || !String(reason).trim()) {
        return Response.json({ success: false, error: 'reason_required' }, { status: 400 });
      }

      const now = new Date().toISOString();
      const updated = await base44.asServiceRole.entities.FinancialEntry.update(entry_id, {
        deleted_at: now,
        deleted_by: user.email,
        deletion_reason: String(reason).trim().slice(0, 500),
      });

      try {
        await base44.asServiceRole.entities.AuditLog.create({
          company_id: entry.company_id, // P0.5: coluna nativa
          actor_email: user.email,
          actor_is_super_admin: !!caller.is_super_admin,
          action: 'DELETE_FINANCIAL_ENTRY',
          target_type: 'FinancialEntry',
          target_id: entry_id,
          before: { amount: entry.amount, description: entry.description, entry_kind: kind },
          after: { deleted_at: now, deletion_reason: reason },
          metadata: { company_id: entry.company_id, cash_register_id: entry.cash_register_id || null, unit_id: entry.unit_id || null },
        });
      } catch (e) { console.warn('[mutateFinancialEntry] audit log failed:', e.message); }

      console.log('[mutateFinancialEntry] delete ok', { user: user.email, entry_id });
      return Response.json({ success: true, entry: updated });
    }

    return Response.json({ success: false, error: 'unknown' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthzError) {
      console.warn('[mutateFinancialEntry] authz blocked:', error.code);
      return Response.json({ success: false, error: error.code }, { status: error.status });
    }
    console.error('[mutateFinancialEntry] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});