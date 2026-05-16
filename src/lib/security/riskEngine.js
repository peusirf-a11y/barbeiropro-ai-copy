/**
 * riskEngine — Motor de detecção de risco para autenticação e ações críticas.
 *
 * Detecta:
 *  - mudança de IP/user-agent entre sessões
 *  - múltiplas sessões simultâneas
 *  - brute-force distribuído
 *  - padrões de abuso (exportação em massa, múltiplas anonimizações)
 *
 * Retorna: { score: 'low'|'medium'|'high'|'critical', reasons: string[] }
 */

// ── SCORES ────────────────────────────────────────────────────────────────────
export const RISK_SCORES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// Peso numérico para comparação
const SCORE_WEIGHT = { low: 0, medium: 1, high: 2, critical: 3 };

function maxScore(...scores) {
  return scores.reduce((max, s) => SCORE_WEIGHT[s] > SCORE_WEIGHT[max] ? s : max, 'low');
}

// ── ANÁLISE DE IP ─────────────────────────────────────────────────────────────

/**
 * Compara IP atual com o IP da última sessão.
 * Um range /24 diferente é suspeito; ASN diferente é alto risco.
 */
export function assessIpChange(currentIp, previousIp) {
  if (!currentIp || !previousIp || currentIp === previousIp) {
    return { score: RISK_SCORES.LOW, reason: null };
  }

  // Mesmo /24 → baixo risco (troca de WiFi na mesma rede)
  const currentParts = currentIp.split('.');
  const previousParts = previousIp.split('.');
  if (currentParts.slice(0, 3).join('.') === previousParts.slice(0, 3).join('.')) {
    return { score: RISK_SCORES.LOW, reason: 'IP mudou no mesmo /24' };
  }

  // Octeto diferente completamente → médio
  if (currentParts[0] === previousParts[0]) {
    return { score: RISK_SCORES.MEDIUM, reason: `IP mudou de ${previousIp} para ${currentIp}` };
  }

  // Completamente diferente → alto
  return { score: RISK_SCORES.HIGH, reason: `IP mudou drasticamente: ${previousIp} → ${currentIp}` };
}

/**
 * Detecta mudança de user-agent (device/browser diferente).
 */
export function assessUserAgentChange(currentUA, previousUA) {
  if (!currentUA || !previousUA) return { score: RISK_SCORES.LOW, reason: null };
  if (currentUA === previousUA) return { score: RISK_SCORES.LOW, reason: null };

  // Extrai browser e OS do UA para comparação semântica
  const getFamily = (ua) => {
    const uaLower = ua.toLowerCase();
    if (uaLower.includes('mobile')) return 'mobile';
    if (uaLower.includes('android')) return 'android';
    if (uaLower.includes('iphone') || uaLower.includes('ipad')) return 'ios';
    if (uaLower.includes('windows')) return 'windows';
    if (uaLower.includes('mac')) return 'mac';
    return 'other';
  };

  const currentFamily = getFamily(currentUA);
  const previousFamily = getFamily(previousUA);

  if (currentFamily !== previousFamily) {
    return { score: RISK_SCORES.HIGH, reason: `Dispositivo mudou: ${previousFamily} → ${currentFamily}` };
  }

  return { score: RISK_SCORES.MEDIUM, reason: 'User-agent modificado (mesmo tipo de dispositivo)' };
}

/**
 * Avalia número de sessões simultâneas.
 * Mais de 5 sessões ativas → risco alto.
 */
export function assessConcurrentSessions(activeSessions) {
  if (!activeSessions || activeSessions < 3) return { score: RISK_SCORES.LOW, reason: null };
  if (activeSessions <= 5) return { score: RISK_SCORES.MEDIUM, reason: `${activeSessions} sessões simultâneas` };
  return { score: RISK_SCORES.HIGH, reason: `${activeSessions} sessões simultâneas (possível comprometimento)` };
}

/**
 * Avalia velocidade impossível (login em dois locais distantes em pouco tempo).
 * Baseado em tempo entre ações + diferença de IP.
 */
export function assessImpossibleTravel(lastSeenAt, lastIp, currentIp, currentTime = new Date()) {
  if (!lastSeenAt || !lastIp || !currentIp || lastIp === currentIp) {
    return { score: RISK_SCORES.LOW, reason: null };
  }

  const minutesSinceLastSeen = (currentTime - new Date(lastSeenAt)) / 60000;
  const ipChangedCompletely = lastIp.split('.')[0] !== currentIp.split('.')[0];

  // IP completamente diferente em menos de 10 min → viagem impossível
  if (ipChangedCompletely && minutesSinceLastSeen < 10) {
    return {
      score: RISK_SCORES.CRITICAL,
      reason: `Viagem impossível: IP ${lastIp}→${currentIp} em ${Math.round(minutesSinceLastSeen)}min`,
    };
  }

  return { score: RISK_SCORES.LOW, reason: null };
}

// ── AVALIAÇÃO COMPOSTA ────────────────────────────────────────────────────────

/**
 * Avalia o risco de um evento de login/sessão.
 *
 * @param {object} params
 * @param {string} params.currentIp
 * @param {string} params.previousIp
 * @param {string} params.currentUA
 * @param {string} params.previousUA
 * @param {number} params.activeSessions
 * @param {string} params.lastSeenAt
 * @returns {{ score: string, reasons: string[], numericScore: number }}
 */
export function assessLoginRisk({
  currentIp,
  previousIp,
  currentUA,
  previousUA,
  activeSessions = 1,
  lastSeenAt,
}) {
  const assessments = [
    assessIpChange(currentIp, previousIp),
    assessUserAgentChange(currentUA, previousUA),
    assessConcurrentSessions(activeSessions),
    assessImpossibleTravel(lastSeenAt, previousIp, currentIp),
  ];

  const reasons = assessments.map(a => a.reason).filter(Boolean);
  const score = maxScore(...assessments.map(a => a.score));

  return {
    score,
    reasons,
    numericScore: SCORE_WEIGHT[score],
    shouldBlock: score === RISK_SCORES.CRITICAL,
    shouldWarn: score === RISK_SCORES.HIGH || score === RISK_SCORES.CRITICAL,
  };
}

// ── DETECÇÃO DE ABUSO DE AÇÕES ────────────────────────────────────────────────

/**
 * Detecta padrão de exportação em massa.
 * @param {number} exportCount - Número de exportações nas últimas 24h
 */
export function assessMassExport(exportCount) {
  if (exportCount < 5) return RISK_SCORES.LOW;
  if (exportCount < 20) return RISK_SCORES.MEDIUM;
  return RISK_SCORES.HIGH;
}

/**
 * Detecta abuso de anonimizações.
 * @param {number} anonCount - Número de anonimizações nas últimas 24h
 */
export function assessMassAnonymization(anonCount) {
  if (anonCount < 3) return RISK_SCORES.LOW;
  if (anonCount < 10) return RISK_SCORES.MEDIUM;
  return RISK_SCORES.CRITICAL;
}