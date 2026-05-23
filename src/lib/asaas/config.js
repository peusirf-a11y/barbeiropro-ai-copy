// Configuração centralizada do Asaas. Lê apenas de env (Deno.env / process.env).
// NUNCA exporte estes valores para o frontend — só funções backend devem importar daqui.
/* global Deno, process */
/* eslint-disable no-undef */

function readEnv(key) {
  try {
    if (typeof Deno !== 'undefined' && Deno?.env?.get) {
      return Deno.env.get(key);
    }
  } catch (_) { /* noop */ }
  try {
    if (typeof process !== 'undefined' && process?.env) {
      return process.env[key];
    }
  } catch (_) { /* noop */ }
  return undefined;
}

export function getAsaasConfig() {
  const apiKey = readEnv('ASAAS_API_KEY');
  const walletId = readEnv('ASAAS_WALLET_ID');
  const environment = readEnv('ASAAS_ENVIRONMENT') || 'sandbox';
  const baseUrl = readEnv('ASAAS_BASE_URL')
    || (environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3');
  const webhookToken = readEnv('ASAAS_WEBHOOK_TOKEN');

  return {
    apiKey,
    walletId,
    environment,
    baseUrl,
    webhookToken,
    isConfigured: !!apiKey,
  };
}

// Mascara a chave de API para logs (mostra só prefixo do tipo + últimos 4 chars).
export function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '<unset>';
  const prefix = key.startsWith('$aact_prod_') ? '$aact_prod_'
    : key.startsWith('$aact_hmlg_') ? '$aact_hmlg_'
    : key.slice(0, 6);
  return `${prefix}…${key.slice(-4)}`;
}