// checkPrivacyAnomalies — job scheduled (de hora em hora).
// Detecta padrões anômalos relacionados à LGPD:
//   - Excesso de exports por um mesmo ator em 24h
//   - Anonimização em massa
//   - Múltiplos exports de tenants diferentes pelo mesmo ator (insider risk)
//
// Emite SecurityEvent (severity=high) quando passa do threshold.
// Idempotente: a janela é fixa em 1h, e o thresholding interno evita duplicar
// o mesmo alerta no mesmo bucket.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Thresholds — ajustáveis sem deploy via Plan.feature_overrides futuramente.
const T_EXPORTS_PER_ACTOR_24H = 5;
const T_ANONYMIZATIONS_PER_ACTOR_24H = 3;
const T_DISTINCT_TENANTS_PER_ACTOR_24H = 3;

Deno.serve(async (req) => {
  console.log('JOB START: checkPrivacyAnomalies');
  try {
    const base44 = createClientFromRequest(req);

    // Permite execução por automation (sem user) OU super admin manual.
    let isAutomation = false;
    try {
      const user = await base44.auth.me();
      if (!user?.is_super_admin) {
        return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      isAutomation = true;
    }

    const now = Date.now();
    const since24h = new Date(now - DAY).toISOString();
    const sinceHourBucket = new Date(now - HOUR).toISOString();

    // Janela de 24h — log de privacidade
    const privacyLogs = await base44.asServiceRole.entities.PrivacyAuditLog
      .filter({ created_date: { $gte: since24h } }, '-created_date', 5000)
      .catch(() => []);

    // Buckets por ator
    const byActor = {};
    for (const log of privacyLogs) {
      const actor = log.actor_email || 'unknown';
      if (!byActor[actor]) {
        byActor[actor] = {
          actor,
          exports: 0,
          anonymizations: 0,
          tenants: new Set(),
          actions: [],
        };
      }
      const a = byActor[actor];
      if (log.action === 'DATA_EXPORT_REQUESTED' || log.action === 'DATA_EXPORT_DOWNLOADED') a.exports++;
      if (log.action === 'DATA_ANONYMIZED') a.anonymizations++;
      if (log.company_id) a.tenants.add(log.company_id);
      a.actions.push({ action: log.action, at: log.created_date, tenant: log.company_id });
    }

    // Para não duplicar alerta no mesmo bucket de 1h, busca SecurityEvent recentes
    const recentAlerts = await base44.asServiceRole.entities.SecurityEvent
      .filter({
        event_type: 'lgpd_export',
        created_date: { $gte: sinceHourBucket },
      }, '-created_date', 200)
      .catch(() => []);

    const alreadyAlerted = new Set(
      recentAlerts
        .filter(e => e.details?.alert_kind === 'privacy_anomaly')
        .map(e => `${e.actor_email}:${e.details?.reason}`)
    );

    const anomalies = [];
    const created = [];

    for (const a of Object.values(byActor)) {
      const tenantsCount = a.tenants.size;
      const reasons = [];

      if (a.exports >= T_EXPORTS_PER_ACTOR_24H) {
        reasons.push({ reason: 'excessive_exports', value: a.exports, threshold: T_EXPORTS_PER_ACTOR_24H });
      }
      if (a.anonymizations >= T_ANONYMIZATIONS_PER_ACTOR_24H) {
        reasons.push({ reason: 'mass_anonymization', value: a.anonymizations, threshold: T_ANONYMIZATIONS_PER_ACTOR_24H });
      }
      if (tenantsCount >= T_DISTINCT_TENANTS_PER_ACTOR_24H) {
        reasons.push({ reason: 'cross_tenant_access', value: tenantsCount, threshold: T_DISTINCT_TENANTS_PER_ACTOR_24H });
      }

      if (reasons.length === 0) continue;

      // Privacy risk score do ator (0–100)
      let score = 0;
      score += Math.min(40, a.exports * 6);
      score += Math.min(35, a.anonymizations * 10);
      score += Math.min(25, tenantsCount * 8);
      score = Math.min(100, score);

      anomalies.push({
        actor: a.actor,
        exports: a.exports,
        anonymizations: a.anonymizations,
        tenants: tenantsCount,
        risk_score: score,
        reasons,
      });

      // Cria SecurityEvent por motivo (deduplicado pelo bucket de 1h)
      for (const r of reasons) {
        const dedupeKey = `${a.actor}:${r.reason}`;
        if (alreadyAlerted.has(dedupeKey)) continue;

        try {
          await base44.asServiceRole.entities.SecurityEvent.create({
            event_type: 'lgpd_export',
            severity: score >= 70 ? 'critical' : score >= 40 ? 'high' : 'medium',
            actor_email: a.actor,
            route: 'privacy_anomaly_detector',
            blocked: false,
            details: {
              alert_kind: 'privacy_anomaly',
              reason: r.reason,
              value: r.value,
              threshold: r.threshold,
              exports_24h: a.exports,
              anonymizations_24h: a.anonymizations,
              distinct_tenants_24h: tenantsCount,
              risk_score: score,
              window_hours: 24,
              source: isAutomation ? 'automation' : 'manual',
            },
          });
          created.push({ actor: a.actor, reason: r.reason, score });
        } catch (err) {
          console.error('Failed to create SecurityEvent:', err.message);
        }
      }
    }

    console.log('JOB END: checkPrivacyAnomalies', {
      privacy_logs_24h: privacyLogs.length,
      anomalies: anomalies.length,
      alerts_created: created.length,
    });

    return Response.json({
      success: true,
      checked_at: new Date().toISOString(),
      privacy_logs_24h: privacyLogs.length,
      anomalies_detected: anomalies.length,
      alerts_created: created.length,
      anomalies,
      created,
    });
  } catch (error) {
    console.error('JOB ERROR: checkPrivacyAnomalies:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});