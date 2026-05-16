/**
 * geoipResolver.js — Resolução GeoIP real com enriquecimento de risco.
 *
 * Usa ip-api.com (free, sem chave, 45 req/min, adequado para uso no Deno backend).
 * Fallback para heurística de bloco se a API falhar.
 * 
 * NUNCA chamar do frontend — somente backend (Deno functions).
 */

// ── TIPOS DE REDE ─────────────────────────────────────────────────────────────

const DATACENTER_ASNS = [
  'AS14618', // Amazon AWS
  'AS16509', // Amazon AWS
  'AS15169', // Google Cloud
  'AS8075',  // Microsoft Azure
  'AS14061', // DigitalOcean
  'AS396982',// Google Cloud
  'AS13335', // Cloudflare
  'AS20473', // Vultr
  'AS63949', // Linode/Akamai
  'AS16276', // OVH
  'AS24940', // Hetzner
  'AS47583', // Hostinger
];

// Provedor conhecidos de VPN comercial (por string parcial do ISP)
const VPN_ISP_HINTS = [
  'nordvpn', 'expressvpn', 'surfshark', 'mullvad', 'protonvpn', 'purevpn',
  'ipvanish', 'cyberghost', 'privatevpn', 'hidemyass', 'windscribe',
  'tunnelbear', 'hotspot shield', 'avast vpn', 'norton vpn',
];

// Heurística fallback de região por primeiro octeto
const REGION_BY_OCTET = {
  '10': 'private', '127': 'private', '172': 'private', '192': 'private',
  '177': 'BR', '179': 'BR', '187': 'BR', '189': 'BR',
  '191': 'LATAM', '200': 'LATAM', '201': 'LATAM',
  '3': 'NA', '4': 'NA', '8': 'NA', '12': 'NA', '34': 'NA', '52': 'NA', '54': 'NA',
  '62': 'EU', '77': 'EU', '80': 'EU', '82': 'EU', '85': 'EU', '185': 'EU', '193': 'EU', '194': 'EU', '195': 'EU',
  '1': 'APAC', '14': 'APAC', '27': 'APAC', '42': 'APAC', '43': 'APAC', '58': 'APAC', '59': 'APAC',
  '41': 'AF', '105': 'AF', '196': 'AF', '197': 'AF',
};

/**
 * Heurística de fallback (sem API).
 */
function heuristicRegion(ip) {
  if (!ip) return { country: 'unknown', region: 'unknown', networkType: 'unknown', networkTrustScore: 50 };
  const first = ip.split('.')[0];
  const region = REGION_BY_OCTET[first] || 'unknown';
  return {
    country: region === 'BR' ? 'BR' : region === 'private' ? 'private' : 'unknown',
    region,
    city: null,
    isp: null,
    asn: null,
    networkType: region === 'private' ? 'private' : 'unknown',
    isVpn: false,
    isTor: false,
    isProxy: false,
    isDatacenter: false,
    networkTrustScore: region === 'private' ? 70 : 50,
    source: 'heuristic',
  };
}

/**
 * Classifica o tipo de rede e calcula networkTrustScore (0-100).
 */
function classifyNetwork({ isp = '', asn = '', proxy = false, hosting = false }) {
  const ispLower = (isp || '').toLowerCase();
  const isDatacenter = DATACENTER_ASNS.includes(asn) || hosting;
  const isVpn = VPN_ISP_HINTS.some(h => ispLower.includes(h));
  const isProxy = proxy;
  const isTor = ispLower.includes('tor') || ispLower.includes('onion');

  let networkType = 'residential';
  let networkTrustScore = 80;

  if (isTor) { networkType = 'tor'; networkTrustScore = 5; }
  else if (isVpn) { networkType = 'vpn'; networkTrustScore = 25; }
  else if (isProxy) { networkType = 'proxy'; networkTrustScore = 15; }
  else if (isDatacenter) { networkType = 'datacenter'; networkTrustScore = 30; }

  return { networkType, networkTrustScore, isDatacenter, isVpn, isTor, isProxy };
}

/**
 * Resolve GeoIP via ip-api.com.
 * Rate limit: 45 req/min na versão gratuita.
 * @param {string} ip
 * @returns {Promise<object>} dados de geolocalização enriquecidos
 */
export async function resolveGeoIP(ip) {
  if (!ip || ip === 'unknown' || ip.startsWith('192.168') || ip.startsWith('10.') || ip.startsWith('127.')) {
    return heuristicRegion(ip);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout

    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,isp,org,as,proxy,hosting,mobile`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return heuristicRegion(ip);

    const data = await res.json();
    if (data.status !== 'success') return heuristicRegion(ip);

    const networkClass = classifyNetwork({
      isp: data.isp || data.org || '',
      asn: (data.as || '').split(' ')[0],
      proxy: data.proxy,
      hosting: data.hosting,
    });

    // Região padronizada
    const regionMap = {
      'Brazil': 'BR', 'United States': 'NA', 'Canada': 'NA',
      'Germany': 'EU', 'France': 'EU', 'Netherlands': 'EU', 'United Kingdom': 'EU',
      'Japan': 'APAC', 'China': 'APAC', 'India': 'APAC', 'Australia': 'APAC',
      'Nigeria': 'AF', 'South Africa': 'AF',
      'Argentina': 'LATAM', 'Mexico': 'LATAM', 'Colombia': 'LATAM',
    };
    const region = regionMap[data.country] || data.countryCode || 'unknown';

    return {
      country: data.countryCode || 'unknown',
      countryName: data.country || 'unknown',
      region,
      state: data.regionName || null,
      city: data.city || null,
      isp: data.isp || data.org || null,
      asn: (data.as || '').split(' ')[0] || null,
      isMobile: data.mobile || false,
      source: 'ip-api',
      ...networkClass,
    };
  } catch {
    return heuristicRegion(ip);
  }
}

/**
 * Versão síncrona/leve para frontend (apenas estimativa por octeto).
 * NÃO faz chamada de rede.
 */
export function estimateNetworkType(ip) {
  return heuristicRegion(ip);
}