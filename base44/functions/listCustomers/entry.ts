// BFF — Lista de clientes com isolamento tenant + unit aplicado no servidor.
//
// Por que existe (primeira leva do salto BFF, pós Sprint C):
//  - Antes: frontend chamava `base44.entities.Customer.filter({ company_id })` e
//    aplicava unit scoping no cliente. Isso vazava o entity pra superfície de
//    ataque + dependia do frontend respeitar o tenant.
//  - Agora: frontend chama esta função; servidor resolve caller → tenant → unit
//    scoping → devolve só o que o usuário tem direito de ver.
//
// Princípios:
//  - Não recebe `company_id` do cliente — sempre derivado do caller.
//  - Unit scoping respeita `Company.customers_shared_across_units`:
//      shared=true  → devolve todos os clientes da empresa
//      shared=false → devolve só clientes da unidade ativa (+ legados sem unit_id)
//  - Filtros opcionais (`lifecycle_status`, `status`) aplicados no servidor.
//  - Limite default 500 (mesmo do front antigo); cap absoluto 2000.
//
// Payload aceito:
//   { active_unit_id?: string|null, lifecycle_status?: string, status?: string, limit?: number }
//
// Retorno:
//   { customers: Customer[], total: number, scope: { tenant, unit_scoped, active_unit_id } }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  const sdk = base44.asServiceRole;

  // Super-admin sem vínculo: não pode listar customers de tenant nenhum (use master panel)
  if (user.is_super_admin) {
    return { role: 'super_admin', is_super_admin: true, email: user.email };
  }

  // Owner tem prioridade
  const ownerHits = await sdk.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (ownerHits?.length) {
    return {
      role: 'admin',
      company_id: ownerHits[0].id,
      company: ownerHits[0],
      email: user.email,
      is_owner: true,
    };
  }

  // Team member ativo
  const tmHits = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  const tm = tmHits?.[0];
  if (!tm) throw new AuthzError('NO_TEAM_MEMBER', 403);
  if (tm.active === false) throw new AuthzError('USER_INACTIVE', 403);

  const company = await sdk.entities.Company.get(tm.company_id).catch(() => null);
  if (!company) throw new AuthzError('COMPANY_NOT_FOUND', 404);

  return {
    role: tm.role,
    company_id: tm.company_id,
    company,
    email: user.email,
    unit_ids: tm.unit_ids || [],
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);

    // Super-admin precisa usar painel master, não as listas operacionais.
    if (caller.is_super_admin) {
      return Response.json({ error: 'USE_MASTER_PANEL' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      active_unit_id = null,
      lifecycle_status = null,
      status = null,
      limit = 500,
    } = body || {};

    const cap = Math.min(Math.max(Number(limit) || 500, 1), 2000);
    const sdk = base44.asServiceRole;

    // Monta filtro server-side. `company_id` SEMPRE vem do caller.
    const filter = { company_id: caller.company_id };
    if (lifecycle_status) filter.lifecycle_status = lifecycle_status;
    if (status) filter.status = status;

    let customers = await sdk.entities.Customer.filter(filter, '-created_date', cap);

    // Unit scoping (espelha `shouldScopeCustomersByUnit` do front)
    const shared = caller.company?.customers_shared_across_units !== false;
    const multiUnit = !!caller.company?.multi_unit_enabled;
    const scopeByUnit = multiUnit && !shared && !!active_unit_id;

    if (scopeByUnit) {
      customers = customers.filter(c => !c.unit_id || c.unit_id === active_unit_id);
    }

    return Response.json({
      customers,
      total: customers.length,
      scope: {
        tenant: caller.company_id,
        unit_scoped: scopeByUnit,
        active_unit_id: scopeByUnit ? active_unit_id : null,
      },
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    console.error('[listCustomers] error:', error.message, error.stack);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});