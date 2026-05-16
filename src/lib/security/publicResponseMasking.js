/**
 * publicResponseMasking.js — Respostas genéricas para endpoints públicos.
 *
 * Previne enumeração de tenants, clientes e recursos por atacantes externos.
 * Todos os erros "não encontrado" usam a mesma mensagem e delay.
 *
 * REGRA: endpoint público NUNCA revela se um resource existe ou não.
 */

/**
 * Delay mínimo para equalizar tempo de resposta (anti timing oracle).
 * @param {number} minMs
 */
export async function equalizeResponseTime(startTime, minMs = 150) {
  const elapsed = Date.now() - startTime;
  if (elapsed < minMs) {
    await new Promise(r => setTimeout(r, minMs - elapsed));
  }
}

/**
 * Resposta genérica de "não encontrado" para endpoints públicos.
 * Sempre HTTP 404, sempre mesma mensagem.
 */
export function notFoundResponse() {
  return Response.json(
    { success: false, error: 'Recurso não encontrado ou link inválido.' },
    { status: 404 }
  );
}

/**
 * Resposta genérica de "indisponível" — não revela razão (suspenso, bloqueado, inexistente).
 */
export function unavailableResponse() {
  return Response.json(
    { success: false, error: 'Este recurso não está disponível.' },
    { status: 404 }
  );
}

/**
 * Verifica se a empresa está disponível para agendamento público.
 * Retorna null se OK, ou a response de erro a retornar.
 * NUNCA diferencia "inexistente" de "bloqueado" — mesma resposta.
 *
 * @param {object} company - Registro da Company (ou null)
 * @returns {Response|null} null se OK, Response de erro se não disponível
 */
export function checkCompanyPublicAvailability(company) {
  if (!company) return unavailableResponse();
  if (company.status === 'blocked' || company.status === 'inactive') return unavailableResponse();
  // NÃO verificar se é 'trial' — trial pode aceitar bookings
  return null;
}

/**
 * Wrapper de consulta pública — oculta a razão do erro.
 * Retorna { data, error_response } — se error_response !== null, retorná-la imediatamente.
 *
 * @param {Function} queryFn - função async que retorna os dados
 * @param {Function} [validateFn] - validação adicional dos dados
 * @returns {Promise<{data: any, error_response: Response|null}>}
 */
export async function safePublicQuery(queryFn, validateFn = null) {
  try {
    const data = await queryFn();
    if (!data) return { data: null, error_response: notFoundResponse() };
    if (validateFn) {
      const err = validateFn(data);
      if (err) return { data: null, error_response: err };
    }
    return { data, error_response: null };
  } catch {
    return { data: null, error_response: notFoundResponse() };
  }
}