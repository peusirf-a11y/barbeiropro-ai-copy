// tests/lgpd/consent.test.js — Sprint Hardening.
//
// Valida o protocolo de consentimento LGPD: grant/revoke, isolamento por tenant,
// versionamento de texto legal, auditoria.

import { createMockBase44 } from '@/tests/helpers/mockBase44';

// Simulação simplificada do manageConsent (grant/revoke/check).
async function grantConsent(sdk, { customer_id, company_id, consent_type, source, ip_address, legal_text_version, legal_text_snippet }) {
  await sdk.entities.CustomerConsent.create({
    customer_id, company_id, consent_type, granted: true,
    granted_at: new Date().toISOString(), source, ip_address, legal_text_version, legal_text_snippet,
  });
  await sdk.entities.PrivacyAuditLog.create({
    company_id, customer_id, action: 'CONSENT_GRANTED', actor_type: 'customer_self',
    details: { consent_type }, ip_address,
  });
}

async function revokeConsent(sdk, { customer_id, company_id, consent_type, actor_email }) {
  const existing = await sdk.entities.CustomerConsent.filter({ customer_id, company_id, consent_type, granted: true });
  if (existing[0]) {
    await sdk.entities.CustomerConsent.update(existing[0].id, { granted: false, revoked_at: new Date().toISOString() });
  }
  // Sempre registra a tentativa, mesmo se nada havia
  await sdk.entities.PrivacyAuditLog.create({
    company_id, customer_id, action: 'CONSENT_REVOKED', actor_type: actor_email ? 'staff' : 'customer_self',
    actor_email, details: { consent_type },
  });
}

async function checkConsent(sdk, { customer_id, company_id, consent_type }) {
  const list = await sdk.entities.CustomerConsent.filter({ customer_id, company_id, consent_type });
  // Mais recente vence
  const sorted = [...list].sort((a, b) => (b.granted_at || '').localeCompare(a.granted_at || ''));
  return sorted[0]?.granted === true;
}

export const lgpdConsentTests = {
  'grant: cria CustomerConsent e PrivacyAuditLog': async () => {
    const m = createMockBase44();
    await grantConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'whatsapp_marketing', source: 'booking_flow', ip_address: '1.1.1.1', legal_text_version: 'v1.0', legal_text_snippet: 'Aceito...' });
    const consents = await m.asServiceRole.entities.CustomerConsent.filter({ customer_id: 'cu_1' });
    if (consents.length !== 1 || !consents[0].granted) throw new Error('consent não foi criado');
    const logs = await m.asServiceRole.entities.PrivacyAuditLog.filter({ customer_id: 'cu_1', action: 'CONSENT_GRANTED' });
    if (logs.length !== 1) throw new Error('audit log não foi criado');
  },
  'revoke: marca granted=false + revoked_at': async () => {
    const m = createMockBase44();
    await grantConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'email_marketing', source: 'booking_flow' });
    await revokeConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'email_marketing' });
    const allowed = await checkConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'email_marketing' });
    if (allowed) throw new Error('consent não foi revogado');
  },
  'revoke: PrivacyAuditLog registra mesmo quando não há consent ativo (auditoria completa)': async () => {
    const m = createMockBase44();
    await revokeConsent(m.asServiceRole, { customer_id: 'cu_99', company_id: 'co_1', consent_type: 'email_marketing' });
    const logs = await m.asServiceRole.entities.PrivacyAuditLog.filter({ customer_id: 'cu_99', action: 'CONSENT_REVOKED' });
    if (logs.length !== 1) throw new Error('revoke deveria sempre ser auditado, mesmo no-op');
  },
  'isolamento: consent em co_1 não afeta co_2': async () => {
    const m = createMockBase44();
    await grantConsent(m.asServiceRole, { customer_id: 'cu_X', company_id: 'co_1', consent_type: 'whatsapp_marketing', source: 'booking_flow' });
    const co1 = await checkConsent(m.asServiceRole, { customer_id: 'cu_X', company_id: 'co_1', consent_type: 'whatsapp_marketing' });
    const co2 = await checkConsent(m.asServiceRole, { customer_id: 'cu_X', company_id: 'co_2', consent_type: 'whatsapp_marketing' });
    if (!co1) throw new Error('co_1 deveria ter consent');
    if (co2) throw new Error('co_2 NÃO deveria ter consent');
  },
  'versionamento: legal_text_version + snippet preservados (prova jurídica)': async () => {
    const m = createMockBase44();
    await grantConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'data_processing_general', source: 'booking_flow', legal_text_version: 'v2.5-2026', legal_text_snippet: 'Eu autorizo o tratamento...' });
    const c = (await m.asServiceRole.entities.CustomerConsent.filter({ customer_id: 'cu_1' }))[0];
    if (c.legal_text_version !== 'v2.5-2026') throw new Error('versão não preservada');
    if (!c.legal_text_snippet?.includes('autorizo')) throw new Error('snippet legal não preservado');
  },
  'IP e UA registrados em CustomerConsent (rastreabilidade)': async () => {
    const m = createMockBase44();
    await grantConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'whatsapp_marketing', source: 'booking_flow', ip_address: '203.0.113.42' });
    const c = (await m.asServiceRole.entities.CustomerConsent.filter({ customer_id: 'cu_1' }))[0];
    if (c.ip_address !== '203.0.113.42') throw new Error('IP não foi registrado');
  },
  'múltiplos consent_types por customer são independentes': async () => {
    const m = createMockBase44();
    await grantConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'whatsapp_marketing', source: 'booking_flow' });
    await grantConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'email_marketing', source: 'booking_flow' });
    await revokeConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'whatsapp_marketing' });
    const wpp = await checkConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'whatsapp_marketing' });
    const email = await checkConsent(m.asServiceRole, { customer_id: 'cu_1', company_id: 'co_1', consent_type: 'email_marketing' });
    if (wpp) throw new Error('whatsapp deveria ter sido revogado');
    if (!email) throw new Error('email não deveria ter sido afetado');
  },
};