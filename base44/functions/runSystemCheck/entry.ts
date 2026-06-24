// runSystemCheck — diagnóstico de produção (admin-only)
// Verifica: Z-API, Asaas (gateway oficial de pagamento), contagem de empresas em trial, automations ativas.
// NÃO envia mensagens reais — apenas valida conexões e configuração.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: runSystemCheck');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Forbidden: Super Admin only' }, { status: 403 });
    }

    const result = {
      whatsapp: 'unknown',
      email: 'unknown',
      asaas: 'unknown',
      trial_companies: 0,
      blocked_companies: 0,
      checked_at: new Date().toISOString(),
    };

    // --- Z-API ---
    try {
      const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
      const token = Deno.env.get('ZAPI_TOKEN');
      const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
      const isPlaceholder = (v) => !v || ['pending', 'todo', 'placeholder', 'test'].includes(String(v).toLowerCase());
      if (isPlaceholder(instanceId) || isPlaceholder(token)) {
        result.whatsapp = 'not_configured';
      } else {
        const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
        const headers = {};
        if (clientToken) headers['Client-Token'] = clientToken;
        const res = await fetch(url, { headers });
        const data = await res.json().catch(() => ({}));
        result.whatsapp = res.ok && data?.connected ? 'ok' : 'disconnected';
        result.whatsapp_detail = data;
      }
    } catch (err) {
      console.error('whatsapp check failed:', err.message);
      result.whatsapp = 'error';
      result.whatsapp_error = err.message;
    }

    // --- Asaas (gateway oficial de pagamento das assinaturas SaaS) ---
    try {
      const asaasKey = Deno.env.get('ASAAS_API_KEY');
      const environment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
      const baseUrl = Deno.env.get('ASAAS_BASE_URL')
        || (environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
      if (!asaasKey) {
        result.asaas = 'not_configured';
      } else {
        // Chamada leve (saldo) para validar a chave
        const res = await fetch(`${baseUrl}/finance/balance`, {
          headers: { Accept: 'application/json', access_token: asaasKey },
        });
        if (res.ok) {
          result.asaas = 'ok';
          result.asaas_environment = environment;
        } else if (res.status === 401 || res.status === 403) {
          result.asaas = 'error';
          result.asaas_error = `unauthorized (HTTP ${res.status})`;
        } else {
          result.asaas = 'degraded';
          result.asaas_error = `HTTP ${res.status}`;
        }
      }
    } catch (err) {
      console.error('asaas check failed:', err.message);
      result.asaas = 'error';
      result.asaas_error = err.message;
    }

    // --- Email (Core integration disponível?) ---
    result.email = base44.asServiceRole.integrations?.Core?.SendEmail ? 'ok' : 'not_available';

    // --- Empresas em trial / bloqueadas ---
    try {
      const trialing = await base44.asServiceRole.entities.Company.filter({ subscription_status: 'trialing' }, '-created_date', 1000);
      result.trial_companies = trialing?.length || 0;
      const blocked = await base44.asServiceRole.entities.Company.filter({ status: 'blocked' }, '-created_date', 1000);
      result.blocked_companies = blocked?.length || 0;
    } catch (err) {
      console.error('company count failed:', err.message);
      result.companies_error = err.message;
    }

    // --- Rate limit ativos / sessões ativas / impersonações ativas ---
    try {
      const now = Date.now();
      const activeBlocks = await base44.asServiceRole.entities.SecurityRateLimit
        .filter({ is_blocked: true }, '-created_date', 500)
        .catch(() => []);
      result.rate_limit_active = activeBlocks.filter(r =>
        r.blocked_until && new Date(r.blocked_until).getTime() > now
      ).length;

      const activeSessions = await base44.asServiceRole.entities.UserSession
        .filter({ is_active: true }, '-created_date', 1000)
        .catch(() => []);
      result.active_sessions = activeSessions.length;

      if (base44.asServiceRole.entities.ImpersonationSession) {
        const activeImp = await base44.asServiceRole.entities.ImpersonationSession
          .filter({ ended_at: null }, '-created_date', 100)
          .catch(() => []);
        result.active_impersonations = activeImp.length;
      }
    } catch (err) {
      console.error('operational counts failed:', err.message);
      result.operational_error = err.message;
    }

    // Status global derivado
    const checks = [result.whatsapp, result.asaas, result.email];
    const hasError = checks.includes('error');
    const hasDegraded = checks.includes('not_configured') || checks.includes('disconnected');
    result.overall_status = hasError ? 'critical' : hasDegraded ? 'degraded' : 'healthy';

    console.log('JOB END: runSystemCheck', { overall: result.overall_status });
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error('JOB ERROR: runSystemCheck:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});