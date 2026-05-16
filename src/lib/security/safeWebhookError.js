/**
 * safeWebhookError.js — Tratamento seguro de erros em webhooks.
 *
 * Garante que:
 * - Stack traces NUNCA são expostos ao chamador externo
 * - Erros de provider (Stripe) não vazam para a resposta
 * - Correlation ID é sempre incluído para rastreamento interno
 * - Erros são logados de forma segura (sem dados sensíveis)
 */

import { sanitizeObject } from './dlpScanner.js';

/**
 * Gera correlation ID para rastreamento.
 */
export function generateCorrelationId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

/**
 * Loga erro de webhook de forma segura (sem stack trace público).
 * @param {string} context - Identificador do handler
 * @param {Error} error - Erro capturado
 * @param {string} correlationId
 * @param {object} [safeContext] - Contexto adicional seguro para logar
 */
export function logWebhookError(context, error, correlationId, safeContext = {}) {
  // Sanitiza o contexto antes de logar (remove secrets, tokens, etc.)
  const safeCtx = sanitizeObject(safeContext);

  // Log interno completo (vai para console do Deno — não exposto ao caller)
  console.error(`[${context}] cid=${correlationId} ERROR:`, {
    message: error?.message || 'Unknown error',
    // Stack apenas em dev/interno — nunca sai via Response
    stack_summary: error?.stack?.split('\n').slice(0, 3).join(' | ') || null,
    context: safeCtx,
  });
}

/**
 * Resposta de erro segura para webhook.
 * NUNCA inclui mensagem de erro real, stack ou detalhes internos.
 *
 * @param {string} correlationId - Para rastreamento
 * @param {number} [status=500] - HTTP status
 * @returns {Response}
 */
export function safeWebhookErrorResponse(correlationId, status = 500) {
  return Response.json(
    { error: 'INTERNAL_ERROR', correlation_id: correlationId },
    { status }
  );
}

/**
 * Wrapper para handlers de webhook com tratamento seguro de erros.
 * Garante correlation ID em toda resposta e evita vazamento de internals.
 *
 * @param {string} handlerName - Nome do handler para logging
 * @param {Function} handler - Função async handler(req, correlationId) => Response
 * @returns {Function} Handler wrappado
 */
export function withSafeWebhookError(handlerName, handler) {
  return async (req) => {
    const correlationId = generateCorrelationId();
    try {
      return await handler(req, correlationId);
    } catch (error) {
      logWebhookError(handlerName, error, correlationId);
      return safeWebhookErrorResponse(correlationId);
    }
  };
}

/**
 * Try/catch granular para seções específicas do webhook.
 * Loga o erro mas NÃO falha o webhook (retorna Stripe 200).
 *
 * @param {string} section - Nome da seção
 * @param {Function} fn - Função a executar
 * @param {string} correlationId
 * @param {any} fallbackValue - Valor retornado em caso de erro
 */
export async function safeSectionExec(section, fn, correlationId, fallbackValue = null) {
  try {
    return await fn();
  } catch (error) {
    logWebhookError(section, error, correlationId);
    return fallbackValue;
  }
}