// Helpers de visibilidade de planos (Plan + CustomerPlan).
// Funções PURAS — sem fetch. Use no frontend para filtrar listas, no backend
// para validar acesso. Mantém a lógica num só lugar pra não vazar nada.
//
// Visibility:
//   - 'public'       → aparece em tudo (landing, onboarding, pricing, upgrades, /cliente/:slug/planos)
//   - 'private'      → oculto. Só Master vê todos. Tenant/Customer só vê se estiver em allowed_*_ids
//   - 'invite_only'  → oculto. Liberado para quem apresentar invite_token válido (validado no backend)

const PRIVATE_VISIBILITIES = new Set(['private', 'invite_only']);

export function isPublicPlan(plan) {
  if (!plan) return false;
  const v = plan.visibility || 'public';
  return v === 'public';
}

export function isPrivatePlan(plan) {
  if (!plan) return false;
  return PRIVATE_VISIBILITIES.has(plan.visibility);
}

/** Filtra planos visíveis publicamente (landing, pricing, onboarding). */
export function filterPublicPlans(plans) {
  if (!Array.isArray(plans)) return [];
  return plans.filter(isPublicPlan);
}

/**
 * Filtra planos visíveis para um tenant específico (Plan da plataforma).
 * Retorna: planos públicos + privados onde company_id está em allowed_company_ids.
 * invite_only continua oculto — só aparece após o tenant validar token.
 */
export function filterPlansVisibleToCompany(plans, companyId) {
  if (!Array.isArray(plans)) return [];
  return plans.filter(p => {
    if (isPublicPlan(p)) return true;
    if (p.visibility === 'private' && companyId && Array.isArray(p.allowed_company_ids)) {
      return p.allowed_company_ids.includes(companyId);
    }
    return false;
  });
}

/**
 * Filtra CustomerPlans visíveis para um Customer específico.
 * Igual ao acima, mas com allowed_customer_ids.
 */
export function filterCustomerPlansVisibleToCustomer(plans, customerId) {
  if (!Array.isArray(plans)) return [];
  return plans.filter(p => {
    if (isPublicPlan(p)) return true;
    if (p.visibility === 'private' && customerId && Array.isArray(p.allowed_customer_ids)) {
      return p.allowed_customer_ids.includes(customerId);
    }
    return false;
  });
}

/**
 * Validação de invite token. Não consulta DB — recebe o plan já buscado.
 * Retorna { valid, reason } onde reason ∈ { 'not_invite_only', 'no_token', 'token_mismatch', 'expired', 'max_uses_reached' }.
 */
export function validateInviteToken(plan, token) {
  if (!plan) return { valid: false, reason: 'not_found' };
  if (plan.visibility !== 'invite_only') return { valid: false, reason: 'not_invite_only' };
  if (!plan.invite_token) return { valid: false, reason: 'no_token' };
  if (!token || token !== plan.invite_token) return { valid: false, reason: 'token_mismatch' };
  if (plan.invite_token_expires_at && new Date(plan.invite_token_expires_at) < new Date()) {
    return { valid: false, reason: 'expired' };
  }
  const max = Number(plan.invite_max_uses || 0);
  const used = Number(plan.invite_uses_count || 0);
  if (max > 0 && used >= max) return { valid: false, reason: 'max_uses_reached' };
  return { valid: true };
}

/**
 * Verifica se um tenant pode contratar um Plan (após auth/onboarding).
 * - public: sempre
 * - private: só se estiver em allowed_company_ids
 * - invite_only: NÃO — precisa de fluxo de invite (que adiciona ao allowed_company_ids depois de validar)
 */
export function canCompanyAccessPlan(plan, companyId) {
  if (isPublicPlan(plan)) return true;
  if (plan.visibility === 'private' && Array.isArray(plan.allowed_company_ids)) {
    return plan.allowed_company_ids.includes(companyId);
  }
  return false;
}

/**
 * Mesmo conceito mas para CustomerPlan (cliente final assinando plano da barbearia).
 */
export function canCustomerAccessPlan(plan, customerId) {
  if (isPublicPlan(plan)) return true;
  if (plan.visibility === 'private' && Array.isArray(plan.allowed_customer_ids)) {
    return plan.allowed_customer_ids.includes(customerId);
  }
  return false;
}

/** Gera um invite_token opaco (32 chars hex). Uso no backend/Master. */
export function generateInviteToken() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}