// Fecha um caixa calculando entradas/saídas no SERVIDOR (fonte da verdade).
// Frontend só envia: register_id e final_amount (saldo contado).
// Backend: busca lançamentos desde a abertura, calcula expected_amount e difference.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: closeCashRegister');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { register_id, final_amount, notes } = await req.json().catch(() => ({}));
    if (!register_id) return Response.json({ success: false, error: 'register_id required' }, { status: 400 });
    if (typeof final_amount !== 'number' && typeof final_amount !== 'string') {
      return Response.json({ success: false, error: 'final_amount required' }, { status: 400 });
    }

    const reg = await base44.entities.CashRegister.get(register_id);
    if (!reg) return Response.json({ success: false, error: 'Caixa não encontrado' }, { status: 404 });
    if (reg.status === 'fechado') {
      return Response.json({ success: false, error: 'Caixa já está fechado' }, { status: 400 });
    }

    // Busca todos os lançamentos da empresa criados após a abertura do caixa.
    const all = await base44.entities.FinancialEntry.filter({ company_id: reg.company_id }, '-created_date', 1000);
    const since = new Date(reg.opened_at);
    const entries = all.filter(e => new Date(e.created_date || e.date) >= since);

    const totalIn = entries.filter(e => e.type === 'entrada').reduce((s, e) => s + (e.amount || 0), 0);
    const totalOut = entries.filter(e => e.type === 'saida').reduce((s, e) => s + (e.amount || 0), 0);
    const expected = +((reg.initial_amount || 0) + totalIn - totalOut).toFixed(2);
    const final = +Number(final_amount).toFixed(2);
    const difference = +(final - expected).toFixed(2);

    const updated = await base44.entities.CashRegister.update(register_id, {
      closed_at: new Date().toISOString(),
      final_amount: final,
      expected_amount: expected,
      difference,
      closed_by: user.email,
      notes: [reg.notes, notes].filter(Boolean).join(' · '),
      status: 'fechado',
    });

    console.log('JOB END: closeCashRegister', { register_id, totalIn, totalOut, expected, final, difference });
    return Response.json({ success: true, register: updated, totals: { totalIn, totalOut, expected, final, difference } });
  } catch (error) {
    console.error('JOB ERROR: closeCashRegister:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});