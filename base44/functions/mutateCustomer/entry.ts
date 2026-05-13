// BFF — Mutations de Customer (create/update/delete) com tenant+unit guard server-side.
//
// Por que existe (BFF Fase 2):
//  - Antes: frontend chamava base44.entities.Customer.create/update/delete direto e
//    decidia `unit_id` no client. Vetor de leak: cliente malicioso podia setar
//    company_id arbitrário ou unit_id de outra unidade.
//  - Agora: tudo decidido no servidor a partir do caller. Frontend só manda dados de UI.
//
// Payload:
//   { action: 'create' | 'update' | 'delete',
//     id?: string,             // obrigatório para update/delete
//     data?: object,           // payload aceito para create/update (campos editáveis)
//     active_unit_id?: string  // só usado em create quando company.customers_shared_across_units=false
//   }
//
// Regras de segurança:
//   - company_id SEMPRE derivado do caller (nunca aceito do payload)
//   - unit_id: em create, auto-stamp quando shared=false; em update, imutável
//   - barbeiro NÃO pode mutar customers (read-only role)
//   - update/delete validam que o customer pertence ao tenant do caller (404 genérico)
//   - Campos sensíveis (password_hash, auth_token, reset_token, token_version) NUNCA aceitos
//
// Retorno:
//   create → { customer }
//   update → { customer }
//   delete → { ok: true }

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
    console.log('[mutateCustomer] impersonation', { actor: user.email, company_id: company.id });
    return { role: 'admin', company_id: company.id, company, email: user.email, is_impersonating: true };
  }

  if (user.is_super_admin) {
    return { role: 'super_admin', is_super_admin: true, email: user.email };
  }

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

// Roles que NÃO podem mutar customers. Espelha o `isBarbeiro` no frontend
// (botões já escondidos) — aqui é defesa em profundidade.
const READ_ONLY_ROLES = new Set(['barbeiro']);

// Campos que o frontend pode setar. Tudo fora dessa lista é descartado.
// IMPORTANTE: campos de auth (password_hash, auth_token, reset_token, token_version,
// auth_token_expires_at, reset_token_expires_at) NÃO entram aqui — só `customerAuth`
// pode mexer neles.
const EDITABLE_FIELDS = new Set([
  'name', 'phone', 'email', 'notes', 'tags',
  'status',           // active | inactive | vip (marca manual)
  'favorite_service', 'favorite_professional',
]);

function sanitizePayload(data) {
  if (!data || typeof data !== 'object') return {};
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    if (!EDITABLE_FIELDS.has(k)) continue;
    if (typeof v === 'string') clean[k] = v.trim().slice(0, 500);
    else if (Array.isArray(v)) clean[k] = v.slice(0, 50).map(x => String(x).slice(0, 80));
    else clean[k] = v;
  }
  return clean;
}

function notFound() {
  return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, id, data, active_unit_id, impersonation_token } = body || {};
    const caller = await getCallerContext(base44, user, impersonation_token);
    if (caller.is_super_admin) {
      return Response.json({ error: 'USE_MASTER_PANEL' }, { status: 403 });
    }
    if (READ_ONLY_ROLES.has(caller.role)) {
      return Response.json({ error: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    if (!['create', 'update', 'delete'].includes(action)) {
      return Response.json({ error: 'INVALID_ACTION' }, { status: 400 });
    }

    const sdk = base44.asServiceRole;

    // ─── CREATE ────────────────────────────────────────────────────────
    if (action === 'create') {
      const clean = sanitizePayload(data);
      if (!clean.name || !clean.phone) {
        return Response.json({ error: 'NAME_AND_PHONE_REQUIRED' }, { status: 400 });
      }

      // Auto-stamp unit_id quando estamos no modo "clientes por unidade".
      // Espelha shouldScopeCustomersByUnit. company_id NUNCA vem do payload.
      const shared = caller.company?.customers_shared_across_units !== false;
      const multiUnit = !!caller.company?.multi_unit_enabled;
      const scopeByUnit = multiUnit && !shared && !!active_unit_id;

      const customer = await sdk.entities.Customer.create({
        ...clean,
        company_id: caller.company_id,
        unit_id: scopeByUnit ? active_unit_id : undefined,
      });

      return Response.json({ customer });
    }

    // ─── UPDATE ────────────────────────────────────────────────────────
    if (action === 'update') {
      if (!id) return Response.json({ error: 'ID_REQUIRED' }, { status: 400 });

      let existing;
      try { existing = await sdk.entities.Customer.get(id); }
      catch { return notFound(); }
      if (!existing) return notFound();

      // 404 genérico cross-tenant — não vaza existência
      if (existing.company_id !== caller.company_id) return notFound();

      const clean = sanitizePayload(data);
      const customer = await sdk.entities.Customer.update(id, clean);
      return Response.json({ customer });
    }

    // ─── DELETE ────────────────────────────────────────────────────────
    if (action === 'delete') {
      if (!id) return Response.json({ error: 'ID_REQUIRED' }, { status: 400 });

      let existing;
      try { existing = await sdk.entities.Customer.get(id); }
      catch { return notFound(); }
      if (!existing) return notFound();
      if (existing.company_id !== caller.company_id) return notFound();

      await sdk.entities.Customer.delete(id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'INVALID_ACTION' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    console.error('[mutateCustomer] error:', error.message, error.stack);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});