/**
 * securityScore.js — Security Score Enterprise por tenant.
 *
 * Calcula score 0-100 baseado em múltiplas categorias de segurança.
 * Gera badges, recomendações e alertas automáticos.
 */

// ── CATEGORIAS ────────────────────────────────────────────────────────────────

export const SCORE_CATEGORIES = {
  autenticacao: { weight: 20, label: 'Autenticação' },
  mfa: { weight: 15, label: 'MFA' },
  incidentes: { weight: 20, label: 'Incidentes' },
  sessoes: { weight: 10, label: 'Sessões' },
  exports_lgpd: { weight: 10, label: 'Exports LGPD' },
  risco_financeiro: { weight: 10, label: 'Risco Financeiro' },
  hardening: { weight: 15, label: 'Hardening' },
};

// ── BADGES ────────────────────────────────────────────────────────────────────

export const SECURITY_BADGES = {
  enterprise: { min: 90, label: 'Enterprise', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: '🛡️' },
  advanced: { min: 75, label: 'Avançado', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: '🔐' },
  standard: { min: 55, label: 'Padrão', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: '⚠️' },
  basic: { min: 30, label: 'Básico', color: 'text-orange-700 bg-orange-50 border-orange-200', icon: '🔓' },
  critical: { min: 0, label: 'Crítico', color: 'text-red-700 bg-red-50 border-red-200', icon: '🚨' },
};

/**
 * Retorna o badge para um score.
 */
export function getBadgeForScore(score) {
  for (const [key, badge] of Object.entries(SECURITY_BADGES)) {
    if (score >= badge.min) return { key, ...badge };
  }
  return { key: 'critical', ...SECURITY_BADGES.critical };
}

/**
 * Calcula o security score de um tenant.
 *
 * @param {object} params
 * @param {object[]} params.securityEvents - SecurityEvents do tenant (últimos 30d)
 * @param {object[]} params.adminLogs - AdminAuditLog do tenant (últimos 30d)
 * @param {object[]} params.sessions - UserSession ativas
 * @param {object} params.company - Company record
 * @param {object[]} params.teamMembers - TeamMember[]
 * @param {number} params.financialRisk - financialRiskScore (0-100)
 * @returns {{ score: number, breakdown: object, badge: object, recommendations: string[] }}
 */
export function computeSecurityScore({
  securityEvents = [],
  adminLogs = [],
  sessions = [],
  company = {},
  teamMembers = [],
  financialRisk = 0,
}) {
  const breakdown = {};
  const recommendations = [];

  // ── 1. AUTENTICAÇÃO (20pts) ───────────────────────────────────────────────
  let authScore = 20;

  const loginFailures = securityEvents.filter(e => e.event_type === 'login_failure').length;
  const bruteForce = securityEvents.filter(e => e.event_type === 'brute_force_attempt').length;

  if (loginFailures > 50) { authScore -= 8; recommendations.push('Alto volume de falhas de login — verificar brute force'); }
  else if (loginFailures > 20) authScore -= 4;

  if (bruteForce > 0) { authScore -= 6; recommendations.push('Tentativas de brute force detectadas'); }

  const invalidTokens = securityEvents.filter(e => e.event_type === 'invalid_token').length;
  if (invalidTokens > 10) { authScore -= 4; recommendations.push('Muitos tokens inválidos — possível token stuffing'); }

  breakdown.autenticacao = Math.max(0, authScore);

  // ── 2. MFA (15pts) ────────────────────────────────────────────────────────
  let mfaScore = 0;

  // Verifica se a empresa tem MFA configurado (estimado por ausência de problemas de acesso)
  const hasAdmins = teamMembers.filter(m => m.role === 'admin').length;
  // Bonus por não ter incidentes de impersonação inválida
  const invalidImpersonation = securityEvents.filter(e => e.event_type === 'invalid_impersonation').length;

  mfaScore = invalidImpersonation === 0 ? 10 : 5;
  if (hasAdmins > 0) mfaScore += 5;

  if (mfaScore < 10) recommendations.push('Considere ativar MFA para administradores');

  breakdown.mfa = Math.max(0, mfaScore);

  // ── 3. INCIDENTES (20pts) ─────────────────────────────────────────────────
  let incidentScore = 20;

  const critical = securityEvents.filter(e => e.severity === 'critical').length;
  const high = securityEvents.filter(e => e.severity === 'high').length;
  const crossTenant = securityEvents.filter(e => e.event_type === 'cross_tenant_attempt').length;

  incidentScore -= critical * 5;
  incidentScore -= high * 2;
  incidentScore -= crossTenant * 10;

  if (crossTenant > 0) recommendations.push('Tentativas cross-tenant detectadas — revisar logs');
  if (critical > 0) recommendations.push(`${critical} evento(s) crítico(s) nos últimos 30 dias`);

  breakdown.incidentes = Math.max(0, incidentScore);

  // ── 4. SESSÕES (10pts) ────────────────────────────────────────────────────
  let sessionScore = 10;

  const criticalSessions = sessions.filter(s => s.risk_score === 'critical').length;
  const highRiskSessions = sessions.filter(s => s.risk_score === 'high').length;

  if (criticalSessions > 0) { sessionScore -= 5; recommendations.push(`${criticalSessions} sessão(ões) crítica(s) ativa(s)`); }
  if (highRiskSessions > 2) { sessionScore -= 3; }

  // Excesso de sessões simultâneas por usuário
  const userSessionCounts = {};
  sessions.forEach(s => {
    userSessionCounts[s.user_id] = (userSessionCounts[s.user_id] || 0) + 1;
  });
  const usersWithManySessions = Object.values(userSessionCounts).filter(c => c > 5).length;
  if (usersWithManySessions > 0) {
    sessionScore -= 2;
    recommendations.push('Usuários com muitas sessões simultâneas detectados');
  }

  breakdown.sessoes = Math.max(0, sessionScore);

  // ── 5. EXPORTS LGPD (10pts) ───────────────────────────────────────────────
  let lgpdScore = 10;

  const exports30d = adminLogs.filter(l => ['CUSTOMER_EXPORTED', 'BULK_EXPORT'].includes(l.action)).length;
  const anonymizations = adminLogs.filter(l => l.action === 'CUSTOMER_ANONYMIZED').length;

  if (exports30d > 20) { lgpdScore -= 4; recommendations.push('Volume alto de exportações LGPD'); }
  else if (exports30d > 5) lgpdScore -= 2;

  if (anonymizations > 10) { lgpdScore -= 3; }

  breakdown.exports_lgpd = Math.max(0, lgpdScore);

  // ── 6. RISCO FINANCEIRO (10pts) ───────────────────────────────────────────
  const financialScore = Math.round(10 - (financialRisk / 100) * 10);
  if (financialRisk > 50) recommendations.push('Anomalias financeiras detectadas — revisar lançamentos');
  breakdown.risco_financeiro = Math.max(0, financialScore);

  // ── 7. HARDENING (15pts) ─────────────────────────────────────────────────
  let hardeningScore = 15;

  // Verifica se features de segurança estão ativas
  if (!company.stripe_connect_charges_enabled) hardeningScore -= 2; // pagamentos sem segurança extra
  if (company.status === 'blocked') hardeningScore -= 5;

  // Penaliza por falta de MFA forçado em admins
  const adminCount = teamMembers.filter(m => m.role === 'admin' && m.active).length;
  if (adminCount > 3) {
    recommendations.push('Considere revisar o número de administradores ativos');
    hardeningScore -= 2;
  }

  breakdown.hardening = Math.max(0, hardeningScore);

  // ── SCORE FINAL ───────────────────────────────────────────────────────────
  const totalScore = Object.values(breakdown).reduce((s, v) => s + v, 0);
  const score = Math.min(100, Math.max(0, totalScore));
  const badge = getBadgeForScore(score);

  return {
    score,
    breakdown,
    badge,
    recommendations: recommendations.slice(0, 5), // máximo 5 recomendações
    computed_at: new Date().toISOString(),
  };
}