/**
 * operationalSecurity.test.js — Testes da camada de segurança operacional.
 * 
 * Cobre:
 *  - Impossible travel detection
 *  - Device fingerprint comparison
 *  - Session guard evaluation
 *  - Risk policy responses
 *  - Device trust scoring
 */

import { detectImpossibleTravel, estimateIpRegion } from '../../lib/security/impossibleTravel.js';
import { compareDeviceSignals, classifyDeviceTrust } from '../../lib/security/deviceFingerprint.js';
import { evaluateSessionGuard, computeDeviceTrustScore } from '../../lib/security/sessionGuard.js';
import { getPolicyForRisk, actionRequiresEscalation, ABUSE_THRESHOLDS } from '../../lib/security/riskPolicy.js';
import { assessDeviceTrust, assessLoginRisk } from '../../lib/security/riskEngine.js';

// ── HELPERS ──────────────────────────────────────────────────────────────────

function minutesAgo(n) {
  return new Date(Date.now() - n * 60 * 1000).toISOString();
}

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}: ${e.message}`);
    failed++;
    errors.push({ name, error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`);
}

// ── 1. IMPOSSIBLE TRAVEL ──────────────────────────────────────────────────────

console.log('\n🌍 Impossible Travel Detection');

test('Mesmo IP → sem viagem', () => {
  const r = detectImpossibleTravel({ currentIp: '187.1.1.1', lastIp: '187.1.1.1', lastSeenAt: minutesAgo(5) });
  assertEqual(r.detected, false);
  assertEqual(r.score, 'low');
});

test('Mesmo /24 → sem viagem (troca de WiFi)', () => {
  const r = detectImpossibleTravel({ currentIp: '187.1.1.100', lastIp: '187.1.1.200', lastSeenAt: minutesAgo(2) });
  assertEqual(r.detected, false);
});

test('IP BR → IP NA em 5 min → crítico', () => {
  const r = detectImpossibleTravel({
    currentIp: '8.8.8.8',    // NA
    lastIp: '187.1.2.1',     // BR
    lastSeenAt: minutesAgo(5),
    now: new Date(),
  });
  assertEqual(r.detected, true);
  assertEqual(r.score, 'critical');
  assert(r.reason.includes('impossível') || r.reason.includes('Viagem'));
});

test('IP BR → IP NA em 120 min → não detecta viagem impossível', () => {
  const r = detectImpossibleTravel({
    currentIp: '8.8.8.8',
    lastIp: '187.1.2.1',
    lastSeenAt: minutesAgo(120),
    now: new Date(),
  });
  assertEqual(r.detected, false);
});

test('IP BR → IP EU em 30 min → high', () => {
  const r = detectImpossibleTravel({
    currentIp: '80.1.1.1',   // EU
    lastIp: '187.1.2.1',     // BR
    lastSeenAt: minutesAgo(30),
    now: new Date(),
  });
  assertEqual(r.detected, true);
  assertEqual(r.score, 'high');
});

test('IP privado → qualquer IP → sem detecção', () => {
  const r = detectImpossibleTravel({
    currentIp: '8.8.8.8',
    lastIp: '10.0.0.1',
    lastSeenAt: minutesAgo(1),
  });
  assertEqual(r.detected, false);
});

test('estimateIpRegion BR', () => {
  assertEqual(estimateIpRegion('187.1.2.3'), 'BR');
});

test('estimateIpRegion NA', () => {
  assertEqual(estimateIpRegion('8.8.8.8'), 'NA');
});

test('estimateIpRegion privado', () => {
  assertEqual(estimateIpRegion('10.0.0.1'), 'private');
});

test('IP sem dados → sem detecção', () => {
  const r = detectImpossibleTravel({ currentIp: null, lastIp: '187.1.1.1', lastSeenAt: minutesAgo(5) });
  assertEqual(r.detected, false);
});

// ── 2. DEVICE FINGERPRINT ─────────────────────────────────────────────────────

console.log('\n📱 Device Fingerprint');

test('Sinais idênticos → 100% similaridade', () => {
  const signals = { ua_normalized: 'Chrome X', device_family: 'desktop', language: 'pt-BR', timezone: 'America/Sao_Paulo', screen_bucket: '1200x800', cpu_cores: 4, touch_support: false, platform: 'Win32' };
  const { similarity, changed_fields } = compareDeviceSignals(signals, signals);
  assertEqual(similarity, 100);
  assertEqual(changed_fields.length, 0);
});

test('Sinais completamente diferentes → baixa similaridade', () => {
  const sigA = { ua_normalized: 'Chrome', device_family: 'desktop', language: 'pt-BR', timezone: 'America/Sao_Paulo', screen_bucket: '1200x800', cpu_cores: 4, touch_support: false, platform: 'Win32' };
  const sigB = { ua_normalized: 'Safari', device_family: 'mobile', language: 'en-US', timezone: 'UTC', screen_bucket: '400x800', cpu_cores: 2, touch_support: true, platform: 'iPhone' };
  const { similarity } = compareDeviceSignals(sigA, sigB);
  assert(similarity < 20, `Esperado < 20, obtido ${similarity}`);
});

test('classifyDeviceTrust → trusted com 5+ logins', () => {
  const r = classifyDeviceTrust({ deviceTrustId: 'dt_abc', knownDeviceIds: ['dt_abc'], successfulLoginsOnDevice: 5 });
  assertEqual(r, 'trusted');
});

test('classifyDeviceTrust → known com 2-4 logins', () => {
  const r = classifyDeviceTrust({ deviceTrustId: 'dt_abc', knownDeviceIds: ['dt_abc'], successfulLoginsOnDevice: 3 });
  assertEqual(r, 'known');
});

test('classifyDeviceTrust → unknown quando não está na lista', () => {
  const r = classifyDeviceTrust({ deviceTrustId: 'dt_new', knownDeviceIds: ['dt_abc'], successfulLoginsOnDevice: 10 });
  assertEqual(r, 'unknown');
});

// ── 3. SESSION GUARD ──────────────────────────────────────────────────────────

console.log('\n🛡️ Session Guard');

test('Sessão normal → não revoga', () => {
  const r = evaluateSessionGuard({
    session: { risk_score: 'low', is_active: true },
    currentIp: '187.1.1.1',
    currentUA: 'Chrome',
    currentDeviceId: 'dt_abc',
    impossibleTravelResult: { detected: false },
    concurrentSessions: 2,
  });
  assertEqual(r.shouldRevoke, false);
});

test('Sessão já revogada → revoga (token replay)', () => {
  const r = evaluateSessionGuard({
    session: { revoked_at: new Date().toISOString() },
    currentIp: '187.1.1.1',
    impossibleTravelResult: { detected: false },
    concurrentSessions: 1,
  });
  assertEqual(r.shouldRevoke, true);
  assertEqual(r.score, 'critical');
});

test('Viagem impossível crítica → revoga', () => {
  const r = evaluateSessionGuard({
    session: { risk_score: 'low' },
    impossibleTravelResult: { detected: true, score: 'critical', reason: 'Viagem impossível' },
    concurrentSessions: 1,
  });
  assertEqual(r.shouldRevoke, true);
});

test('Device ID diferente → score high', () => {
  const r = evaluateSessionGuard({
    session: { device_id: 'dt_old', risk_score: 'low' },
    currentDeviceId: 'dt_new',
    impossibleTravelResult: { detected: false },
    concurrentSessions: 1,
  });
  assertEqual(r.score, 'high');
});

test('Muitas sessões simultâneas → critical', () => {
  const r = evaluateSessionGuard({
    session: { risk_score: 'low' },
    impossibleTravelResult: { detected: false },
    concurrentSessions: 15,
  });
  assertEqual(r.score, 'critical');
  assertEqual(r.shouldRevoke, true);
});

test('computeDeviceTrustScore → 0 com viagem impossível', () => {
  const score = computeDeviceTrustScore({ successfulLogins: 0, mfaVerified: false, riskScore: 'critical', hasImpossibleTravel: true });
  assert(score === 0, `Esperado 0, obtido ${score}`);
});

test('computeDeviceTrustScore → alto com MFA + histórico', () => {
  const score = computeDeviceTrustScore({ successfulLogins: 10, mfaVerified: true, riskScore: 'low', daysSinceFirstSeen: 30, hasImpossibleTravel: false });
  assert(score >= 70, `Esperado >= 70, obtido ${score}`);
});

// ── 4. RISK POLICY ────────────────────────────────────────────────────────────

console.log('\n⚙️ Risk Policy');

test('LOW → não bloqueia, não exige MFA', () => {
  const p = getPolicyForRisk('low');
  assertEqual(p.block, false);
  assertEqual(p.require_mfa, false);
  assertEqual(p.revoke_session, false);
});

test('MEDIUM → captcha, sem bloquear', () => {
  const p = getPolicyForRisk('medium');
  assertEqual(p.captcha, true);
  assertEqual(p.block, false);
});

test('HIGH → exige MFA, alerta master', () => {
  const p = getPolicyForRisk('high');
  assertEqual(p.require_mfa, true);
  assertEqual(p.alert_master, true);
  assertEqual(p.block, false);
});

test('CRITICAL → bloqueia + revoga + alerta', () => {
  const p = getPolicyForRisk('critical');
  assertEqual(p.block, true);
  assertEqual(p.revoke_session, true);
  assertEqual(p.alert_master, true);
  assert(p.block_duration_minutes > 0);
});

test('CUSTOMER_DELETED → requer confirmação', () => {
  const r = actionRequiresEscalation('CUSTOMER_DELETED', 'low');
  assertEqual(r.requiresConfirm, true);
  assertEqual(r.severity, 'critical');
});

test('APPOINTMENT_DELETED → alto, requer confirmação', () => {
  const r = actionRequiresEscalation('APPOINTMENT_DELETED', 'low');
  assertEqual(r.requiresConfirm, true);
  assertEqual(r.severity, 'high');
});

test('Ação não-crítica → sem confirmação', () => {
  const r = actionRequiresEscalation('VIEW_DASHBOARD', 'low');
  assertEqual(r.requiresConfirm, false);
});

// ── 5. DEVICE TRUST SCORE (riskEngine) ───────────────────────────────────────

console.log('\n🔐 Device Trust Score (riskEngine)');

test('Device confiável → score low', () => {
  const r = assessDeviceTrust({ currentDeviceId: 'dt_abc', sessionDeviceId: 'dt_abc', deviceLoginCount: 10, mfaVerified: true });
  assertEqual(r.level, 'trusted');
  assertEqual(r.riskScore, 'low');
});

test('Device desconhecido (0 logins) → medium', () => {
  const r = assessDeviceTrust({ currentDeviceId: 'dt_new', sessionDeviceId: undefined, deviceLoginCount: 0 });
  assertEqual(r.riskScore, 'medium');
});

test('Device trocado na sessão → high', () => {
  const r = assessDeviceTrust({ currentDeviceId: 'dt_new', sessionDeviceId: 'dt_old', deviceLoginCount: 5 });
  assertEqual(r.riskScore, 'high');
  assert(r.reason !== null);
});

test('assessLoginRisk integrado com device trust', () => {
  const r = assessLoginRisk({
    currentIp: '187.1.1.1',
    previousIp: '187.1.1.1',
    currentUA: 'Chrome',
    previousUA: 'Chrome',
    activeSessions: 1,
    currentDeviceId: 'dt_abc',
    sessionDeviceId: 'dt_abc',
    deviceLoginCount: 5,
  });
  assertEqual(r.score, 'low');
  assert('deviceTrust' in r, 'Deve incluir deviceTrust no resultado');
});

// ── RESULTADO FINAL ───────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} ✅ | ${failed} ❌ | Total: ${passed + failed}`);

if (failed > 0) {
  console.error('\nFalhas:');
  errors.forEach(e => console.error(`  - ${e.name}: ${e.error}`));
  if (typeof globalThis.process !== 'undefined') globalThis.process.exit(1);
}