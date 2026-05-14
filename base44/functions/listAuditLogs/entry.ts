// listAuditLogs — Listagem paginada e filtrada de audit logs.
// Master: pode ver todos (cross-tenant).
// Usuário normal: NUNCA pode chamar esta função (403).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (!user.is_super_admin) {
      return Response.json({ error: 'FORBIDDEN — audit global apenas para super admin' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      company_id,
      unit_id,
      severity,
      actor_type,
      target_type,
      action,
      actor_email,
      correlation_id,
      request_id,
      date_from,
      date_to,
      limit = 50,
      skip = 0,
    } = body;

    const pageLimit = Math.min(Number(limit) || 50, 200);
    const pageSkip = Number(skip) || 0;

    // Monta filtro dinâmico
    const filter = {};
    if (company_id) filter.company_id = company_id;
    if (unit_id) filter.unit_id = unit_id;
    if (severity) filter.severity = severity;
    if (actor_type) filter.actor_type = actor_type;
    if (target_type) filter.target_type = target_type;
    if (action) filter.action = action;
    if (actor_email) filter.actor_email = actor_email;
    if (correlation_id) filter.correlation_id = correlation_id;
    if (request_id) filter.request_id = request_id;

    let logs;
    if (Object.keys(filter).length > 0) {
      logs = await base44.asServiceRole.entities.AuditLog.filter(filter, '-created_date', pageLimit + pageSkip);
    } else {
      logs = await base44.asServiceRole.entities.AuditLog.list('-created_date', pageLimit + pageSkip);
    }

    // Filtro por período (client-side fallback até termos query range nativa)
    if (date_from || date_to) {
      const from = date_from ? new Date(date_from).getTime() : 0;
      const to = date_to ? new Date(date_to).getTime() : Infinity;
      logs = logs.filter(l => {
        const t = new Date(l.created_date).getTime();
        return t >= from && t <= to;
      });
    }

    const paginated = logs.slice(pageSkip, pageSkip + pageLimit);

    return Response.json({
      logs: paginated,
      total: logs.length,
      limit: pageLimit,
      skip: pageSkip,
      has_more: pageSkip + pageLimit < logs.length,
    });
  } catch (error) {
    console.error('[listAuditLogs]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});