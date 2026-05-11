// BFF — mutações em Commission. Action semântica (não generic CRUD).
//
// Por que action semântica:
//  - Commission tem regras de negócio (amount/commission_value vêm de Professional
//    no momento da conclusão do atendimento — frontend NÃO deve editar).
//  - A única mutação que o painel precisa é "marcar como pago" (em lote).
//  - Ações futuras (estornar) vão como novas actions, não como update genérico.
//
// Actions suportadas:
//  - mark_paid: aceita commission_ids: string[] (até 200 ids), marca status='pago'
//               em todas que pertencem ao caller (cross-tenant retorna 404 genérico
//               POR ITEM, mas não derruba o batch — registra skipped).
//
// RBAC:
//  - super-admin → 403 USE_MASTER_PANEL (não é fluxo de plataforma).
//  - barbeiro → 403 FORBIDDEN_ROLE (operação financeira).
//  - recepcao → 403 FORBIDDEN_ROLE (só admin/financeiro pagam comissão — espelha canPayCommission).
//  - admin/financeiro → permitido.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  if (user.is_super_admin) return { role: 'super_admin', is_super_admin: true, email: user.email };
  const tm = await base44.asServiceRole.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  if (tm?.length) {
    if (tm[0].active === false) throw new AuthzError('USER_INACTIVE', 403);
    return { role: tm[0].role, company_id: tm[0].company_id, email: user.email };
  }
  const co = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (co?.length) return { role: 'admin', company_id: co[0].id, email: user.email, is_owner: true };
  throw new AuthzError('NO_TEAM_MEMBER', 403);
}

const ALLOWED_ROLES = ['admin', 'financeiro'];

function notFound() {
  return Response.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, commission_ids } = body;

    if (action !== 'mark_paid') {
      return Response.json({ success: false, error: 'INVALID_ACTION' }, { status: 400 });
    }
    if (!Array.isArray(commission_ids) || commission_ids.length === 0) {
      return Response.json({ success: false, error: 'commission_ids_required' }, { status: 400 });
    }
    if (commission_ids.length > 200) {
      return Response.json({ success: false, error: 'BATCH_TOO_LARGE', message: 'Máximo 200 comissões por vez' }, { status: 400 });
    }

    const caller = await getCallerContext(base44, user);

    if (caller.is_super_admin) {
      return Response.json({ success: false, error: 'USE_MASTER_PANEL' }, { status: 403 });
    }
    if (!ALLOWED_ROLES.includes(caller.role)) {
      return Response.json({ success: false, error: 'FORBIDDEN_ROLE' }, { status: 403 });
    }
    if (!caller.company_id) return notFound();

    const sdk = base44.asServiceRole;

    // Bloqueio de empresa
    try {
      const co = await sdk.entities.Company.get(caller.company_id);
      if (co?.status === 'blocked' || co?.is_blocked_by_billing === true) {
        return Response.json({ success: false, error: 'COMPANY_BLOCKED' }, { status: 403 });
      }
    } catch { /* segue */ }

    // Processa cada commission: valida tenant + status, atualiza se for pendente.
    // Falhas individuais NÃO derrubam o batch (UX: "marquei 4 de 5; 1 já estava paga").
    const results = { updated: [], skipped: [] };

    for (const id of commission_ids) {
      try {
        const c = await sdk.entities.Commission.get(id);
        if (!c || c.company_id !== caller.company_id) {
          results.skipped.push({ id, reason: 'NOT_FOUND' });
          continue;
        }
        if (c.status === 'pago') {
          results.skipped.push({ id, reason: 'ALREADY_PAID' });
          continue;
        }
        await sdk.entities.Commission.update(id, { status: 'pago' });
        results.updated.push(id);
      } catch (err) {
        console.warn('[mutateCommission] item failed:', id, err?.message);
        results.skipped.push({ id, reason: 'UPDATE_FAILED' });
      }
    }

    // AuditLog do batch (uma entrada, não N — evita poluição).
    try {
      await sdk.entities.AuditLog.create({
        company_id: caller.company_id,
        actor_email: caller.email,
        action: 'PAY_COMMISSION_BATCH',
        target_type: 'Commission',
        target_id: results.updated.join(','),
        metadata: {
          requested: commission_ids.length,
          updated: results.updated.length,
          skipped: results.skipped.length,
          skipped_reasons: results.skipped,
        },
      });
    } catch (e) { console.warn('[mutateCommission] audit failed:', e.message); }

    return Response.json({
      success: true,
      updated_count: results.updated.length,
      skipped_count: results.skipped.length,
      results,
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ success: false, error: error.code }, { status: error.status });
    }
    console.error('[mutateCommission] error:', error.message, error.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});