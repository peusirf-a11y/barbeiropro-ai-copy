// Helpers de autorização — REFERÊNCIA CANÔNICA.
//
// ⚠️  Backend functions (functions/*.js) NÃO podem importar este arquivo:
//     cada function é deployada isolada (sandbox Deno separado). Por isso, o
//     conteúdo abaixo é INLINED em cada function que precisa de RBAC.
//     Se você alterar a lógica aqui, replique o trecho equivalente em:
//       - functions/closeCashRegister
//       - functions/registerCommission
//       - functions/reverseCommission
//
// Padrão de uso (dentro de cada function, com cópia inline do helper):
//   const caller = await getCallerContext(base44, user);
//   ensureSameCompany(caller, entity);
//   ensureRole(caller, ['admin', 'financeiro']);

const FINANCE_ROLES = ['admin', 'financeiro'];
const ADMIN_ROLES = ['admin'];

export class AuthzError extends Error {
  constructor(code, status = 403) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

// Resolve contexto do chamador: super admin, owner da empresa ou TeamMember.
export async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);

  if (user.is_super_admin) {
    return { role: 'super_admin', company_id: null, is_super_admin: true, email: user.email };
  }

  // 1) TeamMember (RBAC oficial)
  const tm = await base44.asServiceRole.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  if (tm && tm.length > 0) {
    if (tm[0].active === false) throw new AuthzError('USER_INACTIVE', 403);
    return {
      role: tm[0].role,
      company_id: tm[0].company_id,
      professional_id: tm[0].professional_id || null,
      team_member_id: tm[0].id,
      email: user.email,
      is_super_admin: false,
    };
  }

  // 2) Compat: dono da Company (legado, antes do RBAC) → tratado como admin
  const companies = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (companies && companies.length > 0) {
    return {
      role: 'admin',
      company_id: companies[0].id,
      professional_id: null,
      email: user.email,
      is_owner: true,
      is_super_admin: false,
    };
  }

  throw new AuthzError('NO_TEAM_MEMBER', 403);
}

// Garante que a entity pertence ao mesmo tenant do chamador (Super Admin ignora).
export function ensureSameCompany(caller, entity) {
  if (caller.is_super_admin) return;
  if (!entity?.company_id) throw new AuthzError('ENTITY_NO_COMPANY', 400);
  if (caller.company_id !== entity.company_id) throw new AuthzError('FORBIDDEN_TENANT', 403);
}

// Garante que o papel do chamador está na lista permitida (Super Admin ignora).
export function ensureRole(caller, allowedRoles) {
  if (caller.is_super_admin) return;
  if (!allowedRoles.includes(caller.role)) throw new AuthzError('FORBIDDEN_ROLE', 403);
}

export const ROLES = { FINANCE_ROLES, ADMIN_ROLES };

// Helper para retornar a Response correta a partir de um AuthzError
export function authzErrorResponse(error) {
  if (error instanceof AuthzError) {
    return Response.json({ success: false, error: error.code }, { status: error.status });
  }
  return null;
}