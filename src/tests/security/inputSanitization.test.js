// tests/security/inputSanitization.test.js — Sprint Hardening.
//
// Valida sanitização de payload contra XSS armazenado, CSV injection,
// payload gigante, controle de caracteres.

// Função espelho de createPublicAppointment._sanitizeText
function sanitizeText(v, max = 1000) {
  if (v == null) return '';
  let s = String(v).trim();
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.replace(/\s{3,}/g, '  ');
  return s.slice(0, max);
}

// Função espelho de lib/security/sanitizeCsv.js — prefixa fórmulas com '
function sanitizeCsvCell(v) {
  if (v == null) return '';
  const s = String(v);
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}

// Função espelho de safeRedirect
function isSafeRedirect(url, allowedOrigins) {
  if (!url) return false;
  try {
    const u = new URL(url, 'https://app.ocorte.com.br');
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return allowedOrigins.some(o => u.origin === o);
  } catch {
    return false;
  }
}

export const inputSanitizationTests = {
  'XSS: <script> tag é removida do nome': () => {
    const out = sanitizeText('João <script>alert(1)</script> Silva');
    if (out.includes('<') || out.includes('script')) throw new Error(`tag não removida: "${out}"`);
  },
  'XSS: <img onerror> também removido': () => {
    const out = sanitizeText('<img src=x onerror=alert(1)>');
    if (out.includes('<') || out.includes('onerror')) throw new Error(`payload sobreviveu: "${out}"`);
  },
  'XSS: encoded entities preservados (innocent text)': () => {
    const out = sanitizeText('&lt;script&gt; é só texto');
    if (out !== '&lt;script&gt; é só texto') throw new Error('texto inocente foi alterado');
  },
  'controle char (NULL byte) removido': () => {
    const out = sanitizeText('João\u0000Silva');
    if (out.includes('\u0000')) throw new Error('NULL byte sobreviveu');
  },
  'payload gigante é truncado': () => {
    const huge = 'A'.repeat(50000);
    const out = sanitizeText(huge, 500);
    if (out.length > 500) throw new Error(`não truncou: ${out.length}`);
  },
  'whitespace excessivo é normalizado': () => {
    const out = sanitizeText('João         Silva');
    if (/\s{3,}/.test(out)) throw new Error('whitespace não foi colapsado');
  },
  'CSV injection: =SUM() é prefixado com aspa': () => {
    const out = sanitizeCsvCell('=SUM(A1:A10)');
    if (!out.startsWith("'")) throw new Error('fórmula CSV não foi neutralizada');
  },
  'CSV injection: +1+1 também': () => {
    const out = sanitizeCsvCell('+1+1');
    if (!out.startsWith("'")) throw new Error('+ não foi neutralizado');
  },
  'CSV injection: @SUM também': () => {
    const out = sanitizeCsvCell('@SUM(1,1)');
    if (!out.startsWith("'")) throw new Error('@ não foi neutralizado');
  },
  'CSV injection: texto normal não é afetado': () => {
    const out = sanitizeCsvCell('João Silva');
    if (out !== 'João Silva') throw new Error('texto inocente foi modificado');
  },
  'open redirect: URL externa rejeitada': () => {
    const ok = isSafeRedirect('https://evil.com/steal', ['https://app.ocorte.com.br']);
    if (ok) throw new Error('evil.com foi aceito como redirect');
  },
  'open redirect: URL allowlisted aceita': () => {
    const ok = isSafeRedirect('https://app.ocorte.com.br/dashboard', ['https://app.ocorte.com.br']);
    if (!ok) throw new Error('origem legítima foi rejeitada');
  },
  'open redirect: protocolo javascript: rejeitado': () => {
    const ok = isSafeRedirect('javascript:alert(1)', ['https://app.ocorte.com.br']);
    if (ok) throw new Error('javascript: URL aceita = XSS');
  },
  'open redirect: URL malformada rejeitada': () => {
    const ok = isSafeRedirect('not-a-url://', ['https://app.ocorte.com.br']);
    if (ok) throw new Error('URL inválida aceita');
  },
};