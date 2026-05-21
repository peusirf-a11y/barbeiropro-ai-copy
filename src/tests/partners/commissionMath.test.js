// Testes de cálculo de comissão + janela de hold.

function calcCommission({ invoiceAmount, pct }) {
  return Number((invoiceAmount * pct / 100).toFixed(2));
}
function holdUntil(nowMs = Date.now()) {
  return new Date(nowMs + 15 * 24 * 60 * 60 * 1000).toISOString();
}
function isHoldExpired(holdISO, nowMs = Date.now()) {
  return new Date(holdISO).getTime() <= nowMs;
}

export async function runCommissionMathTests() {
  const results = [];
  const assert = (name, cond) => results.push({ name, ok: !!cond });

  // 1. 20% sobre R$97
  assert('20% sobre R$97 = R$19,40', calcCommission({ invoiceAmount: 97, pct: 20 }) === 19.4);

  // 2. 20% sobre R$197
  assert('20% sobre R$197 = R$39,40', calcCommission({ invoiceAmount: 197, pct: 20 }) === 39.4);

  // 3. percentual customizado
  assert('30% sobre R$397 = R$119,10', calcCommission({ invoiceAmount: 397, pct: 30 }) === 119.1);

  // 4. arredondamento p/ 2 casas
  assert('arredonda 2 casas', calcCommission({ invoiceAmount: 100, pct: 33.33 }) === 33.33);

  // 5. zero pct = zero comissão
  assert('pct=0 não gera comissão', calcCommission({ invoiceAmount: 100, pct: 0 }) === 0);

  // 6. hold é exatamente 15 dias
  const now = Date.now();
  const hu = holdUntil(now);
  assert('hold_until = +15 dias', new Date(hu).getTime() - now === 15 * 24 * 60 * 60 * 1000);

  // 7. hold ainda em curso
  assert('hold em curso = não expirado', !isHoldExpired(holdUntil(now), now));

  // 8. hold expirado
  const past = new Date(Date.now() - 86400_000).toISOString();
  assert('hold passado = expirado', isHoldExpired(past, Date.now()));

  return { passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results };
}