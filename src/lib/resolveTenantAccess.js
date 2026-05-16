/**
 * resolveTenantAccess — Helper central de isolamento multi-tenant.
 *
 * REGRA DE OURO: company_id NUNCA vem do payload/frontend.
 * Sempre derivado do caller autenticado (owner ou TeamMember).
 *
 * Uso em backend functions (inline, sem import local):
 *   Copie o conteúdo desta função diretamente na function (Deno não suporta imports locais).
 *   Este arquivo é a REFERÊNCIA CANÔNICA. Ao alterar, replique nas functions.
 *
 * Retorno:
 *   {
 *     company_id: string,          // tenant do caller
 *     role: string,                // admin | recepcao | barbeiro | financeiro | super_admin
 *     email: string,
 *     professional_id?: string,    // para role=barbeiro
 *     unit_ids?: string[],         // restrição de unidades
 *     is_super_admin: boolean,
 *     is_impersonating: boolean,
 *     is_owner: boolean,
 *     company: object,             // objeto Company completo
 *   }
 *
 * Lança AuthzError em caso de falha. Nunca retorna null.
 */

export class AuthzError extends Error {
  constructor(code, status = 403) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function authzResponse(error) {
  if (error instanceof AuthzError) {
    return Response.json({ success: false, error: error.code }, { status: error.status });
  }
  return null;
}

/**
 * Resolve o contexto do caller a partir do token Base44.
 * Suporta: owner, TeamMember, super_admin com impersonação.
 *
 * @param {object} base44 - cliente Base44 inicializado com createClientFromRequest(req)
 * @param {object} user   - resultado de base44.auth.me()
 * @param {string} [impersonation_token] - token de impersonação (super_admin only)
 */
export async function resolveTenantAccess(base44, user, impersonation_token = null) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  const sdk = base44.asServiceRole;

  // ── IMPERSONAÇÃO (super_admin only) ──────────────────────────────────────
  if (impersonation_token && user.is_super_admin) {
    const sessions = await sdk.entities.ImpersonationSession.filter(
      { token: impersonation_token }, '-created_date', 1
    );
    const session = sessions?.[0];
    if (!session) throw new AuthzError('IMPERSONATION_INVALID', 403);
    if (session.ended_at) throw new AuthzError('IMPERSONATION_ENDED', 403);
    if (new Date(session.expires_at).getTime() < Date.now()) throw new AuthzError('IMPERSONATION_EXPIRED', 403);
    if (session.actor_email !== user.email) throw new AuthzError('IMPERSONATION_MISMATCH', 403);

    const company = await sdk.entities.Company.get(session.company_id).catch(() => null);
    if (!company) throw new AuthzError('COMPANY_NOT_FOUND', 404);

    return {
      company_id: company.id,
      role: 'admin',
      email: user.email,
      professional_id: null,
      unit_ids: [],
      is_super_admin: true,
      is_impersonating: true,
      is_owner: false,
      company,
    };
  }

  // ── SUPER ADMIN sem impersonação: bloqueia (deve usar painel master) ──────
  if (user.is_super_admin) {
    throw new AuthzError('USE_MASTER_PANEL', 403);
  }

  // ── OWNER da empresa (legado + principal path) ────────────────────────────
  const ownerHits = await sdk.entities.Company.filter(
    { owner_email: user.email }, '-created_date', 1
  );
  if (ownerHits?.length) {
    const company = ownerHits[0];
    return {
      company_id: company.id,
      role: 'admin',
      email: user.email,
      professional_id: null,
      unit_ids: [],
      is_super_admin: false,
      is_impersonating: false,
      is_owner: true,
      company,
    };
  }

  // ── TEAM MEMBER ────────────────────────────────────────────────────────────
  const tmHits = await sdk.entities.TeamMember.filter(
    { email: user.email }, '-created_date', 1
  );
  const tm = tmHits?.[0];
  if (!tm) throw new AuthzError('NO_TEAM_MEMBER', 403);
  if (tm.active === false) throw new AuthzError('USER_INACTIVE', 403);

  const company = await sdk.entities.Company.get(tm.company_id).catch(() => null);
  if (!company) throw new AuthzError('COMPANY_NOT_FOUND', 404);

  return {
    company_id: tm.company_id,
    role: tm.role,
    email: user.email,
    professional_id: tm.professional_id || null,
    unit_ids: tm.unit_ids || [],
    cash_permissions: tm.cash_permissions || null,
    is_super_admin: false,
    is_impersonating: false,
    is_owner: false,
    company,
  };
}

/**
 * Valida que uma entidade pertence ao tenant do caller.
 * Lança AuthzError se não pertencer.
 */
export function ensureSameTenant(caller, entity, entityName = 'entity') {
  if (caller.is_impersonating || caller.is_super_admin) return; // super admin passa
  if (!entity?.company_id) throw new AuthzError(`${entityName.toUpperCase()}_NO_COMPANY`, 400);
  if (caller.company_id !== entity.company_id) {
    throw new AuthzError('FORBIDDEN_TENANT', 403);
  }
}

/**
 * Valida que o caller tem o role necessário.
 */
export function ensureRole(caller, allowedRoles) {
  if (caller.is_super_admin || caller.is_impersonating) return;
  if (!allowedRoles.includes(caller.role)) throw new AuthzError('FORBIDDEN_ROLE', 403);
}