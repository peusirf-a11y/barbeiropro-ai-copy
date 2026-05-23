// Smoke test da integração Asaas.
// Faz um GET /finance/balance (endpoint leve e seguro) para validar que:
//   1. ASAAS_API_KEY está setada e válida.
//   2. ASAAS_BASE_URL aponta pro ambiente certo (sandbox/prod).
//   3. A rede até o Asaas funciona.
//
// SOMENTE super admin pode chamar. Não retorna saldo bruto nem a chave.
//
// NOTA: backend functions não podem importar de lib/ (cada função é deploy
// isolado). Toda a lógica fica inline aqui. Quando a Sprint 2 vier, vamos
// extrair via base44.functions.invoke('asaasCore', {...}) ou repetir o snippet
// nas próximas funções (curto e estável).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_TIMEOUT_MS = 15_000;

function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '<unset>';
  const prefix = key.startsWith('$aact_prod_') ? '$aact_prod_'
    : key.startsWith('$aact_hmlg_') ? '$aact_hmlg_'
    : key.slice(0, 6);
  return `${prefix}…${key.slice(-4)}`;
}

function getAsaasConfig() {
  const apiKey = Deno.env.get('ASAAS_API_KEY');
  const walletId = Deno.env.get('ASAAS_WALLET_ID');
  const environment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
  const baseUrl = Deno.env.get('ASAAS_BASE_URL')
    || (environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3');
  return { apiKey, walletId, environment, baseUrl, isConfigured: !!apiKey };
}

function generateCorrelationId() {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (_) {
    return `t${Date.now()}r${Math.floor(Math.random() * 1e9)}`;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const cfg = getAsaasConfig();
    if (!cfg.isConfigured) {
      return Response.json({
        ok: false,
        error: 'asaas_not_configured',
        environment: cfg.environment,
        base_url: cfg.baseUrl,
      }, { status: 503 });
    }

    const correlationId = generateCorrelationId();
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const res = await fetch(`${cfg.baseUrl}/finance/balance`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'access_token': cfg.apiKey,
          'User-Agent': 'OCorte-SaaS/1.0 (+asaas-ping)',
          'X-Correlation-Id': correlationId,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - startedAt;
      const text = await res.text();
      let data = null;
      if (text) {
        try { data = JSON.parse(text); } catch (_) { data = text; }
      }

      if (!res.ok) {
        const code = res.status === 401 || res.status === 403 ? 'asaas_unauthorized'
          : res.status === 429 ? 'asaas_rate_limited'
          : res.status >= 500 ? 'asaas_server_error'
          : 'asaas_bad_request';

        console.error('[asaasPing] http_error', {
          actor: user.email,
          env: cfg.environment,
          status: res.status,
          code,
          latency_ms: latency,
          request_id: correlationId,
          response_sample: typeof data === 'object' ? data : String(data).slice(0, 200),
        });
        return Response.json({
          ok: false,
          error: code,
          status: res.status,
          message: extractErrorMessage(data) || `HTTP ${res.status}`,
          environment: cfg.environment,
          base_url: cfg.baseUrl,
          api_key_preview: maskApiKey(cfg.apiKey),
          request_id: correlationId,
        }, { status: res.status });
      }

      console.log('[asaasPing] ok', {
        actor: user.email,
        env: cfg.environment,
        latency_ms: latency,
        request_id: correlationId,
        api_key: maskApiKey(cfg.apiKey),
      });

      return Response.json({
        ok: true,
        environment: cfg.environment,
        base_url: cfg.baseUrl,
        api_key_preview: maskApiKey(cfg.apiKey),
        wallet_id: cfg.walletId || null,
        latency_ms: latency,
        request_id: correlationId,
        balance_present: typeof data === 'object' && data !== null,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const latency = Date.now() - startedAt;
      const code = err?.name === 'AbortError' ? 'asaas_timeout' : 'asaas_network_error';
      console.error('[asaasPing] network', {
        actor: user.email,
        env: cfg.environment,
        code,
        latency_ms: latency,
        request_id: correlationId,
        err: String(err?.message || err),
      });
      return Response.json({
        ok: false,
        error: code,
        message: err?.message || 'network',
        environment: cfg.environment,
        base_url: cfg.baseUrl,
        api_key_preview: maskApiKey(cfg.apiKey),
        request_id: correlationId,
      }, { status: 502 });
    }
  } catch (error) {
    console.error('[asaasPing] unexpected', { message: error?.message });
    return Response.json({
      ok: false,
      error: 'unexpected_error',
      message: error?.message || 'internal',
    }, { status: 500 });
  }
});

function extractErrorMessage(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.slice(0, 200);
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((e) => e?.description || e?.code).filter(Boolean).join('; ');
  }
  return data?.message || data?.error || null;
}