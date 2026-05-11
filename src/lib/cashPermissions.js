// Permissões granulares do módulo Caixa (Fase 4).
// Modelo HÍBRIDO: defaults por role + overrides por TeamMember.cash_permissions.
//
// CAPABILITIES disponíveis:
//   open_register, close_register, create_entry, edit_entry, delete_entry,
//   sangria, suprimento, view_reports, view_audit
//
// Resolução: para cada capability, se cash_permissions[cap] for boolean → vence.
// Caso contrário, herda do default do role.

export const CASH_CAPS = [
  'open_register', 'close_register', 'create_entry', 'edit_entry', 'delete_entry',
  'sangria', 'suprimento', 'view_reports', 'view_audit',
];

export const CASH_CAP_LABELS = {
  open_register:  'Abrir caixa',
  close_register: 'Fechar caixa',
  create_entry:   'Lançar entrada/saída',
  edit_entry:     'Editar lançamento',
  delete_entry:   'Excluir lançamento',
  sangria:        'Registrar sangria',
  suprimento:     'Registrar suprimento',
  view_reports:   'Ver relatórios',
  view_audit:     'Ver auditoria',
};

// Defaults por papel.
// admin / financeiro = acesso total.
// recepcao = operacional do dia (abrir, lançar, suprimento, sangria) mas NÃO fecha/edit/delete/relatório/auditoria.
// barbeiro = somente leitura (sem acesso ao módulo de fato — é mantido por completude).
const ROLE_DEFAULTS = {
  admin: {
    open_register: true, close_register: true, create_entry: true, edit_entry: true,
    delete_entry: true, sangria: true, suprimento: true, view_reports: true, view_audit: true,
  },
  financeiro: {
    open_register: true, close_register: true, create_entry: true, edit_entry: true,
    delete_entry: true, sangria: true, suprimento: true, view_reports: true, view_audit: true,
  },
  recepcao: {
    open_register: true, close_register: false, create_entry: true, edit_entry: false,
    delete_entry: false, sangria: true, suprimento: true, view_reports: false, view_audit: false,
  },
  barbeiro: {
    open_register: false, close_register: false, create_entry: false, edit_entry: false,
    delete_entry: false, sangria: false, suprimento: false, view_reports: false, view_audit: false,
  },
  super_admin: {
    open_register: true, close_register: true, create_entry: true, edit_entry: true,
    delete_entry: true, sangria: true, suprimento: true, view_reports: true, view_audit: true,
  },
};

export function getRoleDefaults(role) {
  return ROLE_DEFAULTS[role] || ROLE_DEFAULTS.barbeiro;
}

// Resolve capability final do membro (defaults + overrides).
// teamMember: { role, cash_permissions? } | null
// callerContext (backend): { role, cash_permissions? }
export function hasCashCap(teamMember, cap) {
  if (!teamMember) return false;
  if (teamMember.is_super_admin) return true;
  const overrides = teamMember.cash_permissions || {};
  if (typeof overrides[cap] === 'boolean') return overrides[cap];
  return !!getRoleDefaults(teamMember.role)[cap];
}

// Devolve todas as caps resolvidas (útil para UI/tabela).
export function resolveCashCaps(teamMember) {
  const out = {};
  for (const cap of CASH_CAPS) out[cap] = hasCashCap(teamMember, cap);
  return out;
}

// ─────────────────────────────────────────────
// MULTI-UNIDADE: admin/financeiro veem todas; demais ficam restritos a TeamMember.unit_ids.
// unit_ids vazio = sem restrição (compat mono-unidade).
// ─────────────────────────────────────────────
export const CROSS_UNIT_ROLES = ['admin', 'financeiro', 'super_admin'];

export function canAccessUnit(teamMember, unitId) {
  if (!teamMember) return false;
  if (teamMember.is_super_admin) return true;
  if (CROSS_UNIT_ROLES.includes(teamMember.role)) return true;
  const allowed = teamMember.unit_ids || [];
  if (!allowed.length) return true; // sem restrição configurada
  if (!unitId) return true;         // operação sem unidade definida (legado)
  return allowed.includes(unitId);
}