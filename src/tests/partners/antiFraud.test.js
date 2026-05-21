// Testes da lógica anti-fraude (mesma estrutura usada por partnerAttribute).
// Esses são testes de pura lógica — replicamos a heurística aqui para garantir
// que a versão da function continue alinhada.

function detectFraud({ partner, company, fingerprint }) {
  const reasons = [];
  const ownerEmail = (company.owner_email || '').toLowerCase();
  const partnerEmail = (partner.email || '').toLowerCase();
  if (ownerEmail && ownerEmail === partnerEmail) reasons.push('same_email');

  const digits = (v) => String(v || '').replace(/\D/g, '');
  const ownerPhone = digits(company.phone) || digits(company.whatsapp);
  if (ownerPhone && partner.phone && digits(partner.phone) === ownerPhone) reasons.push('same_phone');

  if (fingerprint && Array.isArray(partner.fingerprint_seen) && partner.fingerprint_seen.includes(fingerprint)) {
    reasons.push('same_fingerprint');
  }
  return { reasons, score: reasons.length * 35, isFraud: reasons.length >= 1 };
}

export async function runAntiFraudTests() {
  const results = [];
  const assert = (name, cond) => results.push({ name, ok: !!cond });

  const basePartner = { email: 'p@x.com', phone: '11999999999', fingerprint_seen: ['fp_aaa'] };

  // 1. legítimo (nada bate)
  let r = detectFraud({
    partner: basePartner,
    company: { owner_email: 'novo@cliente.com', phone: '11888888888' },
    fingerprint: 'fp_diferente',
  });
  assert('cenário legítimo: nenhuma fraude', !r.isFraud && r.reasons.length === 0);

  // 2. mesmo email
  r = detectFraud({
    partner: basePartner,
    company: { owner_email: 'P@X.COM', phone: '11888888888' },
    fingerprint: 'fp_diferente',
  });
  assert('detecta same_email (case-insensitive)', r.reasons.includes('same_email'));

  // 3. mesmo telefone (formatos diferentes)
  r = detectFraud({
    partner: basePartner,
    company: { owner_email: 'outro@x.com', phone: '(11) 99999-9999' },
    fingerprint: 'fp_diferente',
  });
  assert('detecta same_phone com normalização', r.reasons.includes('same_phone'));

  // 4. mesmo fingerprint
  r = detectFraud({
    partner: basePartner,
    company: { owner_email: 'outro@x.com', phone: '11888888888' },
    fingerprint: 'fp_aaa',
  });
  assert('detecta same_fingerprint', r.reasons.includes('same_fingerprint'));

  // 5. múltiplos sinais somam
  r = detectFraud({
    partner: basePartner,
    company: { owner_email: 'p@x.com', phone: '11999999999' },
    fingerprint: 'fp_aaa',
  });
  assert('múltiplos sinais detectados', r.reasons.length === 3 && r.score === 105);

  // 6. fingerprint vazio não dispara
  r = detectFraud({
    partner: basePartner,
    company: { owner_email: 'novo@x.com', phone: '11888888888' },
    fingerprint: '',
  });
  assert('fingerprint vazio não detecta', !r.isFraud);

  return { passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results };
}