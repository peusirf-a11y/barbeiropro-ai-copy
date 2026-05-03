// Mapa central de permissões por papel — usado para filtrar menu e proteger rotas.
// Backend não confia neste arquivo (ver lib/serverPermissions.js para checagem real).

export const ROLE_PERMISSIONS = {
  super_admin: ['*'], // ignorado no app de tenant; super admin usa /master
  admin: [
    'dashboard', 'agenda', 'bloqueios', 'clientes', 'servicos', 'combos', 'planos',
    'profissionais', 'caixa', 'financeiro', 'comissoes', 'relatorios',
    'ai-growth', 'retencao', 'avaliacoes', 'indicacoes', 'equipe', 'configuracoes', 'assinatura',
  ],
  financeiro: [
    'dashboard', 'agenda', 'clientes', 'caixa', 'financeiro', 'comissoes', 'relatorios', 'planos',
  ],
  recepcao: [
    'dashboard', 'agenda', 'bloqueios', 'clientes', 'servicos', 'combos', 'planos', 'profissionais',
  ],
  barbeiro: [
    'dashboard', 'agenda', 'clientes',
  ],
};

export function canAccess(role, key) {
  if (!role) return false;
  const list = ROLE_PERMISSIONS[role] || [];
  if (list.includes('*')) return true;
  return list.includes(key);
}

// Atalhos semânticos para uso no frontend
export function isAdmin(role) { return role === 'admin'; }
export function isBarbeiro(role) { return role === 'barbeiro'; }
export function canViewFinance(role) { return ['admin', 'financeiro'].includes(role); }
export function canPayCommission(role) { return ['admin', 'financeiro'].includes(role); }
export function canManageTeam(role) { return role === 'admin'; }