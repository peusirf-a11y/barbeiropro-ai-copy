/**
 * serverError — Error handling seguro para backend functions.
 *
 * PROIBIDO: return Response.json({ error: error.message })
 * OBRIGATÓRIO: usar serverError(error) no catch final de toda function.
 *
 * Garante:
 *  - Nenhum stack trace / error.message exposto para o cliente
 *  - request_id para correlação nos logs
 *  - Log interno detalhado no console
 *  - Mensagens amigáveis ao usuário
 */

/**
 * Gera um request_id curto para correlação de logs.
 */
export function generateRequestId() {
  return crypto.randomUUID().split('-')[0]; // 8 chars, suficiente para correlação
}

/**
 * Mapa de códigos de erro conhecidos → mensagem amigável.
 * Nunca expõe detalhes internos.
 */
const ERROR_MESSAGES = {
  UNAUTHORIZED:              'Autenticação necessária.',
  FORBIDDEN_TENANT:          'Acesso negado.',
  FORBIDDEN_ROLE:            'Permissão insuficiente.',
  FORBIDDEN_CAP:             'Permissão insuficiente para esta operação.',
  FORBIDDEN_UNIT:            'Acesso negado a esta unidade.',
  NO_TEAM_MEMBER:            'Usuário não vinculado a nenhuma empresa.',
  USER_INACTIVE:             'Conta desativada. Contate o administrador.',
  COMPANY_NOT_FOUND:         'Empresa não encontrada.',
  IMPERSONATION_INVALID:     'Sessão de impersonação inválida.',
  IMPERSONATION_EXPIRED:     'Sessão de impersonação expirada.',
  IMPERSONATION_ENDED:       'Sessão de impersonação já encerrada.',
  IMPERSONATION_MISMATCH:    'Token de impersonação não corresponde ao usuário.',
  USE_MASTER_PANEL:          'Use o painel Master para esta operação.',
  NOT_FOUND:                 'Recurso não encontrado.',
  MISSING_FIELDS:            'Campos obrigatórios ausentes.',
  INVALID_ACTION:            'Ação inválida.',
  SLOT_CONFLICT:             'Conflito de horário.',
  SLOT_BLOCKED:              'Horário bloqueado.',
  RATE_LIMITED:              'Muitas tentativas. Aguarde e tente novamente.',
  INTERNAL_ERROR:            'Erro interno. Tente novamente em instantes.',
};

/**
 * Retorna uma Response JSON segura para erros conhecidos (AuthzError, etc.)
 * ou para erros inesperados.
 *
 * @param {Error} error
 * @param {string} [functionName] - nome da function para o log
 * @param {string} [requestId]
 */
export function serverError(error, functionName = 'unknown', requestId = generateRequestId()) {
  // Erros de autorização conhecidos — retorna código sem detalhes
  if (error?.code && error?.status) {
    const message = ERROR_MESSAGES[error.code] || 'Acesso negado.';
    return Response.json(
      { success: false, error: error.code, message, request_id: requestId },
      { status: error.status }
    );
  }

  // Erros inesperados — loga detalhado, retorna genérico
  console.error(`[${functionName}] INTERNAL_ERROR rid=${requestId}:`, error?.message, error?.stack);
  return Response.json(
    { success: false, error: 'INTERNAL_ERROR', message: ERROR_MESSAGES.INTERNAL_ERROR, request_id: requestId },
    { status: 500 }
  );
}

/**
 * Retorna Response 403 genérica.
 */
export function forbidden(code = 'FORBIDDEN', requestId = generateRequestId()) {
  const message = ERROR_MESSAGES[code] || 'Acesso negado.';
  return Response.json(
    { success: false, error: code, message, request_id: requestId },
    { status: 403 }
  );
}

/**
 * Retorna Response 404 genérica (não vaza existência de recurso).
 */
export function notFound(requestId = generateRequestId()) {
  return Response.json(
    { success: false, error: 'NOT_FOUND', message: ERROR_MESSAGES.NOT_FOUND, request_id: requestId },
    { status: 404 }
  );
}

/**
 * Retorna Response 429.
 */
export function rateLimited(requestId = generateRequestId()) {
  return Response.json(
    { success: false, error: 'RATE_LIMITED', message: ERROR_MESSAGES.RATE_LIMITED, request_id: requestId },
    { status: 429 }
  );
}