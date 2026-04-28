// Modo "past_due limitado" — quando assinatura está em atraso (mas ainda não revogada),
// o app mantém agenda/clientes/serviços ativos mas bloqueia financeiro.
//
// Diferente de `isCompanyBlocked` (hard block):
//   - hard block  → redireciona para /app/assinatura-bloqueada
//   - past_due    → permite uso parcial + banner persistente

import { isCompanyBlocked } from '@/lib/enforceCompanyAccess';

// Hard-block: status manual=blocked, is_blocked_by_billing=true, ou stripe = canceled/unpaid.
export function isHardBlocked(company) {
  return isCompanyBlocked(company);
}

// Past-due limitado: subscription em atraso mas a empresa ainda usa o app.
export function isPastDueLimited(company) {
  if (!company) return false;
  if (isHardBlocked(company)) return false; // hard block tem prioridade
  return company.subscription_status === 'past_due';
}

// Rotas bloqueadas durante past_due (financeiro). Resto continua acessível.
export const PAST_DUE_BLOCKED_ROUTES = [
  '/app/financeiro',
  '/app/caixa',
  '/app/comissoes',
  '/app/relatorios',
];

export function isRouteBlockedByPastDue(pathname, company) {
  if (!isPastDueLimited(company)) return false;
  return PAST_DUE_BLOCKED_ROUTES.includes(pathname);
}