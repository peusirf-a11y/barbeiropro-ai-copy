// BFF — Lista de CustomerSubscription com tenant scope no servidor.
//
// Por que existe (BFF Fase 4):
//  - AppDashboard, AppClientes e CustomerSubscriptionPanel chamavam
//    base44.entities.CustomerSubscription.filter direto. Tenant ficava implícito
//    no payload (qualquer cliente podia injetar company_id alheio).
//  - Agora o servidor deriva company_id do caller. Frontend só passa filtros de
//    UI (status, customer_id).
//
// Payload (todos opcionais):
//   {
//     active_unit_id?: string,    // unidade selecionada na UI
//     customer_id?: string,       // filtrar por cliente específico
//     status?: 'active' | 'pending_payment' | 'paused' | 'canceled' | string[],
//     limit?: number (default 500, max 2000)
//   }
//
// Regras:
//   - company_id SEMPRE derivado do caller (nunca aceito do payload)
//   - role=barbeiro → bloqueado (não tem acesso a assinaturas)
//   - customer_id validado: deve pertencer à mesma company
//   - Unit scope: CustomerSubscription não tem unit_id próprio. Quando
//     customers_shared_across_units=false, filtramos via customer.unit_id.
//
// Retorno: { subscriptions, total, scope: { company_id, customer_id? } }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

async function getCallerContext(base44, user, impersonation_token) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  const sdk = base44.asServiceRole;

  // Impersonação
  if (impersonation_token && user.is_super_admin) {
    const sessions = await sdk.entities.ImpersonationSession.filter({ token: impersonation_token }, '-created_date', 1);
    const session = sessions?.[0];
    if (!session || session.ended_at || new Date(session.expires_at).getTime() < Date.now()) {
      throw new AuthzError('IMPERSONATION_INVALID', 403);
    }
    if (session.actor_email !== user.email) throw new AuthzError('IMPERSONATION_MISMATCH', 403);
    const company = await sdk.entities.Company.get(session.company_id).catch(() => null);
    if (!company) throw new AuthzError('COMPANY_NOT_FOUND', 404);
    console.log('[listSubscriptions] impersonation', { actor: user.email, company_id: company.id });
    return { role: 'admin', company_id: company.id, company, email: user.email, is_impersonating: true };
  }

  if (user.is_super_admin) {
    throw new AuthzError('USE_MASTER_PANEL', 403);
  }

  const ownerHits = await sdk.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (ownerHits?.length) {
    return { role: 'admin', company_id: ownerHits[0].id, company: ownerHits[0] };
  }

  const tmHits = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  const tm = tmHits?.[0];
  if (!tm) throw new AuthzError('NO_TEAM_MEMBER', 403);
  if (tm.active === false) throw new AuthzError('USER_INACTIVE', 403);
  if (tm.role === 'barbeiro') throw new AuthzError('FORBIDDEN_ROLE', 403);

  const company = await sdk.entities.Company.get(tm.company_id).catch(() => null);
  if (!company) throw new AuthzError('COMPANY_NOT_FOUND', 404);

  return { role: tm.role, company_id: tm.company_id, company };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { active_unit_id, customer_id, status, impersonation_token } = body || {};
    const caller = await getCallerContext(base44, user, impersonation_token);
    const limit = Math.min(Math.max(parseInt(body?.limit) || 500, 1), 2000);

    const sdk = base44.asServiceRole;
    const filter = { company_id: caller.company_id };

    // Filtro por cliente — valida cross-tenant antes
    if (customer_id) {
      const cust = await sdk.entities.Customer.get(customer_id).catch(() => null);
      if (!cust || cust.company_id !== caller.company_id) {
        return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
      }
      filter.customer_id = customer_id;
    }

    // Filtro por status
    if (status) {
      if (Array.isArray(status) && status.length > 0) {
        filter.status = { $in: status };
      } else if (typeof status === 'string') {
        filter.status = status;
      }
    }

    let subscriptions = await sdk.entities.CustomerSubscription.filter(filter, '-created_date', limit);

    // Unit scope: CustomerSubscription não tem unit_id próprio.
    // Quando customers_shared_across_units=false E há unit ativa, filtramos
    // via customer.unit_id (uma chamada extra; aceitável p/ baixo volume).
    const sharedAcrossUnits = caller.company?.customers_shared_across_units !== false;
    const multiUnit = !!caller.company?.multi_unit_enabled;
    if (multiUnit && active_unit_id && !sharedAcrossUnits && subscriptions.length > 0) {
      const customerIds = [...new Set(subscriptions.map(s => s.customer_id).filter(Boolean))];
      const customers = await sdk.entities.Customer.filter(
        { company_id: caller.company_id, id: { $in: customerIds } },
        null,
        customerIds.length
      ).catch(() => []);
      const allowed = new Set(
        customers
          .filter(c => !c.unit_id || c.unit_id === active_unit_id)
          .map(c => c.id)
      );
      subscriptions = subscriptions.filter(s => !s.customer_id || allowed.has(s.customer_id));
    }

    return Response.json({
      subscriptions,
      total: subscriptions.length,
      scope: { company_id: caller.company_id, customer_id: customer_id || undefined },
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    console.error('[listSubscriptions] error:', error.message, error.stack);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});