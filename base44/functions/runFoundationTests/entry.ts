// runFoundationTests — runner manual da suite de testes do Foundation Sprint (F1).
//
// IMPORTANTE — RESTRIÇÃO DE PLATAFORMA:
// Base44 não permite local imports em functions/. Cada function é deployada
// isolada. Por isso os testes são INLINE neste arquivo, em vez de importar
// de tests/unit/lib/*.test.js (que existem para uso local em IDE/Node).
//
// Quando algum helper de lib/ mudar, atualize:
//   1. lib/<helper>.js (fonte da verdade)
//   2. Re-inline as funções aqui (cole o corpo)
//   3. Re-inline os testes aqui (cole de tests/unit/lib/<helper>.test.js)
//   4. Smoke run via dashboard
//
// Não é elegante — mas é a aproximação possível dentro das restrições do
// Base44. Garante regressão zero nos helpers críticos sem exigir CI externo.
//
// ADMIN ONLY.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  parseISO,
  format,
  startOfDay,
  endOfDay,
  addDays,
  subDays,
  differenceInDays,
  isToday as _isToday,
  isValid,
} from 'npm:date-fns@3.6.0';
import { ptBR } from 'npm:date-fns@3.6.0/locale';

// ═══════════════════════════════════════════════════════════════════════
// HELPERS INLINE (espelho de lib/dates.js, lib/money.js, lib/errorCodes.js)
// ═══════════════════════════════════════════════════════════════════════

// ── lib/dates.js ────────────────────────────────────────────────────────
function parseDate(input) {
  if (input == null || input === '') return null;
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
    return isValid(dt) ? dt : null;
  }
  const parsed = parseISO(input);
  return isValid(parsed) ? parsed : null;
}
function formatDate(input, pattern = 'dd/MM/yyyy') {
  const d = parseDate(input);
  return d ? format(d, pattern, { locale: ptBR }) : '';
}
function dayRange(input) {
  const d = parseDate(input);
  if (!d) return { start: null, end: null };
  return { start: startOfDay(d), end: endOfDay(d) };
}
function plusDays(input, n) { const d = parseDate(input); return d ? addDays(d, n) : null; }
function diffDays(later, earlier) {
  const a = parseDate(later), b = parseDate(earlier);
  return (a && b) ? differenceInDays(a, b) : null;
}
function isToday(input) { const d = parseDate(input); return d ? _isToday(d) : false; }
function toISO(input) { const d = parseDate(input); return d ? d.toISOString() : null; }

// ── lib/money.js ────────────────────────────────────────────────────────
function roundBRL(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function calcCommission(price, type, value) {
  const p = Number(price) || 0;
  const v = Number(value) || 0;
  if (type === 'percent') return roundBRL(p * (v / 100));
  if (type === 'fixed')   return roundBRL(v);
  return 0;
}
function validatePrice(input) {
  const n = Number(input);
  if (!Number.isFinite(n)) return { valid: false, error: 'invalid_price' };
  if (n < 0) return { valid: false, error: 'negative_price' };
  const scaled = n * 100;
  if (Math.abs(scaled - Math.round(scaled)) > 0.001) {
    return { valid: false, error: 'precision_exceeded' };
  }
  return { valid: true, value: roundBRL(n) };
}
function formatBRL(value, { symbol = false } = {}) {
  const n = roundBRL(value);
  const str = n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `R$ ${str}` : str;
}
function sumBRL(values) {
  if (!Array.isArray(values)) return 0;
  return roundBRL(values.reduce((acc, v) => acc + (Number(v) || 0), 0));
}

// ── lib/whatsappCompose.js (subset) ────────────────────────────────────
function normalizeWhatsAppNumber(raw, defaultCountry = '55') {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 12) return digits;
  return `${defaultCountry}${digits}`;
}
function buildWhatsAppLink(phone, message) {
  const intl = normalizeWhatsAppNumber(phone);
  if (!intl) return null;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message || '')}`;
}
function interpolateTemplate(template, vars = {}) {
  if (!template) return '';
  return Object.entries(vars).reduce((acc, [k, v]) => {
    const value = String(v ?? '');
    return acc.replaceAll(`{{${k}}}`, value).replaceAll(`{${k}}`, value);
  }, template);
}
// Builders de status — espelho de lib/whatsappCompose.js
function _apptVars({ company, appointment }) {
  const name = appointment?.customer_name || '';
  return {
    nome: name.split(' ')[0] || name,
    barbearia: company?.name || '',
    first_name: name.split(' ')[0] || name,
    company_name: company?.name || '',
  };
}
function buildCancellationMessage({ company, appointment }) {
  return interpolateTemplate(
    'Olá {nome} 👋\n\nSeu horário foi cancelado.\n\nSe desejar, entre em contato para reagendar 🙌',
    _apptVars({ company, appointment })
  );
}
function buildNoShowMessage({ company, appointment }) {
  return interpolateTemplate(
    'Olá {nome} 👋\n\nSentimos sua falta hoje 😅\n\nSe quiser reagendar seu horário, estamos à disposição 🙌',
    _apptVars({ company, appointment })
  );
}

// ── lib/errorCodes.js (subset) ──────────────────────────────────────────
const ERROR_MESSAGES = {
  SLOT_TAKEN: 'Este horário acabou de ser reservado. Escolha outro.',
  FORBIDDEN_ROLE: 'Seu papel não permite essa operação.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde e tente de novo.',
};
function translateError(err, fallback) {
  const payload = err?.response?.data || err?.data || err;
  const errorField = payload?.error ?? payload;
  let code, message;
  if (typeof errorField === 'string') code = errorField;
  else if (errorField && typeof errorField === 'object') {
    code = errorField.code || errorField.error;
    message = errorField.message;
  }
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (message) return message;
  if (fallback) return fallback;
  return 'Algo deu errado. Tente novamente.';
}
function errorResponse(code, extra = {}) {
  return { error: { code, message: ERROR_MESSAGES[code] || code, ...extra } };
}

// ── mockBase44 (subset usado em testes) ─────────────────────────────────
let _idCounter = 0;
function _newId() { _idCounter += 1; return `mock_${Date.now()}_${_idCounter}`; }
function _matches(record, filter) {
  if (!filter) return true;
  for (const [key, expected] of Object.entries(filter)) {
    const actual = record[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$gte' in expected && !(actual >= expected.$gte)) return false;
      if ('$lte' in expected && !(actual <= expected.$lte)) return false;
      if ('$in'  in expected && !expected.$in.includes(actual)) return false;
      continue;
    }
    if (Array.isArray(expected)) { if (!expected.includes(actual)) return false; continue; }
    if (actual !== expected) return false;
  }
  return true;
}
function _sortFn(records, sortKey) {
  if (!sortKey) return records;
  const desc = sortKey.startsWith('-');
  const key = desc ? sortKey.slice(1) : sortKey;
  return [...records].sort((a, b) => {
    if (a[key] === b[key]) return 0;
    if (a[key] == null) return 1;
    if (b[key] == null) return -1;
    return (a[key] < b[key] ? -1 : 1) * (desc ? -1 : 1);
  });
}
function createMockBase44() {
  const store = {};
  const makeApi = (name) => {
    if (!store[name]) store[name] = new Map();
    const t = store[name];
    return {
      async create(data) {
        const id = data.id || _newId();
        const r = { id, created_date: new Date().toISOString(), ...data };
        t.set(id, r); return { ...r };
      },
      async get(id) { const r = t.get(id); if (!r) throw new Error(`${name} not found`); return { ...r }; },
      async filter(f, s, l) {
        let r = [...t.values()].filter(x => _matches(x, f));
        r = _sortFn(r, s);
        return (l ? r.slice(0, l) : r).map(x => ({ ...x }));
      },
      async update(id, p) { const r = t.get(id); if (!r) throw new Error('nf'); const u = { ...r, ...p }; t.set(id, u); return { ...u }; },
      async delete(id) { if (!t.delete(id)) throw new Error('nf'); return { success: true }; },
    };
  };
  const entities = new Proxy({}, { get: (_, n) => typeof n === 'string' ? makeApi(n) : undefined });
  return { entities, asServiceRole: { entities }, __store: store };
}

// ═══════════════════════════════════════════════════════════════════════
// TESTES
// ═══════════════════════════════════════════════════════════════════════

const dateTests = {
  'parseDate aceita Date': () => {
    const d = new Date(2026, 4, 11);
    if (parseDate(d).getTime() !== d.getTime()) throw new Error('Date pass-through quebrado');
  },
  'parseDate YYYY-MM-DD vira meia-noite local': () => {
    const d = parseDate('2026-05-11');
    if (d.getFullYear() !== 2026 || d.getMonth() !== 4 || d.getDate() !== 11) throw new Error('data errada');
    if (d.getHours() !== 0) throw new Error('Não está em meia-noite local');
  },
  'parseDate ISO completo preserva timezone': () => {
    const d = parseDate('2026-05-11T15:30:00Z');
    if (d.toISOString() !== '2026-05-11T15:30:00.000Z') throw new Error(`bad: ${d.toISOString()}`);
  },
  'parseDate retorna null para inválido': () => {
    if (parseDate(null) !== null || parseDate('') !== null || parseDate('lixo') !== null) throw new Error('Não retornou null');
  },
  'formatDate pt-BR': () => {
    const out = formatDate('2026-05-11', 'dd/MM/yyyy');
    if (out !== '11/05/2026') throw new Error(`got ${out}`);
  },
  'dayRange cobre dia inteiro': () => {
    const { start, end } = dayRange('2026-05-11');
    if (start.getHours() !== 0 || end.getHours() !== 23) throw new Error('dayRange fora do esperado');
  },
  'plusDays + diffDays': () => {
    const later = plusDays('2026-05-11', 10);
    if (diffDays(later, '2026-05-11') !== 10) throw new Error('diff broken');
  },
  'isToday detecta hoje': () => {
    if (!isToday(new Date())) throw new Error('hoje deveria ser today');
    if (isToday(plusDays(new Date(), -3))) throw new Error('3 dias atrás não é hoje');
  },
  'toISO converte para UTC': () => {
    const out = toISO(new Date(Date.UTC(2026, 4, 11, 12)));
    if (out !== '2026-05-11T12:00:00.000Z') throw new Error(`bad: ${out}`);
  },
};

const moneyTests = {
  'roundBRL mata drift': () => {
    if (roundBRL(0.1 + 0.2) !== 0.3) throw new Error('drift não tratado');
  },
  'roundBRL trata inválido': () => {
    if (roundBRL('abc') !== 0 || roundBRL(null) !== 0) throw new Error('inválido != 0');
  },
  'calcCommission percent': () => {
    if (calcCommission(50, 'percent', 40) !== 20) throw new Error('40% de 50 != 20');
  },
  'calcCommission fixed': () => {
    if (calcCommission(50, 'fixed', 15) !== 15) throw new Error('fixed 15 != 15');
  },
  'calcCommission com drift': () => {
    if (calcCommission(32, 'percent', 15) !== 4.8) throw new Error('15% de 32 != 4.80');
  },
  'validatePrice aceita 2 casas': () => {
    const r = validatePrice(12.5);
    if (!r.valid || r.value !== 12.5) throw new Error('12.5 deveria ser válido');
  },
  'validatePrice rejeita 3+ casas': () => {
    const r = validatePrice(12.999);
    if (r.valid) throw new Error('12.999 deveria ser rejeitado');
    if (r.error !== 'precision_exceeded') throw new Error(`erro errado: ${r.error}`);
  },
  'validatePrice rejeita negativo': () => {
    if (validatePrice(-1).valid) throw new Error('-1 deveria ser rejeitado');
  },
  'validatePrice rejeita NaN': () => {
    if (validatePrice('abc').valid) throw new Error('NaN deveria ser rejeitado');
  },
  'formatBRL': () => {
    if (formatBRL(1234.5) !== '1.234,50') throw new Error(`bad: ${formatBRL(1234.5)}`);
    if (formatBRL(1234.5, { symbol: true }) !== 'R$ 1.234,50') throw new Error('symbol bad');
  },
  'sumBRL sem drift': () => {
    if (sumBRL([0.1, 0.2, 0.3]) !== 0.6) throw new Error('drift na soma');
  },
};

const errorTests = {
  'translateError formato novo': () => {
    if (translateError({ error: { code: 'SLOT_TAKEN' } }) !== ERROR_MESSAGES.SLOT_TAKEN) throw new Error('bad');
  },
  'translateError formato legado string': () => {
    if (translateError({ error: 'FORBIDDEN_ROLE' }) !== ERROR_MESSAGES.FORBIDDEN_ROLE) throw new Error('bad');
  },
  'translateError aceita axios err': () => {
    const ax = { response: { data: { error: { code: 'RATE_LIMITED' } } } };
    if (translateError(ax) !== ERROR_MESSAGES.RATE_LIMITED) throw new Error('axios bad');
  },
  'translateError usa message se code desconhecido': () => {
    if (translateError({ error: { code: 'X', message: 'oi' } }) !== 'oi') throw new Error('bad');
  },
  'translateError usa fallback': () => {
    if (translateError({ error: 'X' }, 'fb') !== 'fb') throw new Error('fallback broken');
  },
  'translateError genérico final': () => {
    if (!translateError(null)) throw new Error('sem fallback final');
  },
  'errorResponse monta payload': () => {
    const r = errorResponse('SLOT_TAKEN');
    if (r.error.code !== 'SLOT_TAKEN') throw new Error('bad code');
    if (r.error.message !== ERROR_MESSAGES.SLOT_TAKEN) throw new Error('bad msg');
  },
};

const mockTests = {
  'create + get round-trip': async () => {
    const m = createMockBase44();
    const c = await m.entities.Customer.create({ name: 'João' });
    if (!c.id) throw new Error('no id');
    const got = await m.entities.Customer.get(c.id);
    if (got.name !== 'João') throw new Error('round-trip broken');
  },
  'filter por tenant': async () => {
    const m = createMockBase44();
    await m.entities.Customer.create({ name: 'A', company_id: 'co_1' });
    await m.entities.Customer.create({ name: 'B', company_id: 'co_2' });
    const list = await m.entities.Customer.filter({ company_id: 'co_1' });
    if (list.length !== 1 || list[0].name !== 'A') throw new Error('filter broken');
  },
  'operador $gte': async () => {
    const m = createMockBase44();
    await m.entities.FinancialEntry.create({ amount: 50, date: '2026-05-01' });
    await m.entities.FinancialEntry.create({ amount: 100, date: '2026-05-15' });
    const list = await m.entities.FinancialEntry.filter({ date: { $gte: '2026-05-10' } });
    if (list.length !== 1 || list[0].amount !== 100) throw new Error('$gte broken');
  },
  'sort descendente': async () => {
    const m = createMockBase44();
    await m.entities.Customer.create({ name: 'A', total: 1 });
    await m.entities.Customer.create({ name: 'B', total: 5 });
    await m.entities.Customer.create({ name: 'C', total: 3 });
    const list = await m.entities.Customer.filter({}, '-total');
    if (list[0].name !== 'B' || list[2].name !== 'A') throw new Error('sort broken');
  },
  'update muta': async () => {
    const m = createMockBase44();
    const c = await m.entities.Customer.create({ name: 'X' });
    await m.entities.Customer.update(c.id, { name: 'Y' });
    if ((await m.entities.Customer.get(c.id)).name !== 'Y') throw new Error('update broken');
  },
  'delete remove': async () => {
    const m = createMockBase44();
    const c = await m.entities.Customer.create({ name: 'X' });
    await m.entities.Customer.delete(c.id);
    let threw = false;
    try { await m.entities.Customer.get(c.id); } catch { threw = true; }
    if (!threw) throw new Error('delete não removeu');
  },
  'asServiceRole compartilha store': async () => {
    const m = createMockBase44();
    await m.entities.Customer.create({ name: 'X' });
    const list = await m.asServiceRole.entities.Customer.filter({});
    if (list.length !== 1) throw new Error('asServiceRole não vê store');
  },
};

const whatsappTests = {
  'normalize adiciona DDI 55': () => {
    if (normalizeWhatsAppNumber('11987654321') !== '5511987654321') throw new Error('DDI não adicionado');
  },
  'normalize preserva DDI existente': () => {
    if (normalizeWhatsAppNumber('5511987654321') !== '5511987654321') throw new Error('DDI duplicado');
  },
  'normalize remove formatação': () => {
    if (normalizeWhatsAppNumber('(11) 98765-4321') !== '5511987654321') throw new Error('formatação não removida');
  },
  'normalize entrada inválida vira vazia': () => {
    if (normalizeWhatsAppNumber('') !== '') throw new Error('vazia');
    if (normalizeWhatsAppNumber(null) !== '') throw new Error('null');
    if (normalizeWhatsAppNumber('abc') !== '') throw new Error('só letras');
  },
  'buildWhatsAppLink encoda texto': () => {
    const url = buildWhatsAppLink('11987654321', 'Olá tudo bem?');
    if (url !== 'https://wa.me/5511987654321?text=Ol%C3%A1%20tudo%20bem%3F') throw new Error(`bad: ${url}`);
  },
  'buildWhatsAppLink encoda emoji e \\n': () => {
    const url = buildWhatsAppLink('11987654321', 'A\nB 🙌');
    if (!url.includes('%0A')) throw new Error('newline não encodado');
    if (!url.includes('%F0%9F%99%8C')) throw new Error('emoji não encodado');
  },
  'buildWhatsAppLink retorna null sem telefone': () => {
    if (buildWhatsAppLink('', 'oi') !== null) throw new Error('vazio deveria ser null');
    if (buildWhatsAppLink('xxx', 'oi') !== null) throw new Error('lixo deveria ser null');
  },
  'interpolate {nome}': () => {
    if (interpolateTemplate('Oi {nome}', { nome: 'João' }) !== 'Oi João') throw new Error('bad');
  },
  'interpolate {{first_name}}': () => {
    if (interpolateTemplate('Hi {{first_name}}', { first_name: 'João' }) !== 'Hi João') throw new Error('bad');
  },
  'interpolate undefined vira vazio': () => {
    if (interpolateTemplate('A{x}B', { x: undefined }) !== 'AB') throw new Error('bad');
  },
  'buildCancellationMessage usa primeiro nome': () => {
    const msg = buildCancellationMessage({
      company: { name: 'Barb X' },
      appointment: { customer_name: 'João Silva' }
    });
    if (!msg.startsWith('Olá João')) throw new Error(`bad start: ${msg.slice(0, 30)}`);
    if (!msg.includes('cancelado')) throw new Error('sem "cancelado"');
  },
  'buildNoShowMessage menciona falta': () => {
    const msg = buildNoShowMessage({
      company: { name: 'Barb X' },
      appointment: { customer_name: 'Maria' }
    });
    if (!msg.startsWith('Olá Maria')) throw new Error(`bad: ${msg.slice(0, 30)}`);
    if (!msg.includes('Sentimos sua falta')) throw new Error('sem "Sentimos sua falta"');
  },
  'buildCancellationMessage com nome vazio não quebra': () => {
    const msg = buildCancellationMessage({ company: {}, appointment: {} });
    if (typeof msg !== 'string') throw new Error('não-string');
    if (!msg.includes('cancelado')) throw new Error('sem core message');
  },
};

const TEST_MODULES = {
  'lib/dates': dateTests,
  'lib/money': moneyTests,
  'lib/errorCodes': errorTests,
  'lib/whatsappCompose': whatsappTests,
  'mockBase44': mockTests,
};

async function runModule(name, cases) {
  const results = [];
  for (const [testName, fn] of Object.entries(cases)) {
    const t0 = Date.now();
    try {
      await fn();
      results.push({ module: name, name: testName, status: 'pass', ms: Date.now() - t0 });
    } catch (err) {
      results.push({
        module: name, name: testName, status: 'fail',
        ms: Date.now() - t0, error: err?.message || String(err),
      });
    }
  }
  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });

    const allResults = [];
    for (const [name, cases] of Object.entries(TEST_MODULES)) {
      const res = await runModule(name, cases);
      allResults.push(...res);
    }

    const passed = allResults.filter(r => r.status === 'pass').length;
    const failed = allResults.filter(r => r.status === 'fail').length;
    const total = allResults.length;
    const duration = allResults.reduce((s, r) => s + r.ms, 0);

    console.log(`[runFoundationTests] ${passed}/${total} passed in ${duration}ms`);
    if (failed > 0) {
      const fails = allResults.filter(r => r.status === 'fail');
      console.error('[runFoundationTests] FAILURES:', fails.map(r => `${r.module} :: ${r.name} — ${r.error}`).join(' | '));
    }

    return Response.json({
      summary: { passed, failed, total, duration_ms: duration, success: failed === 0 },
      results: allResults,
    });
  } catch (error) {
    console.error('[runFoundationTests] error:', error?.message, error?.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});