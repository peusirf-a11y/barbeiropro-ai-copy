/**
 * sessionGuard.js — Engine de revogação automática de sessões suspeitas.
 *
 * Avalia condições de comprometimento e encerra sessões automaticamente quando necessário.
 * Toda revogação gera AdminAuditLog + SecurityEvent.
 */

// Thresholds de decisão automática
export const SESSION_GUARD_POLICY = {
  // Revoga automaticamente quando score é critical
  AUTO_REVOKE_ON_CRITICAL: true,
  // Apenas alerta quando high (não revoga automaticamente)
  ALERT_ON_HIGH: true,
  // Número máximo de sessões simultâneas permitidas
  MAX_CONCURRENT_SESSIONS: 10,
  // Minutagem de inatividade para expiração automática (client-side)
  INACTIVITY_TIMEOUT_MINUTES: 60,
};

/**
 * Avalia se uma sessão deve ser revogada com base nos sinais disponíveis.
 *
 * @param {object} params
 * @param {object} params.session - Registro de UserSession
 * @param {string} params.currentIp - IP atual do request
 * @param {string} params.currentUA - User-agent atual
 * @param {string} params.currentDeviceId - Device trust ID atual
 * @param {object} params.impossibleTravelResult - Resultado do detectImpossibleTravel
 * @param {number} params.concurrentSessions - Total de sessões ativas do usuário
 * @returns {{ shouldRevoke: boolean, reason: string|null, score: string }}
 */
export function evaluateSessionGuard({
  session,
  currentIp,
  currentUA,
  currentDeviceId,
  impossibleTravelResult = {},
  concurrentSessions = 1,
}) {
  const reasons = [];
  let topScore = 'low';

  const scoreOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  const bump = (s) => {
    if (scoreOrder[s] > scoreOrder[topScore]) topScore = s;
  };

  // 1) Viagem impossível
  if (impossibleTravelResult?.detected) {
    reasons.push(impossibleTravelResult.reason);
    bump(impossibleTravelResult.score);
  }

  // 2) Device trust ID completamente diferente (novo dispositivo suspeito)
  if (session?.device_id && currentDeviceId && session.device_id !== currentDeviceId) {
    reasons.push(`Device ID mudou: ${session.device_id} → ${currentDeviceId}`);
    bump('high');
  }

  // 3) Sessão já marcada como comprometida pelo sistema
  if (session?.risk_score === 'critical') {
    reasons.push('Sessão previamente marcada como crítica');
    bump('critical');
  }

  // 4) Sessões simultâneas excessivas
  if (concurrentSessions > SESSION_GUARD_POLICY.MAX_CONCURRENT_SESSIONS) {
    reasons.push(`${concurrentSessions} sessões simultâneas (limite: ${SESSION_GUARD_POLICY.MAX_CONCURRENT_SESSIONS})`);
    bump('critical');
  }

  // 5) Sessão expirada
  if (session?.expires_at && new Date(session.expires_at) < new Date()) {
    reasons.push('Sessão expirada');
    bump('high');
  }

  // 6) Sessão já revogada
  if (session?.revoked_at) {
    reasons.push('Token replay: sessão já foi revogada');
    bump('critical');
  }

  const shouldRevoke =
    SESSION_GUARD_POLICY.AUTO_REVOKE_ON_CRITICAL && topScore === 'critical';

  return {
    shouldRevoke,
    score: topScore,
    reason: reasons.join(' | ') || null,
    reasons,
  };
}

/**
 * Classifica o Device Trust Score para exibição.
 * @param {object} params
 * @param {'trusted'|'known'|'suspicious'|'unknown'} params.trustLevel
 * @param {string} params.riskScore
 * @returns {{ label: string, color: string, description: string }}
 */
export function getDeviceTrustDisplay({ trustLevel, riskScore }) {
  if (riskScore === 'critical') {
    return {
      label: 'Comprometido',
      color: 'text-red-700 bg-red-50 border-red-200',
      description: 'Sessão com indicadores de comprometimento',
    };
  }

  const map = {
    trusted: {
      label: 'Confiável',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      description: 'Dispositivo com histórico de uso seguro',
    },
    known: {
      label: 'Conhecido',
      color: 'text-blue-700 bg-blue-50 border-blue-200',
      description: 'Dispositivo já visto anteriormente',
    },
    suspicious: {
      label: 'Suspeito',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      description: 'Dispositivo com poucos logins ou inconsistências',
    },
    unknown: {
      label: 'Desconhecido',
      color: 'text-gray-700 bg-gray-50 border-gray-200',
      description: 'Primeiro acesso neste dispositivo',
    },
  };

  return map[trustLevel] || map.unknown;
}

/**
 * Calcula o Device Trust Score numérico (0-100).
 * @param {object} params
 * @param {number} params.successfulLogins - Logins bem-sucedidos no device
 * @param {boolean} params.mfaVerified - MFA foi validado neste device
 * @param {string} params.riskScore - Score de risco atual
 * @param {number} params.daysSinceFirstSeen - Dias desde o primeiro login
 * @param {boolean} params.hasImpossibleTravel - Viagem impossível detectada
 * @returns {number} score 0-100
 */
export function computeDeviceTrustScore({
  successfulLogins = 0,
  mfaVerified = false,
  riskScore = 'low',
  daysSinceFirstSeen = 0,
  hasImpossibleTravel = false,
}) {
  let score = 0;

  // Base: logins bem-sucedidos (max 40 pts)
  score += Math.min(successfulLogins * 8, 40);

  // MFA validado (+20 pts)
  if (mfaVerified) score += 20;

  // Tempo de uso (+10 pts, max aos 30 dias)
  score += Math.min(daysSinceFirstSeen, 30) / 3;

  // Penalidades por risco
  const riskPenalty = { low: 0, medium: -10, high: -25, critical: -50 };
  score += riskPenalty[riskScore] || 0;

  // Viagem impossível (-30 pts)
  if (hasImpossibleTravel) score -= 30;

  return Math.max(0, Math.min(100, Math.round(score)));
}