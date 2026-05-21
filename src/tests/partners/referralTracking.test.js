// Testes do client-side tracking. Roda em browser-like com localStorage mockado.
import {
  captureReferralFromUrl,
  getActiveReferral,
  getReferralCode,
  clearReferral,
  getDeviceFingerprint,
} from '../../lib/referralTracking.js';

function setUrl(search) {
  Object.defineProperty(window, 'location', {
    value: { search, pathname: '/', href: 'https://test.app/' + search },
    writable: true,
  });
}

export async function runReferralTrackingTests() {
  const results = [];
  const assert = (name, cond) => results.push({ name, ok: !!cond });

  // 1. captura código válido
  window.localStorage.clear();
  setUrl('?ref=ABC12345');
  const code = captureReferralFromUrl();
  assert('captura ?ref válido', code === 'ABC12345');
  assert('getReferralCode retorna o código', getReferralCode() === 'ABC12345');

  // 2. rejeita código inválido (chars proibidos)
  window.localStorage.clear();
  setUrl('?ref=abc<script>');
  assert('rejeita código com chars inválidos', captureReferralFromUrl() === null);

  // 3. rejeita código muito curto/longo
  window.localStorage.clear();
  setUrl('?ref=ab');
  assert('rejeita código < 4 chars', captureReferralFromUrl() === null);
  setUrl('?ref=' + 'A'.repeat(40));
  assert('rejeita código > 32 chars', captureReferralFromUrl() === null);

  // 4. último clique vence
  window.localStorage.clear();
  setUrl('?ref=FIRST123');
  captureReferralFromUrl();
  setUrl('?ref=SECOND12');
  captureReferralFromUrl();
  assert('último clique sobrescreve', getReferralCode() === 'SECOND12');

  // 5. expiração
  const raw = JSON.parse(window.localStorage.getItem('ocorte_ref'));
  raw.expires_at = new Date(Date.now() - 1000).toISOString();
  window.localStorage.setItem('ocorte_ref', JSON.stringify(raw));
  assert('referral expirado retorna null', getActiveReferral() === null);

  // 6. clearReferral
  setUrl('?ref=CLEARME1');
  captureReferralFromUrl();
  clearReferral();
  assert('clearReferral remove', getReferralCode() === null);

  // 7. fingerprint determinístico
  const fp1 = getDeviceFingerprint();
  const fp2 = getDeviceFingerprint();
  assert('fingerprint estável entre chamadas', fp1 === fp2 && fp1.startsWith('fp_'));

  return { passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results };
}