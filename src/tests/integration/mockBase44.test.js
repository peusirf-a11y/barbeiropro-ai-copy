// tests/integration/mockBase44.test.js — Smoke tests do próprio mock (F1).
// Garante que o mock se comporta como o SDK real espera, para que outros testes
// confiem nele.

import { createMockBase44 } from '@/tests/helpers/mockBase44';

export const mockBase44Tests = {
  'create + get round-trip': async () => {
    const m = createMockBase44();
    const c = await m.entities.Customer.create({ name: 'João', company_id: 'co_1' });
    if (!c.id) throw new Error('create não devolveu id');
    const got = await m.entities.Customer.get(c.id);
    if (got.name !== 'João') throw new Error('round-trip quebrado');
  },
  'filter por tenant': async () => {
    const m = createMockBase44();
    await m.entities.Customer.create({ name: 'A', company_id: 'co_1' });
    await m.entities.Customer.create({ name: 'B', company_id: 'co_2' });
    const list = await m.entities.Customer.filter({ company_id: 'co_1' });
    if (list.length !== 1) throw new Error(`Esperado 1, got ${list.length}`);
    if (list[0].name !== 'A') throw new Error('Filtro errado');
  },
  'operador $gte funciona': async () => {
    const m = createMockBase44();
    await m.entities.FinancialEntry.create({ amount: 50, date: '2026-05-01' });
    await m.entities.FinancialEntry.create({ amount: 100, date: '2026-05-15' });
    const list = await m.entities.FinancialEntry.filter({ date: { $gte: '2026-05-10' } });
    if (list.length !== 1 || list[0].amount !== 100) throw new Error('$gte broken');
  },
  'sort descendente': async () => {
    const m = createMockBase44();
    await m.entities.Customer.create({ name: 'A', total_appointments: 1 });
    await m.entities.Customer.create({ name: 'B', total_appointments: 5 });
    await m.entities.Customer.create({ name: 'C', total_appointments: 3 });
    const list = await m.entities.Customer.filter({}, '-total_appointments');
    if (list[0].name !== 'B' || list[2].name !== 'A') throw new Error('Sort broken');
  },
  'update muta record': async () => {
    const m = createMockBase44();
    const c = await m.entities.Customer.create({ name: 'X' });
    await m.entities.Customer.update(c.id, { name: 'Y' });
    const got = await m.entities.Customer.get(c.id);
    if (got.name !== 'Y') throw new Error('Update broken');
  },
  'delete remove': async () => {
    const m = createMockBase44();
    const c = await m.entities.Customer.create({ name: 'X' });
    await m.entities.Customer.delete(c.id);
    let threw = false;
    try { await m.entities.Customer.get(c.id); } catch { threw = true; }
    if (!threw) throw new Error('Delete não removeu');
  },
  'auth.me funciona com user setado': async () => {
    const m = createMockBase44({ currentUser: { id: 'u1', email: '[email protected]' } });
    const u = await m.auth.me();
    if (u.email !== '[email protected]') throw new Error('me broken');
  },
  'asServiceRole compartilha store': async () => {
    const m = createMockBase44();
    await m.entities.Customer.create({ name: 'X' });
    const list = await m.asServiceRole.entities.Customer.filter({});
    if (list.length !== 1) throw new Error('asServiceRole não vê o store');
  },
};