/**
 * advancedProtection.test.js — Testes da camada enterprise de segurança.
 *
 * Cobre: bot detection, token replay, webhook replay, captcha gating,
 * enumeração, honeypot, DLP, retenção, risk escalation, anomalias financeiras,
 * geoip, constantTime, webhookGuard.
 *
 * Meta: 50+ testes.
 */

import { collectBotSignals, checkFormFillTiming, getCaptchaMode } from '../../lib/security/botSignals.js';
import { checkHoneypot, validateHoneypot, HONEYPOT_FIELDS } from '../../lib/security/honeypot.js';
import { scanAndRedact, sanitizeObject, validateLGPDExport } from '../../lib/security/dlpScanner.js';
import { RETENTION_POLICY, getRetentionCutoff, generateRetentionReport } from '../../lib/security/dataRetention.js';
import { validateTimestamp, validateNonce } from '../../lib/security/webhookGuard.js';
import { assessFinancialAnomaly, detectAppointmentSpike } from '../../lib/security/financialAnomaly.js';
import { computeSecurityScore, getBadgeForScore } from '../../lib/security/securityScore.js';
import { timingSafeEqual, SAFE_MESSAGES, generateSecureToken } from '../../lib/security/constantTime.js';
import { estimateNetworkType } from '../../lib/security/geoipResolver.js';

// ── HELPERS ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    const r = fn();
    if (r instanceof Promise) {
      // Async test — run separately
      r.then(() => { console.log(`  ✅ ${name}`); passed++; })
       .catch(e => { console.error(`  ❌ ${name}: ${e.message}`); failed++; errors.push({ name, error: e.message }); });
    } else {
      console.log(`  ✅ ${name}`);
      passed++;
    }
  } catch (e) {
    console.error(`  ❌ ${name}: ${e.message}`);
    failed++;
    errors.push({ name, error: e.message });
  }
}

function assert(condition, msg) { if (!condition) throw new Error(msg || 'Assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`); }
function assertIncludes(str, sub, msg) { if (!String(str).includes(sub)) throw new Error(msg || `Expected "${str}" to include "${sub}"`); }

// ── 1. HONEYPOT ───────────────────────────────────────────────────────────────

console.log('\n🍯 Honeypot Detection');

test('Formulário limpo → não detecta bot', () => {
  const r = checkHoneypot({ name: 'João', phone: '11999' });
  assertEqual(r.triggered, false);
  assertEqual(r.fields.length, 0);
});

test('Campo honeypot preenchido → detecta bot', () => {
  const r = checkHoneypot({ name: 'João', [HONEYPOT_FIELDS.WEBSITE]: 'http://spam.com' });
  assertEqual(r.triggered, true);
  assert(r.fields.includes(HONEYPOT_FIELDS.WEBSITE));
});

test('Múltiplos campos honeypot → lista todos', () => {
  const r = checkHoneypot({
    [HONEYPOT_FIELDS.EMAIL_CONFIRM]: 'bot@spam.com',
    [HONEYPOT_FIELDS.PHONE_ALT]: '123456',
  });
  assertEqual(r.triggered, true);
  assertEqual(r.fields.length, 2);
});

test('validateHoneypot: corpo limpo → não é bot', () => {
  const r = validateHoneypot({ name: 'Maria', email: 'maria@email.com' });
  assertEqual(r.isBot, false);
});

test('validateHoneypot: corpo com honeypot → é bot', () => {
  const r = validateHoneypot({ [HONEYPOT_FIELDS.FULL_ADDRESS]: 'Rua Automação, 1' });
  assertEqual(r.isBot, true);
  assert(r.reason !== null);
});

test('Valor vazio no honeypot → não ativa', () => {
  const r = checkHoneypot({ [HONEYPOT_FIELDS.WEBSITE]: '' });
  assertEqual(r.triggered, false);
});

// ── 2. DLP SCANNER ────────────────────────────────────────────────────────────

console.log('\n🔍 DLP Scanner');

test('CPF detectado e redactado', () => {
  const { sanitized, findings } = scanAndRedact('CPF do cliente: 123.456.789-09');
  assertIncludes(sanitized, '[CPF REDACTED]');
  assert(!sanitized.includes('123.456.789-09'));
  assert(findings.some(f => f.includes('cpf')));
});

test('Stripe SK detectado', () => {
  const { sanitized, findings } = scanAndRedact('key=sk_live_abcdefghijklmnopqrst');
  assertIncludes(sanitized, '[STRIPE_SK REDACTED]');
  assert(findings.some(f => f.includes('stripe_secret')));
});

test('JWT detectado e redactado', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc123def456ghi789jkl';
  const { sanitized } = scanAndRedact(jwt);
  assertIncludes(sanitized, '[JWT REDACTED]');
});

test('Hash PBKDF2 detectado', () => {
  const hash = 'a'.repeat(32) + ':' + 'b'.repeat(64);
  const { sanitized } = scanAndRedact(hash);
  assertIncludes(sanitized, '[HASH REDACTED]');
});

test('Texto limpo → sem alterações', () => {
  const input = 'Nome do cliente: João Silva, agendamento às 14h';
  const { sanitized, findings } = scanAndRedact(input);
  assertEqual(sanitized, input);
  assertEqual(findings.length, 0);
});

test('sanitizeObject remove password', () => {
  const obj = { name: 'João', password: 'secret123', email: 'j@email.com' };
  const sanitized = sanitizeObject(obj);
  assertEqual(sanitized.password, '[REDACTED]');
  assertEqual(sanitized.name, 'João');
});

test('sanitizeObject remove auth_token', () => {
  const obj = { id: '123', auth_token: 'abc' + 'def'.repeat(20) };
  const sanitized = sanitizeObject(obj);
  assertEqual(sanitized.auth_token, '[REDACTED]');
});

test('sanitizeObject funciona recursivamente', () => {
  const obj = { customer: { password_hash: 'hash123', name: 'Ana' } };
  const sanitized = sanitizeObject(obj);
  assertEqual(sanitized.customer.password_hash, '[REDACTED]');
  assertEqual(sanitized.customer.name, 'Ana');
});

test('validateLGPDExport: export limpo → aprovado', () => {
  const exportData = { personal_data: { name: 'João', email: 'j@email.com' }, appointments: [] };
  const { clean } = validateLGPDExport(exportData);
  assertEqual(clean, true);
});

test('validateLGPDExport: export com SK → rejeitado', () => {
  const exportData = { personal_data: { name: 'João' }, debug: { key: 'sk_live_abcdefghijklmnopqrst' } };
  const { clean, issues } = validateLGPDExport(exportData);
  assertEqual(clean, false);
  assert(issues.length > 0);
});

// ── 3. WEBHOOK GUARD ──────────────────────────────────────────────────────────

console.log('\n🔒 Webhook Guard');

test('Timestamp recente → válido', () => {
  const ts = Math.floor(Date.now() / 1000);
  const r = validateTimestamp(ts, 300);
  assertEqual(r.valid, true);
});

test('Timestamp muito antigo → inválido', () => {
  const ts = Math.floor(Date.now() / 1000) - 600; // 10 min atrás
  const r = validateTimestamp(ts, 300);
  assertEqual(r.valid, false);
  assert(r.reason !== null);
});

test('Timestamp futuro muito à frente → inválido', () => {
  const ts = Math.floor(Date.now() / 1000) + 600;
  const r = validateTimestamp(ts, 300);
  assertEqual(r.valid, false);
});

test('Timestamp nulo → inválido', () => {
  const r = validateTimestamp(null);
  assertEqual(r.valid, false);
});

test('Nonce único → válido', () => {
  const r = validateNonce('nonce-abc-123', []);
  assertEqual(r.valid, true);
});

test('Nonce duplicado → inválido (replay)', () => {
  const nonce = 'nonce-replay-123';
  const existingEvents = [{
    event_type: 'webhook_replay_attempt',
    details: { nonce },
  }];
  const r = validateNonce(nonce, existingEvents);
  assertEqual(r.valid, false);
  assertIncludes(r.reason, 'Replay');
});

test('Nonce ausente → inválido', () => {
  const r = validateNonce(null, []);
  assertEqual(r.valid, false);
});

// ── 4. CONSTANT TIME ──────────────────────────────────────────────────────────

console.log('\n⏱️ Constant Time');

test('timingSafeEqual: strings iguais → true', async () => {
  const result = await timingSafeEqual('abc123', 'abc123');
  assertEqual(result, true);
});

test('timingSafeEqual: strings diferentes → false', async () => {
  const result = await timingSafeEqual('abc123', 'def456');
  assertEqual(result, false);
});

test('timingSafeEqual: tamanhos diferentes → false', async () => {
  const result = await timingSafeEqual('abc', 'abcdef');
  assertEqual(result, false);
});

test('timingSafeEqual: strings vazias → true', async () => {
  const result = await timingSafeEqual('', '');
  assertEqual(result, true);
});

test('SAFE_MESSAGES: login falha usa mensagem genérica', () => {
  assertIncludes(SAFE_MESSAGES.LOGIN_FAIL, 'Credenciais inválidas');
  assert(!SAFE_MESSAGES.LOGIN_FAIL.toLowerCase().includes('email'));
  assert(!SAFE_MESSAGES.LOGIN_FAIL.toLowerCase().includes('senha'));
});

test('SAFE_MESSAGES: reset não revela existência de conta', () => {
  assertIncludes(SAFE_MESSAGES.RESET_SENT, 'Se existir');
});

test('generateSecureToken: comprimento correto', () => {
  const token = generateSecureToken(32);
  assertEqual(token.length, 64); // 32 bytes = 64 hex chars
});

test('generateSecureToken: tokens únicos', () => {
  const t1 = generateSecureToken();
  const t2 = generateSecureToken();
  assert(t1 !== t2, 'Tokens devem ser únicos');
});

// ── 5. BOT SIGNALS ───────────────────────────────────────────────────────────

console.log('\n🤖 Bot Signals');

test('checkFormFillTiming: tempo < 800ms → bot', () => {
  const r = checkFormFillTiming(200);
  assertEqual(r.isBot, true);
  assert(r.reason !== null);
});

test('checkFormFillTiming: tempo > 800ms → humano', () => {
  const r = checkFormFillTiming(2000);
  assertEqual(r.isBot, false);
});

test('checkFormFillTiming: exatamente 800ms → humano', () => {
  const r = checkFormFillTiming(800);
  assertEqual(r.isBot, false);
});

test('getCaptchaMode: risco low → none', () => {
  assertEqual(getCaptchaMode(0, 'low'), 'none');
});

test('getCaptchaMode: risco medium → invisible', () => {
  assertEqual(getCaptchaMode(25, 'medium'), 'invisible');
});

test('getCaptchaMode: botProbability alto → challenge', () => {
  assertEqual(getCaptchaMode(70, 'low'), 'challenge');
});

test('getCaptchaMode: risco critical → challenge', () => {
  assertEqual(getCaptchaMode(0, 'critical'), 'challenge');
});

// ── 6. ANOMALIA FINANCEIRA ────────────────────────────────────────────────────

console.log('\n💰 Financial Anomaly');

test('Sem dados → score 0', () => {
  const r = assessFinancialAnomaly({ entries: [], appointments: [], company: {} });
  assertEqual(r.score, 0);
  assertEqual(r.severity, 'low');
  assertEqual(r.anomalies.length, 0);
});

test('Ticket médio < R$5 → anomalia', () => {
  const appointments = Array.from({ length: 10 }, (_, i) => ({
    id: `a${i}`, status: 'concluido', price: 2, created_date: new Date().toISOString(),
  }));
  const r = assessFinancialAnomaly({ entries: [], appointments, company: {} });
  assert(r.anomalies.some(a => a.includes('Ticket médio suspeito')));
  assert(r.score > 0);
});

test('Muitos lançamentos excluídos → anomalia', () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({
    id: `e${i}`, type: 'entrada', amount: 100,
    date: new Date().toISOString(),
    deleted_at: new Date().toISOString(),
    created_date: new Date().toISOString(),
  }));
  const r = assessFinancialAnomaly({ entries, appointments: [], company: {} });
  assert(r.anomalies.some(a => a.includes('excluídos')));
});

test('detectAppointmentSpike: normal → não é spike', () => {
  const appts = Array.from({ length: 5 }, (_, i) => ({
    created_date: new Date().toISOString(),
  }));
  const r = detectAppointmentSpike(appts, 1);
  assertEqual(r.isSpike, false);
});

test('detectAppointmentSpike: 25 em 1h → spike', () => {
  const appts = Array.from({ length: 25 }, () => ({
    created_date: new Date().toISOString(),
  }));
  const r = detectAppointmentSpike(appts, 1);
  assertEqual(r.isSpike, true);
  assert(r.reason !== null);
});

// ── 7. RETENÇÃO DE DADOS ──────────────────────────────────────────────────────

console.log('\n📅 Data Retention');

test('user_session: TTL 30 dias', () => {
  assertEqual(RETENTION_POLICY.user_session.ttlDays, 30);
});

test('reset_token: TTL 1 dia', () => {
  assertEqual(RETENTION_POLICY.reset_token.ttlDays, 1);
});

test('admin_audit_critical: nunca deletar', () => {
  assertEqual(RETENTION_POLICY.admin_audit_critical.action, 'retain');
});

test('getRetentionCutoff: retorna data correta', () => {
  const cutoff = getRetentionCutoff('user_session');
  assert(cutoff instanceof Date);
  const diffDays = (new Date() - cutoff) / (1000 * 60 * 60 * 24);
  assert(Math.abs(diffDays - 30) < 1, 'Deve ser ~30 dias atrás');
});

test('getRetentionCutoff: retain → null', () => {
  const cutoff = getRetentionCutoff('admin_audit_critical');
  assertEqual(cutoff, null);
});

test('generateRetentionReport: compliance_score calculado', () => {
  const report = generateRetentionReport({});
  assert(typeof report.compliance_score === 'number');
  assert(report.compliance_score >= 0 && report.compliance_score <= 100);
  assert(Array.isArray(report.policies));
  assert(report.policies.length > 0);
});

// ── 8. SECURITY SCORE ────────────────────────────────────────────────────────

console.log('\n🏆 Security Score');

test('Score sem dados → score base razoável', () => {
  const r = computeSecurityScore({ securityEvents: [], adminLogs: [], sessions: [], company: {}, teamMembers: [] });
  assert(r.score >= 0 && r.score <= 100);
  assert(r.badge !== null);
  assert(Array.isArray(r.recommendations));
});

test('Score com eventos críticos → penalizado', () => {
  const clean = computeSecurityScore({ securityEvents: [], adminLogs: [], sessions: [], company: {}, teamMembers: [] });
  const withCritical = computeSecurityScore({
    securityEvents: Array.from({ length: 5 }, () => ({ severity: 'critical', event_type: 'cross_tenant_attempt' })),
    adminLogs: [], sessions: [], company: {}, teamMembers: [],
  });
  assert(withCritical.score < clean.score, `Esperado ${withCritical.score} < ${clean.score}`);
});

test('getBadgeForScore: 95 → enterprise', () => {
  const badge = getBadgeForScore(95);
  assertEqual(badge.key, 'enterprise');
});

test('getBadgeForScore: 70 → advanced', () => {
  const badge = getBadgeForScore(70);
  assertEqual(badge.key, 'advanced');
});

test('getBadgeForScore: 40 → basic', () => {
  const badge = getBadgeForScore(40);
  assertEqual(badge.key, 'basic');
});

test('getBadgeForScore: 10 → critical', () => {
  const badge = getBadgeForScore(10);
  assertEqual(badge.key, 'critical');
});

test('Score tem breakdown por categoria', () => {
  const r = computeSecurityScore({ securityEvents: [], adminLogs: [], sessions: [], company: {}, teamMembers: [] });
  assert('autenticacao' in r.breakdown);
  assert('mfa' in r.breakdown);
  assert('incidentes' in r.breakdown);
});

// ── 9. GEOIP RESOLVER ────────────────────────────────────────────────────────

console.log('\n🌍 GeoIP Resolver');

test('IP privado → região private', () => {
  const r = estimateNetworkType('10.0.0.1');
  assertEqual(r.country, 'private');
});

test('IP BR → região BR', () => {
  const r = estimateNetworkType('187.1.2.3');
  assertEqual(r.country, 'BR');
});

test('IP NA (Google DNS) → região NA', () => {
  const r = estimateNetworkType('8.8.8.8');
  assert(r.country !== 'private');
});

test('IP nulo → unknown', () => {
  const r = estimateNetworkType(null);
  assertEqual(r.country, 'unknown');
});

test('IP localhost → private', () => {
  const r = estimateNetworkType('127.0.0.1');
  assertEqual(r.country, 'private');
});

// ── RESULTADO FINAL ──────────────────────────────────────────────────────────

setTimeout(() => {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Resultado: ${passed} ✅ | ${failed} ❌ | Total: ${passed + failed}`);
  if (failed > 0) {
    console.error('\nFalhas:');
    errors.forEach(e => console.error(`  - ${e.name}: ${e.error}`));
    if (typeof globalThis.process !== 'undefined') globalThis.process.exit(1);
  } else {
    console.log('✅ Todos os testes passaram!');
  }
}, 500); // aguarda promises async