// Util compartilhado de bloqueio. Lança "COMPANY_BLOCKED" se a empresa estiver
// bloqueada manualmente pelo Master ou inadimplente.

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