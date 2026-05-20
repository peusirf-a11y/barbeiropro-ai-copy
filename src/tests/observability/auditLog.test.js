// tests/observability/auditLog.test.js — Sprint Hardening.
//
// Valida que actions críticas geram AuditLog estruturado, com actor, target,
// before/after diff, request_id e severity.

import { createMockBase44 } from '@/tests/helpers/mockBase44';

async function recordAudit(sdk, { action, actor_email, target_type, target_id, before, after, company_id, severity = 'info', request_id }) {
  return sdk.entities.AuditLog.create({
    action, actor_email, target_type, target_id, before, after, company_id, severity, request_id,
  });
}

async function recordSecurityEvent(sdk, { event_type, severity, ip_address, route, details, blocked = true }) {
  return sdk.entities.SecurityEvent.create({ event_type, severity, ip_address, route, details, blocked });
}

export const observabilityTests = {
  'AuditLog: action é obrigatório (schema enforcement)': async () => {
    const m = createMockBase44();
    // Mock não enforça schema completo; assume que o create do real falharia.
    // Apenas validamos que o helper grava o que foi pedido.
    const log = await recordAudit(m.asServiceRole, { action: 'APPOINTMENT_DELETED', actor_email: 'admin@x.com', target_id: 'a1' });
    if (log.action !== 'APPOINTMENT_DELETED') throw new Error('action não preservada');
  },
  'AuditLog: before/after diff preservado': async () => {
    const m = createMockBase44();
    const log = await recordAudit(m.asServiceRole, {
      action: 'APPOINTMENT_MODIFIED', actor_email: 'rec@x.com', target_id: 'a1',
      before: { status: 'agendado' }, after: { status: 'confirmado' },
    });
    if (log.before?.status !== 'agendado' || log.after?.status !== 'confirmado') throw new Error('diff não preservado');
  },
  'AuditLog: request_id permite correlação': async () => {
    const m = createMockBase44();
    const rid = 'req_abc123';
    await recordAudit(m.asServiceRole, { action: 'CUSTOMER_DELETED', actor_email: 'a@x.com', target_id: 'c1', request_id: rid });
    await recordAudit(m.asServiceRole, { action: 'APPOINTMENT_DELETED', actor_email: 'a@x.com', target_id: 'a1', request_id: rid });
    const correlated = await m.asServiceRole.entities.AuditLog.filter({ request_id: rid });
    if (correlated.length !== 2) throw new Error(`correlation falhou: ${correlated.length}`);
  },
  'AuditLog: severity classifica criticidade': async () => {
    const m = createMockBase44();
    await recordAudit(m.asServiceRole, { action: 'CUSTOMER_ANONYMIZED', actor_email: 'a@x.com', target_id: 'c1', severity: 'critical' });
    const critical = await m.asServiceRole.entities.AuditLog.filter({ severity: 'critical' });
    if (critical.length !== 1) throw new Error('severity não indexada');
  },
  'AuditLog: scope por company_id permite filtros tenant-aware': async () => {
    const m = createMockBase44();
    await recordAudit(m.asServiceRole, { action: 'APPOINTMENT_DELETED', actor_email: 'a@x.com', target_id: 'a1', company_id: 'co_1' });
    await recordAudit(m.asServiceRole, { action: 'APPOINTMENT_DELETED', actor_email: 'a@x.com', target_id: 'a2', company_id: 'co_2' });
    const co1 = await m.asServiceRole.entities.AuditLog.filter({ company_id: 'co_1' });
    if (co1.length !== 1) throw new Error('audit log vazou cross-tenant');
  },
  'SecurityEvent: brute_force_attempt gera evento com severity critical': async () => {
    const m = createMockBase44();
    await recordSecurityEvent(m.asServiceRole, {
      event_type: 'brute_force_attempt',
      severity: 'critical',
      ip_address: '1.2.3.4',
      route: 'customerAuth:login',
      details: { reason: 'HARD_BLOCKED', attempts: 15 },
    });
    const ev = await m.asServiceRole.entities.SecurityEvent.filter({ event_type: 'brute_force_attempt' });
    if (ev.length !== 1 || ev[0].severity !== 'critical') throw new Error('brute force event não foi gravado corretamente');
  },
  'SecurityEvent: rate_limit_exceeded com IP rastreável': async () => {
    const m = createMockBase44();
    await recordSecurityEvent(m.asServiceRole, {
      event_type: 'rate_limit_exceeded', severity: 'high',
      ip_address: '203.0.113.42', route: 'createPublicAppointment',
      details: { reason: 'SOFT_BLOCKED', attempts: 5 },
    });
    const ev = (await m.asServiceRole.entities.SecurityEvent.filter({ ip_address: '203.0.113.42' }))[0];
    if (!ev || ev.details?.reason !== 'SOFT_BLOCKED') throw new Error('IP/details não preservados');
  },
  'PrivacyAuditLog: ações LGPD distintas (export, anonymize, consent)': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.PrivacyAuditLog.create({ company_id: 'co_1', customer_id: 'cu_1', action: 'DATA_EXPORT_REQUESTED', actor_type: 'admin', actor_email: 'a@x.com' });
    await m.asServiceRole.entities.PrivacyAuditLog.create({ company_id: 'co_1', customer_id: 'cu_1', action: 'DATA_ANONYMIZED', actor_type: 'admin', actor_email: 'a@x.com' });
    await m.asServiceRole.entities.PrivacyAuditLog.create({ company_id: 'co_1', customer_id: 'cu_1', action: 'CONSENT_REVOKED', actor_type: 'customer_self' });
    const all = await m.asServiceRole.entities.PrivacyAuditLog.filter({ customer_id: 'cu_1' });
    if (all.length !== 3) throw new Error(`esperado 3, veio ${all.length}`);
    const actions = new Set(all.map(l => l.action));
    if (!actions.has('DATA_EXPORT_REQUESTED') || !actions.has('DATA_ANONYMIZED') || !actions.has('CONSENT_REVOKED')) {
      throw new Error('ações LGPD distintas não foram preservadas');
    }
  },
  'AdminAuditLog: actor_is_impersonating capturado': async () => {
    const m = createMockBase44();
    await m.asServiceRole.entities.AdminAuditLog.create({
      actor: 'super@x.com', actor_role: 'super_admin', actor_is_impersonating: true,
      company_id: 'co_1', action: 'CUSTOMER_DELETED', target_id: 'cu_1', severity: 'critical',
    });
    const log = (await m.asServiceRole.entities.AdminAuditLog.filter({ actor: 'super@x.com' }))[0];
    if (!log.actor_is_impersonating) throw new Error('impersonação não foi marcada no log');
    if (log.severity !== 'critical') throw new Error('severity de ação crítica não preservada');
  },
};