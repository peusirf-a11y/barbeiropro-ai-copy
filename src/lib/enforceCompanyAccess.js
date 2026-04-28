// Util compartilhado de bloqueio. Lança "COMPANY_BLOCKED" se a empresa estiver
// bloqueada manualmente pelo Master ou inadimplente.
//
// ⚠️  Backend functions NÃO importam este arquivo (sandbox isolado).
// Para uso em backend, copie o trecho equivalente inline ou veja exemplos
// em functions/closeCashRegister, functions/registerCommission, etc.

// past_due passou a ser tratado como "limitado" (não hard-block) — ver lib/billingMode.js
export const BLOCKED_SUBSCRIPTION_STATUSES = ['canceled', 'unpaid'];

export function isCompanyBlocked(company) {
  if (!company) return false;
  if (company.status === 'blocked') return true;
  if (company.is_blocked_by_billing === true) return true;
  if (BLOCKED_SUBSCRIPTION_STATUSES.includes(company.subscription_status)) return true;
  return false;
}

export function enforceCompanyAccess(company) {
  if (isCompanyBlocked(company)) {
    const err = new Error('COMPANY_BLOCKED');
    err.code = 'COMPANY_BLOCKED';
    throw err;
  }
}

// Hard guard universal: NOT_FOUND / COMPANY_BLOCKED / BILLING / FORBIDDEN_TENANT.
// Use depois de buscar a Company via serviceRole, antes de qualquer mutação.
export function assertCompanyAccess(company, caller) {
  if (!company) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (caller?.is_super_admin) return;

  if (company.status === 'blocked') {
    const err = new Error('COMPANY_BLOCKED');
    err.code = 'COMPANY_BLOCKED';
    throw err;
  }
  if (company.is_blocked_by_billing === true) {
    const err = new Error('COMPANY_BILLING_BLOCKED');
    err.code = 'COMPANY_BILLING_BLOCKED';
    throw err;
  }
  if (caller?.company_id && company.id && caller.company_id !== company.id) {
    const err = new Error('FORBIDDEN_TENANT');
    err.code = 'FORBIDDEN_TENANT';
    throw err;
  }
}

// Garante que o caller pertence ao mesmo tenant antes de mexer com company_id vindo do payload.
export function assertCallerCompanyMatch(caller, company_id) {
  if (caller?.is_super_admin) return;
  if (!caller?.company_id) {
    const err = new Error('NO_COMPANY_CONTEXT');
    err.code = 'NO_COMPANY_CONTEXT';
    throw err;
  }
  if (caller.company_id !== company_id) {
    const err = new Error('FORBIDDEN_TENANT');
    err.code = 'FORBIDDEN_TENANT';
    throw err;
  }
}