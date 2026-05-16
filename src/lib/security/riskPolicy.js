/**
 * riskPolicy.js — Política de resposta adaptativa a risco.
 *
 * Define o que fazer em cada nível de risco:
 * LOW    → apenas log
 * MEDIUM → captcha invisível (futuro) + log
 * HIGH   → exigir MFA + log + alerta
 * CRITICAL → bloquear temporariamente + revogar sessão + alertar master
 */

export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Política de resposta por nível de risco.
 * Cada entrada define as ações automáticas e de UX a serem tomadas.
 */
export const RISK_POLICY = {
  low: {
    log: true,
    captcha: false,
    require_mfa: false,
    block: false,
    revoke_session: false,
    alert_master: false,
    block_duration_minutes: 0,
    user_message: null,
  },
  medium: {
    log: true,
    captcha: true, // habilitar quando Turnstile integrado
    require_mfa: false,
    block: false,
    revoke_session: false,
    alert_master: false,
    block_duration_minutes: 0,
    user_message: 'Verificação adicional necessária.',
  },
  high: {
    log: true,
    captcha: true,
    require_mfa: true,
    block: false,
    revoke_session: false,
    alert_master: true,
    block_duration_minutes: 0,
    user_message: 'Detectamos atividade incomum. Confirme sua identidade.',
  },
  critical: {
    log: true,
    captcha: true,
    require_mfa: true,
    block: true,
    revoke_session: true,
    alert_master: true,
    block_duration_minutes: 30,
    user_message: 'Acesso temporariamente suspenso por segurança. Tente novamente em 30 minutos.',
  },
};

/**
 * Retorna a política para um dado score de risco.
 * @param {string} riskScore - 'low'|'medium'|'high'|'critical'
 * @returns {object} política de resposta
 */
export function getPolicyForRisk(riskScore) {
  return RISK_POLICY[riskScore] || RISK_POLICY.low;
}

/**
 * Verifica se uma ação requer confirmação adicional.
 * @param {string} action - Nome da ação
 * @param {string} riskScore - Score de risco atual
 * @returns {{ requiresConfirm: boolean, requiresMfa: boolean }}
 */
export function actionRequiresEscalation(action, riskScore = 'low') {
  const CRITICAL_ACTIONS = [
    'CUSTOMER_DELETED',
    'CUSTOMER_ANONYMIZED',
    'CUSTOMER_EXPORTED',
    'FINANCIAL_ENTRY_DELETED',
    'SUBSCRIPTION_CANCELLED',
    'PLAN_CHANGED',
    'STRIPE_DISCONNECTED',
    'TEAM_MEMBER_REMOVED',
    'TEAM_MEMBER_ROLE_CHANGED',
    'PERMISSION_CHANGED',
    'COMPANY_DELETED',
    'BULK_EXPORT',
    'PASSWORD_RESET_ADMIN',
  ];

  const HIGH_ACTIONS = [
    'APPOINTMENT_DELETED',
    'COMMISSION_REVERSED',
    'SUBSCRIPTION_CHANGED',
    'STRIPE_CONNECTED',
  ];

  const isCritical = CRITICAL_ACTIONS.includes(action);
  const isHigh = HIGH_ACTIONS.includes(action);
  const policy = getPolicyForRisk(riskScore);

  return {
    requiresConfirm: isCritical || isHigh,
    requiresMfa: isCritical && (policy.require_mfa || riskScore === 'high' || riskScore === 'critical'),
    severity: isCritical ? 'critical' : isHigh ? 'high' : 'low',
  };
}

/**
 * Thresholds para detecção de padrões de abuso.
 */
export const ABUSE_THRESHOLDS = {
  // Exportações LGPD em 24h
  EXPORT_MEDIUM: 5,
  EXPORT_HIGH: 20,
  
  // Anonimizações em 24h
  ANON_MEDIUM: 3,
  ANON_CRITICAL: 10,
  
  // Falhas de login por IP em 5 min
  LOGIN_FAIL_HIGH: 5,
  LOGIN_FAIL_CRITICAL: 15,
  
  // Sessões simultâneas
  SESSIONS_HIGH: 5,
  SESSIONS_CRITICAL: 10,
  
  // Tentativas de cross-tenant em 1h
  CROSS_TENANT_CRITICAL: 3,
};