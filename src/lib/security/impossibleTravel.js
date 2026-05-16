/**
 * impossibleTravel.js — Detecção de viagem impossível baseada em IP.
 *
 * Detecta logins de localizações geograficamente incompatíveis em curto espaço de tempo.
 * Usa geolocalização aproximada por bloco de IP (não precisa de banco de dados externo).
 * 
 * NÃO bloqueia automaticamente — apenas gera score e motivo para o riskEngine.
 */

// Blocos de IP grandes mapeados para regiões aproximadas
// Baseado nos primeiros octetos (muito simplificado, mas funcional)
const IP_REGION_HINTS = {
  // IANA Special-Purpose
  '10': 'private',
  '127': 'private',
  '172': 'private',
  '192': 'private',

  // Brasil (amostra dos maiores blocos alocados ao LACNIC/Brasil)
  '177': 'BR',
  '179': 'BR',
  '187': 'BR',
  '189': 'BR',
  '191': 'LATAM',
  '200': 'LATAM',
  '201': 'LATAM',

  // EUA / Canadá (grandes blocos ARIN)
  '3': 'NA',
  '4': 'NA',
  '8': 'NA',
  '12': 'NA',
  '13': 'NA',
  '17': 'NA',
  '34': 'NA',
  '52': 'NA',
  '54': 'NA',

  // Europa (RIPE NCC)
  '62': 'EU',
  '77': 'EU',
  '78': 'EU',
  '80': 'EU',
  '82': 'EU',
  '83': 'EU',
  '85': 'EU',
  '91': 'EU',
  '109': 'EU',
  '145': 'EU',
  '185': 'EU',
  '193': 'EU',
  '194': 'EU',
  '195': 'EU',

  // Ásia / Pacífico (APNIC)
  '1': 'APAC',
  '14': 'APAC',
  '27': 'APAC',
  '36': 'APAC',
  '42': 'APAC',
  '43': 'APAC',
  '49': 'APAC',
  '58': 'APAC',
  '59': 'APAC',
  '60': 'APAC',
  '61': 'APAC',
  '101': 'APAC',
  '103': 'APAC',
  '110': 'APAC',
  '111': 'APAC',
  '112': 'APAC',
  '113': 'APAC',
  '114': 'APAC',
  '115': 'APAC',
  '116': 'APAC',
  '117': 'APAC',
  '118': 'APAC',
  '119': 'APAC',
  '120': 'APAC',
  '121': 'APAC',
  '122': 'APAC',
  '123': 'APAC',
  '124': 'APAC',
  '125': 'APAC',
  '126': 'APAC',

  // África (AFRINIC)
  '41': 'AF',
  '105': 'AF',
  '196': 'AF',
  '197': 'AF',
};

/**
 * Estima a região de um IP pelo primeiro octeto.
 * @param {string} ip
 * @returns {string} região aproximada
 */
export function estimateIpRegion(ip) {
  if (!ip) return 'unknown';
  const firstOctet = ip.split('.')[0];
  return IP_REGION_HINTS[firstOctet] || 'unknown';
}

/**
 * Verifica se duas regiões são compatíveis (possível viajar em pouco tempo).
 * @param {string} regionA
 * @param {string} regionB
 * @returns {boolean}
 */
function areRegionsCompatible(regionA, regionB) {
  if (!regionA || !regionB) return true;
  if (regionA === 'private' || regionB === 'private') return true; // VPN/rede local
  if (regionA === 'unknown' || regionB === 'unknown') return true; // não conseguiu determinar
  if (regionA === regionB) return true;
  
  // Regiões vizinhas compatíveis (viagem plausível)
  const compatible = {
    'BR': ['LATAM'],
    'LATAM': ['BR', 'NA'],
    'NA': ['LATAM', 'EU'],
    'EU': ['NA', 'AF'],
    'APAC': ['APAC'],
    'AF': ['EU'],
  };
  
  return compatible[regionA]?.includes(regionB) || false;
}

/**
 * Detecta viagem impossível baseada em IPs e timestamps.
 * 
 * @param {object} params
 * @param {string} params.currentIp - IP da sessão atual
 * @param {string} params.lastIp - IP da última sessão
 * @param {string|Date} params.lastSeenAt - Quando o último IP foi visto
 * @param {Date} [params.now] - Timestamp atual (injetável para testes)
 * @returns {{ detected: boolean, score: string, reason: string|null, details: object }}
 */
export function detectImpossibleTravel({ currentIp, lastIp, lastSeenAt, now = new Date() }) {
  if (!currentIp || !lastIp || !lastSeenAt) {
    return { detected: false, score: 'low', reason: null, details: {} };
  }
  
  if (currentIp === lastIp) {
    return { detected: false, score: 'low', reason: null, details: {} };
  }

  const lastSeen = new Date(lastSeenAt);
  const minutesSince = (now - lastSeen) / 60000;
  
  const currentRegion = estimateIpRegion(currentIp);
  const lastRegion = estimateIpRegion(lastIp);
  
  // Mesmo /24 → troca de WiFi, não suspicious
  const sameSubnet = currentIp.split('.').slice(0, 3).join('.') === lastIp.split('.').slice(0, 3).join('.');
  if (sameSubnet) {
    return { detected: false, score: 'low', reason: null, details: { current_region: currentRegion } };
  }

  const regionsCompatible = areRegionsCompatible(currentRegion, lastRegion);
  const details = {
    current_ip: currentIp,
    last_ip: lastIp,
    current_region: currentRegion,
    last_region: lastRegion,
    minutes_since: Math.round(minutesSince),
  };

  // IP em região completamente diferente em < 10 min → viagem impossível
  if (!regionsCompatible && minutesSince < 10) {
    return {
      detected: true,
      score: 'critical',
      reason: `Viagem impossível: ${lastRegion}→${currentRegion} em ${Math.round(minutesSince)} min (${lastIp}→${currentIp})`,
      details,
    };
  }

  // IP em região muito diferente em < 60 min → suspeito
  if (!regionsCompatible && minutesSince < 60) {
    return {
      detected: true,
      score: 'high',
      reason: `Mudança geográfica suspeita: ${lastRegion}→${currentRegion} em ${Math.round(minutesSince)} min`,
      details,
    };
  }

  // IP completamente diferente (mesmo /8) em < 5 min → alto risco
  const sameClass = currentIp.split('.')[0] === lastIp.split('.')[0];
  if (!sameClass && minutesSince < 5) {
    return {
      detected: true,
      score: 'high',
      reason: `IP mudou drasticamente em ${Math.round(minutesSince)} min`,
      details,
    };
  }

  return { detected: false, score: 'low', reason: null, details };
}