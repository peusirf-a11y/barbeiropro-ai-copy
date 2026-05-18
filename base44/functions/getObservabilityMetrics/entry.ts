// getObservabilityMetrics — Super Admin only.
// Agrega métricas operacionais das últimas 24h/7d para o painel /master/observability.
// Lê de SecurityEvent, AuditLog, EmailLog, SecurityRateLimit, ImpersonationSession.
//
// NÃO executa ações — apenas leitura agregada.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

Deno.serve(async (req) => {
  console.log('JOB START: getObservabilityMetrics');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Forbidden: Super Admin only' }, { status: 403 });
    }

    const now = Date.now();
    const since24h = new Date(now - DAY).toISOString();
    const since7d = new Date(now - 7 * DAY).toISOString();

    // Buscas em paralelo — todas read-only e limitadas
    const [
      securityEvents24h,
      securityEvents7d,
      auditLogs24h,
      emailLogs24h,
      rateLimits,
      activeImpersonations,
    ] = await Promise.all([
      base44.asServiceRole.entities.SecurityEvent
        .filter({ created_date: { $gte: since24h } }, '-created_date', 2000)
        .catch(() => []),
      base44.asServiceRole.entities.SecurityEvent
        .filter({ created_date: { $gte: since7d } }, '-created_date', 5000)
        .catch(() => []),
      base44.asServiceRole.entities.AuditLog
        .filter({ created_date: { $gte: since24h } }, '-created_date', 5000)
        .catch(() => []),
      base44.asServiceRole.entities.EmailLog
        ? base44.asServiceRole.entities.EmailLog
            .filter({ created_date: { $gte: since24h } }, '-created_date', 2000)
            .catch(() => [])
        : Promise.resolve([]),
      base44.asServiceRole.entities.SecurityRateLimit
        .filter({ is_blocked: true }, '-created_date', 500)
        .catch(() => []),
      base44.asServiceRole.entities.ImpersonationSession
        ? base44.asServiceRole.entities.ImpersonationSession
            .filter({ ended_at: null }, '-created_date', 100)
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    // Helpers de agregação
    const countBy = (arr, keyFn) => {
      const out = {};
      for (const item of arr) {
        const k = keyFn(item) || 'unknown';
        out[k] = (out[k] || 0) + 1;
      }
      return out;
    };

    // Time series por hora (24h)
    const seriesByHour = (arr) => {
      const buckets = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        label: `${String(i).padStart(2, '0')}h`,
        count: 0,
      }));
      const baseTime = now - DAY;
      for (const item of arr) {
        const t = new Date(item.created_date).getTime();
        const offset = t - baseTime;
        if (offset < 0 || offset >= DAY) continue;
        const idx = Math.floor(offset / HOUR);
        if (idx >= 0 && idx < 24) buckets[idx].count++;
      }
      return buckets;
    };

    // SecurityEvents — breakdown por tipo e severidade
    const eventsByType = countBy(securityEvents24h, (e) => e.event_type);
    const eventsBySeverity = countBy(securityEvents24h, (e) => e.severity);
    const bruteForce24h = securityEvents24h.filter(e => e.event_type === 'brute_force_attempt').length;
    const failedMfa24h = securityEvents24h.filter(e => e.event_type === 'invalid_token' && /mfa|totp/i.test(JSON.stringify(e.details || {}))).length;
    const invalidImpersonation24h = securityEvents24h.filter(e => e.event_type === 'invalid_impersonation' || e.event_type === 'impersonation_abuse').length;
    const lgpdExports24h = securityEvents24h.filter(e => e.event_type === 'lgpd_export').length;
    const crossTenant24h = securityEvents24h.filter(e => e.event_type === 'cross_tenant_attempt').length;

    // AuditLogs — actions mais frequentes + falhas
    const actionsByType = countBy(auditLogs24h, (a) => a.action);
    const topActions = Object.entries(actionsByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    // Emails — sucesso vs falha (se entidade existe)
    const emailFailed = emailLogs24h.filter(e => e.status === 'error' || e.status === 'failed').length;
    const emailOk = emailLogs24h.filter(e => e.status === 'sent' || e.status === 'success' || e.status === 'delivered').length;

    // Rate limits ativos
    const rateLimitActive = rateLimits.filter(r => {
      if (!r.blocked_until) return false;
      return new Date(r.blocked_until).getTime() > now;
    });

    // Score de saúde simples (0-100)
    let healthScore = 100;
    if (bruteForce24h > 10) healthScore -= 15;
    else if (bruteForce24h > 3) healthScore -= 5;
    if (crossTenant24h > 0) healthScore -= 20;
    if (invalidImpersonation24h > 5) healthScore -= 10;
    if (emailFailed > 0 && emailLogs24h.length > 0) {
      const failRate = emailFailed / (emailFailed + emailOk);
      if (failRate > 0.2) healthScore -= 15;
      else if (failRate > 0.05) healthScore -= 5;
    }
    if (rateLimitActive.length > 20) healthScore -= 10;
    healthScore = Math.max(0, healthScore);

    const status = healthScore >= 85 ? 'healthy' : healthScore >= 60 ? 'degraded' : 'critical';

    const result = {
      success: true,
      checked_at: new Date().toISOString(),
      window_24h: { from: since24h, to: new Date(now).toISOString() },
      health: { score: healthScore, status },
      security: {
        events_24h: securityEvents24h.length,
        events_7d: securityEvents7d.length,
        brute_force_24h: bruteForce24h,
        failed_mfa_24h: failedMfa24h,
        invalid_impersonation_24h: invalidImpersonation24h,
        lgpd_exports_24h: lgpdExports24h,
        cross_tenant_24h: crossTenant24h,
        by_type: eventsByType,
        by_severity: eventsBySeverity,
        series_24h: seriesByHour(securityEvents24h),
      },
      audit: {
        total_24h: auditLogs24h.length,
        top_actions: topActions,
        series_24h: seriesByHour(auditLogs24h),
      },
      email: {
        total_24h: emailLogs24h.length,
        sent: emailOk,
        failed: emailFailed,
        failure_rate: emailLogs24h.length > 0 ? Number((emailFailed / emailLogs24h.length).toFixed(3)) : 0,
      },
      rate_limit: {
        active_blocks: rateLimitActive.length,
        total_recent: rateLimits.length,
      },
      impersonation: {
        active_sessions: activeImpersonations.length,
      },
    };

    console.log('JOB END: getObservabilityMetrics', { health: result.health, events_24h: securityEvents24h.length });
    return Response.json(result);
  } catch (error) {
    console.error('JOB ERROR: getObservabilityMetrics:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});