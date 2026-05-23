// Cliente HTTP centralizado para a API Asaas.
// - Aplica retry exponencial em erros transitórios (5xx, 429, network).
// - Timeout configurável (default 15s).
// - Idempotency-Key opcional em mutations.
// - Logs estruturados (sem expor api key/cpf/cartão).
// - Retorna AsaasError padronizado em qualquer falha.
//
// USO (apenas em backend functions):
//   import { asaasRequest } from '../lib/asaas/client.js';
//   const customer = await asaasRequest('POST', '/customers', { body: {...} });

import { getAsaasConfig, maskApiKey } from './config.js';
import { AsaasError, AsaasErrorCodes } from './errors.js';
import { scrubAsaasPayload } from './sanitize.js';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateCorrelationId() {
  // Crypto-safe random hex (16 bytes → 32 chars). Cai em Date.now() se crypto indisponível.
  try {
    const bytes = new Uint8Array(16);
    (globalThis.crypto || crypto).getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (_) {
    return `t${Date.now()}r${Math.floor(Math.random() * 1e9)}`;
  }
}

function backoffDelay(attempt) {
  // Exponential backoff: 250ms, 500ms, 1000ms + jitter
  const base = 250 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 100);
  return base + jitter;
}

/**
 * Faz uma request à API Asaas.
 *
 * @param {'GET'|'POST'|'PUT'|'DELETE'} method
 * @param {string} path  ex: '/customers'
 * @param {object} options
 * @param {object} [options.body]              JSON body
 * @param {object} [options.query]             query params
 * @param {string} [options.idempotencyKey]    idempotency key (recomendado para POST/PUT)
 * @param {number} [options.timeoutMs]
 * @param {number} [options.maxRetries]
 * @param {string} [options.correlationId]     se já tiver um, passa adiante
 * @returns {Promise<{data: any, requestId: string, status: number}>}
 */
export async function asaasRequest(method, path, options = {}) {
  const cfg = getAsaasConfig();
  if (!cfg.isConfigured) {
    throw new AsaasError({
      code: AsaasErrorCodes.NOT_CONFIGURED,
      message: 'ASAAS_API_KEY não configurada.',
      status: 503,
    });
  }

  const correlationId = options.correlationId || generateCorrelationId();
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : DEFAULT_MAX_RETRIES;

  // Monta URL com query params.
  let url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (options.query && typeof options.query === 'object') {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    }
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'access_token': cfg.apiKey,
    'User-Agent': 'OCorte-SaaS/1.0 (+asaas-migration)',
    'X-Correlation-Id': correlationId,
  };
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const requestBody = options.body ? JSON.stringify(options.body) : undefined;

  let attempt = 0;
  let lastErr = null;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - startedAt;
      const text = await res.text();
      let data = null;
      if (text) {
        try { data = JSON.parse(text); } catch (_) { data = text; }
      }

      // Sucesso
      if (res.ok) {
        console.log('[asaas] ok', {
          method, path, status: res.status, latency_ms: latency,
          correlation_id: correlationId, env: cfg.environment,
        });
        return { data, requestId: correlationId, status: res.status };
      }

      // Erro retentável → cai pro retry
      if (RETRYABLE_STATUSES.has(res.status) && attempt < maxRetries) {
        console.warn('[asaas] retryable', {
          method, path, status: res.status, attempt, latency_ms: latency,
          correlation_id: correlationId,
        });
        attempt += 1;
        await sleep(backoffDelay(attempt));
        continue;
      }

      // Erro definitivo
      const code = res.status === 401 || res.status === 403 ? AsaasErrorCodes.UNAUTHORIZED
        : res.status === 429 ? AsaasErrorCodes.RATE_LIMITED
        : res.status >= 500 ? AsaasErrorCodes.SERVER_ERROR
        : AsaasErrorCodes.BAD_REQUEST;

      console.error('[asaas] error', {
        method, path, status: res.status, code, latency_ms: latency,
        correlation_id: correlationId,
        body_sample: scrubAsaasPayload(options.body),
        response: data,
        api_key: maskApiKey(cfg.apiKey),
      });

      throw new AsaasError({
        code,
        message: extractErrorMessage(data) || `HTTP ${res.status}`,
        status: res.status,
        requestId: correlationId,
        details: data,
      });
    } catch (err) {
      clearTimeout(timeoutId);

      // AsaasError já formatado — não envolve de novo.
      if (err instanceof AsaasError) {
        lastErr = err;
        break;
      }

      // Timeout (AbortError)
      if (err?.name === 'AbortError') {
        console.warn('[asaas] timeout', { method, path, attempt, correlation_id: correlationId });
        if (attempt < maxRetries) {
          attempt += 1;
          await sleep(backoffDelay(attempt));
          continue;
        }
        lastErr = new AsaasError({
          code: AsaasErrorCodes.TIMEOUT,
          message: 'Asaas request timeout.',
          status: 504,
          requestId: correlationId,
        });
        break;
      }

      // Erro de rede genérico
      console.warn('[asaas] network', { method, path, attempt, err: String(err?.message || err), correlation_id: correlationId });
      if (attempt < maxRetries) {
        attempt += 1;
        await sleep(backoffDelay(attempt));
        continue;
      }
      lastErr = new AsaasError({
        code: AsaasErrorCodes.NETWORK,
        message: 'Falha de rede ao chamar Asaas.',
        status: 502,
        requestId: correlationId,
      });
      break;
    }
  }

  throw lastErr || new AsaasError({
    code: AsaasErrorCodes.SERVER_ERROR,
    message: 'Asaas request failed.',
    requestId: correlationId,
  });
}

function extractErrorMessage(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.slice(0, 200);
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((e) => e?.description || e?.code).filter(Boolean).join('; ');
  }
  return data?.message || data?.error || null;
}