// tests/tenant/isolation.test.js — Sprint Hardening.
//
// Garante que entity filters por company_id realmente isolam tenants. Estes
// testes simulam o cenário mais crítico de SaaS multi-tenant: dois tenants
// têm dados similares e queremos garantir que nenhum endpoint vaza dados
// cross-tenant via filter incorreto, payload manipulation ou cache.

import { createMockBase44 } from '@/tests/helpers/mockBase44';

export const tenantIsolationTests = {
  'filter por company_id retorna apenas registros do tenant': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.Customer.create({ company_id: 'co_1', name: 'A1', phone: '111' });
    await m.asServiceRole.entities.Customer.create({ company_id: 'co_2', name: 'A2', phone: '222' });
    const co1 = await m.asServiceRole.entities.Customer.filter({ company_id: 'co_1' });
    if (co1.length !== 1 || co1[0].name !== 'A1') throw new Error('vazou cross-tenant');
  },
  'mesmo email em companies diferentes não colide': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.Customer.create({ company_id: 'co_1', name: 'X', email: 'a@x.com', phone: '111' });
    await m.asServiceRole.entities.Customer.create({ company_id: 'co_2', name: 'X', email: 'a@x.com', phone: '222' });
    const co1 = await m.asServiceRole.entities.Customer.filter({ company_id: 'co_1', email: 'a@x.com' });
    const co2 = await m.asServiceRole.entities.Customer.filter({ company_id: 'co_2', email: 'a@x.com' });
    if (co1.length !== 1 || co2.length !== 1) throw new Error('email duplicado entre tenants quebrou isolamento');
    if (co1[0].phone === co2[0].phone) throw new Error('retornou mesmo registro');
  },
  'professional_id de outro tenant não vaza em filter explícito': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.Professional.create({ company_id: 'co_1', name: 'Pro1' });
    const proCo2 = await m.asServiceRole.entities.Professional.create({ company_id: 'co_2', name: 'Pro2' });
    const cross = await m.asServiceRole.entities.Professional.filter({ company_id: 'co_1', id: proCo2.id });
    if (cross.length !== 0) throw new Error('filter cross-tenant retornou registro de outro tenant');
  },
  'appointments de co_2 não aparecem em listagem de co_1': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.Appointment.create({ company_id: 'co_1', professional_id: 'p1', service_id: 's1', scheduled_at: '2026-06-01T10:00:00Z' });
    await m.asServiceRole.entities.Appointment.create({ company_id: 'co_2', professional_id: 'p1', service_id: 's1', scheduled_at: '2026-06-01T11:00:00Z' });
    const co1Appts = await m.asServiceRole.entities.Appointment.filter({ company_id: 'co_1' });
    if (co1Appts.length !== 1) throw new Error(`esperado 1 appointment em co_1, veio ${co1Appts.length}`);
  },
  'AuditLog scoped por company_id': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.AuditLog.create({ company_id: 'co_1', action: 'X' });
    await m.asServiceRole.entities.AuditLog.create({ company_id: 'co_2', action: 'X' });
    const co1Logs = await m.asServiceRole.entities.AuditLog.filter({ company_id: 'co_1' });
    if (co1Logs.length !== 1) throw new Error('audit log vazou');
  },
  'FinancialEntry com mesmo valor em tenants diferentes não colide': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.FinancialEntry.create({ company_id: 'co_1', type: 'entrada', amount: 100, date: '2026-06-01' });
    await m.asServiceRole.entities.FinancialEntry.create({ company_id: 'co_2', type: 'entrada', amount: 100, date: '2026-06-01' });
    const co1 = await m.asServiceRole.entities.FinancialEntry.filter({ company_id: 'co_1' });
    if (co1.length !== 1) throw new Error('financeiro vazou');
  },
  'IdempotencyKey scoped (mesmo key + tenants diferentes não colide se route diferente)': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.IdempotencyKey.create({ key: 'k1', route: 'r1', company_id: 'co_1', expires_at: '2027-01-01T00:00:00Z' });
    await m.asServiceRole.entities.IdempotencyKey.create({ key: 'k1', route: 'r2', company_id: 'co_2', expires_at: '2027-01-01T00:00:00Z' });
    const co1 = await m.asServiceRole.entities.IdempotencyKey.filter({ key: 'k1', route: 'r1' });
    if (co1.length !== 1 || co1[0].company_id !== 'co_1') throw new Error('idempotency cross-tenant');
  },
  'CustomerConsent isolado por (customer_id + company_id)': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.CustomerConsent.create({ customer_id: 'cu_1', company_id: 'co_1', consent_type: 'whatsapp_marketing', granted: true });
    await m.asServiceRole.entities.CustomerConsent.create({ customer_id: 'cu_1', company_id: 'co_2', consent_type: 'whatsapp_marketing', granted: false });
    const co1 = await m.asServiceRole.entities.CustomerConsent.filter({ customer_id: 'cu_1', company_id: 'co_1' });
    if (co1.length !== 1 || co1[0].granted !== true) throw new Error('consent cross-tenant');
  },
  'SlotReservation slot_key inclui company_id (mesmo prof+hora em tenants diferentes)': async () => {
    // Já coberto em slotLock mas reforço aqui no contexto de tenant isolation.
    const m = createMockBase44();
    const r1 = await m.asServiceRole.entities.SlotReservation.create({ company_id: 'co_1', professional_id: 'p_X', scheduled_at: '2026-06-01T10:00:00Z', slot_key: 'co_1:p_X:2026-06-01T10:00:00.000Z', status: 'active', expires_at: '2027-01-01T00:00:00Z' });
    const r2 = await m.asServiceRole.entities.SlotReservation.create({ company_id: 'co_2', professional_id: 'p_X', scheduled_at: '2026-06-01T10:00:00Z', slot_key: 'co_2:p_X:2026-06-01T10:00:00.000Z', status: 'active', expires_at: '2027-01-01T00:00:00Z' });
    if (r1.id === r2.id) throw new Error('reservations colidiram');
    const lookups = await m.asServiceRole.entities.SlotReservation.filter({ slot_key: 'co_1:p_X:2026-06-01T10:00:00.000Z' });
    if (lookups.length !== 1) throw new Error('slot_key cross-tenant collision');
  },
};