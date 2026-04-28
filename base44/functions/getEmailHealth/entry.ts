// Retorna estatísticas e últimos logs de e-mail.
// - super_admin: vê tudo
// - admin (dono de barbearia): vê apenas logs da própria empresa
// - outros: 403

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isSuper = user.role === 'super_admin';
    const isAdmin = user.role === 'admin';
    if (!isSuper && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    let scopeFilter = {};
    if (!isSuper) {
      // Descobre a empresa do admin
      const companies = await base44.asServiceRole.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
      const companyId = companies?.[0]?.id;
      if (!companyId) return Response.json({ stats: { sent: 0, failed: 0, total: 0 }, logs: [] });
      scopeFilter = { company_id: companyId };
    }

    const logs = await base44.asServiceRole.entities.EmailLog.filter(scopeFilter, '-created_date', 100);
    const sent = logs.filter(l => l.status === 'sent').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    const pending = logs.filter(l => l.status === 'pending').length;

    // Health: saudável se nos últimos 20 envios não houve falha consecutiva
    const last20 = logs.slice(0, 20);
    const recentFailures = last20.filter(l => l.status === 'failed').length;
    const lastSent = logs.find(l => l.status === 'sent');
    const lastFailed = logs.find(l => l.status === 'failed');

    let health = 'healthy';
    if (recentFailures >= 3) health = 'degraded';
    if (recentFailures >= 10) health = 'down';
    if (logs.length === 0) health = 'unknown';

    return Response.json({
      health,
      stats: { sent, failed, pending, total: logs.length },
      last_sent_at: lastSent?.sent_at || lastSent?.created_date || null,
      last_failed_at: lastFailed?.sent_at || lastFailed?.created_date || null,
      last_error: lastFailed?.error_message || null,
      logs,
      scope: isSuper ? 'global' : 'company',
    });
  } catch (error) {
    console.error('getEmailHealth error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});