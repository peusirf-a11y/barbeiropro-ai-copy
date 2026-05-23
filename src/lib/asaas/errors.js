// Classe de erro padronizada para Asaas. Nunca vaza stack/payload bruto.
// Sempre use AsaasError em catch blocks e retorne `.toClientSafe()` no response.

export class AsaasError extends Error {
  constructor({ code, message, status, requestId, details }) {
    super(message || 'Asaas request failed');
    this.name = 'AsaasError';
    this.code = code || 'asaas_error';
    this.status = status || 500;
    this.requestId = requestId || null;
    this.details = details || null;
  }

  // Forma segura para retornar ao cliente (sem secrets, sem stack).
  toClientSafe() {
    return {
      error: this.code,
      message: this.message,
      request_id: this.requestId,
      status: this.status,
    };
  }
}

// Códigos de erro normalizados (use estes em catch blocks).
export const AsaasErrorCodes = Object.freeze({
  NOT_CONFIGURED: 'asaas_not_configured',
  NETWORK: 'asaas_network_error',
  TIMEOUT: 'asaas_timeout',
  RATE_LIMITED: 'asaas_rate_limited',
  UNAUTHORIZED: 'asaas_unauthorized',
  BAD_REQUEST: 'asaas_bad_request',
  SERVER_ERROR: 'asaas_server_error',
  WEBHOOK_INVALID_SIGNATURE: 'asaas_webhook_invalid_signature',
  WEBHOOK_DUPLICATE: 'asaas_webhook_duplicate',
});