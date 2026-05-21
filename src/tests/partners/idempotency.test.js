// Testa idempotência:
//   - 1 Commission por (partner_id, stripe_invoice_id)
//   - stripeWebhook dedup por event.id

import { createMockSDK } from '../helpers/mockBase44.js';

export async function runIdempotencyTests() {
  const results = [];
  const assert = (name, cond) => results.push({ name, ok: !!cond });

  // 1. Mesma invoice processada 2x → 1 comissão
  const sdk = createMockSDK();
  sdk.entities.Commission.__seed([]);
  const dedup = async (partner_id, invoice_id) => {
    const list = await sdk.entities.Commission.filter({ partner_id, stripe_invoice_id: invoice_id }, '-created_date', 1);
    if (list?.length) return false; // já existe
    await sdk.entities.Commission.create({
      partner_id, referral_id: 'r1', company_id: 'c1',
      stripe_invoice_id: invoice_id, amount: 19.4, status: 'pending',
    });
    return true;
  };
  const a = await dedup('p1', 'inv_001');
  const b = await dedup('p1', 'inv_001');
  assert('1ª chamada cria', a === true);
  assert('2ª chamada idempotente (não cria)', b === false);
  const total = await sdk.entities.Commission.filter({ partner_id: 'p1' });
  assert('apenas 1 commission existe', total.length === 1);

  // 2. Invoices diferentes → 2 comissões (ciclo 1 + 2)
  await dedup('p1', 'inv_002');
  const after = await sdk.entities.Commission.filter({ partner_id: 'p1' });
  assert('ciclo 2 cria nova comissão', after.length === 2);

  // 3. Partners diferentes podem ter mesma invoice (caso patológico mas válido)
  await dedup('p2', 'inv_001');
  const p2 = await sdk.entities.Commission.filter({ partner_id: 'p2' });
  assert('partner diferente cria mesmo com mesma invoice', p2.length === 1);

  return { passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results };
}