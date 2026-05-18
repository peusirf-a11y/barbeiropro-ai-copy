// Lógica pura (sem I/O) de classificação do ciclo de vida do cliente.
// Usada tanto no frontend (badges, filtros) quanto no backend (job + on-conclude).
//
// Estados:
//   primeira_visita → 0 ou 1 atendimento concluído
//   fiel            → >= fiel_min_appointments concluídos (e last_completed_at recente)
//   em_risco        → sem atendimento concluído há >= em_risco_days e < inativo_days
//   inativo         → sem atendimento concluído há >= inativo_days e < perdido_days
//   perdido         → sem atendimento concluído há >= perdido_days
//
// Importante:
// - Considera APENAS atendimentos concluídos (não cancelados/faltou).
// - "fiel" tem prioridade sobre "em_risco" enquanto o cliente ainda está dentro
//   da janela de em_risco (ou seja: cliente fiel só vira em_risco ao passar 30d).

export const DEFAULT_CRM_SETTINGS = {
  fiel_min_appointments: 5,
  em_risco_days: 30,
  inativo_days: 60,
  perdido_days: 90,
};

export function getCrmSettings(company) {
  const s = company?.crm_settings || {};
  return {
    fiel_min_appointments: Number(s.fiel_min_appointments) || DEFAULT_CRM_SETTINGS.fiel_min_appointments,
    em_risco_days: Number(s.em_risco_days) || DEFAULT_CRM_SETTINGS.em_risco_days,
    inativo_days: Number(s.inativo_days) || DEFAULT_CRM_SETTINGS.inativo_days,
    perdido_days: Number(s.perdido_days) || DEFAULT_CRM_SETTINGS.perdido_days,
  };
}

/**
 * @param {object} customer - { total_appointments, last_completed_at }
 *   Se last_completed_at não estiver populado (clientes antigos), usa last_appointment_at como fallback.
 * @param {object} settings - resultado de getCrmSettings(company)
 * @param {Date}   now       - referência de tempo (default: agora)
 * @returns {string} lifecycle_status
 */
export function computeLifecycleStatus(customer, settings = DEFAULT_CRM_SETTINGS, now = new Date()) {
  if (!customer) return 'primeira_visita';
  const total = Number(customer.total_appointments) || 0;
  const lastIso = customer.last_completed_at || customer.last_appointment_at;

  // Sem histórico → primeira visita
  if (!lastIso || total <= 1) return 'primeira_visita';

  const last = new Date(lastIso);
  if (Number.isNaN(last.getTime())) return 'primeira_visita';
  const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  if (days >= settings.perdido_days) return 'perdido';
  if (days >= settings.inativo_days) return 'inativo';
  if (days >= settings.em_risco_days) return 'em_risco';
  if (total >= settings.fiel_min_appointments) return 'fiel';

  // Tem histórico mas ainda não chegou em 'fiel' nem entrou em 'em_risco' →
  // continua como primeira_visita (ou seja, em construção). Mantém UX simples.
  return 'primeira_visita';
}

// Tokens visuais (label, ícone, classes Tailwind) — fonte única para badges, filtros e cards.
// Tema DARK glass: tints translúcidas com texto claro.
export const LIFECYCLE_TOKENS = {
  primeira_visita: {
    key: 'primeira_visita',
    label: 'Visitante',
    icon: '✦',
    badge: 'bg-blue-400/15 text-blue-200 border-blue-400/30',
    dot: 'bg-blue-400',
  },
  fiel: {
    key: 'fiel',
    label: 'Cliente fiel',
    icon: '✓',
    badge: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30',
    dot: 'bg-emerald-400',
  },
  em_risco: {
    key: 'em_risco',
    label: 'Em risco',
    icon: '⚠️',
    badge: 'bg-amber-400/15 text-amber-200 border-amber-400/30',
    dot: 'bg-amber-400',
  },
  inativo: {
    key: 'inativo',
    label: 'Inativo',
    icon: '💤',
    badge: 'bg-orange-400/15 text-orange-200 border-orange-400/30',
    dot: 'bg-orange-400',
  },
  perdido: {
    key: 'perdido',
    label: 'Perdido',
    icon: '🚫',
    badge: 'bg-rose-400/15 text-rose-200 border-rose-400/30',
    dot: 'bg-rose-400',
  },
};

export function getLifecycleToken(status) {
  return LIFECYCLE_TOKENS[status] || LIFECYCLE_TOKENS.primeira_visita;
}