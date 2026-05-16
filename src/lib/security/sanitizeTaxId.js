/**
 * sanitizeTaxId.js — Sanitização e proteção de CPF/Tax ID.
 *
 * Regras:
 * - Nunca logar CPF em texto puro
 * - Nunca retornar CPF ao frontend após uso
 * - Mascarar em logs: "***1234"
 * - Validar formato antes de usar
 * - Limpar após pagamento aprovado
 */

/**
 * Remove máscara e normaliza CPF para 11 dígitos apenas.
 * @param {string} raw
 * @returns {string} CPF com apenas dígitos (11 chars) ou '' se inválido
 */
export function normalizeTaxId(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  return digits;
}

/**
 * Valida se o CPF tem formato correto (11 dígitos, não todos iguais).
 * NÃO valida dígito verificador — isso é responsabilidade do Stripe.
 * @param {string} cpf - CPF já normalizado (apenas dígitos)
 * @returns {boolean}
 */
export function isValidTaxId(cpf) {
  if (!cpf || cpf.length !== 11) return false;
  // Rejeita sequências triviais (00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  return true;
}

/**
 * Mascara CPF para logs seguros: "***.***.***-34"
 * Mostra apenas últimos 2 dígitos.
 * @param {string} cpf - CPF normalizado ou com máscara
 * @returns {string} CPF mascarado
 */
export function safeTaxIdForLogs(cpf) {
  const digits = normalizeTaxId(cpf);
  if (digits.length !== 11) return '***INVALID***';
  return `***.***.*${digits.slice(7, 9)}-${digits.slice(9)}`;
}

/**
 * Valida e normaliza CPF de request público.
 * Retorna erro se inválido.
 * @param {string} raw - CPF recebido do payload
 * @returns {{ cpf: string, error: string|null }}
 */
export function processTaxId(raw) {
  const cpf = normalizeTaxId(raw);
  if (!isValidTaxId(cpf)) {
    return { cpf: '', error: 'CPF inválido. Informe 11 dígitos.' };
  }
  return { cpf, error: null };
}

/**
 * Remove CPF do objeto antes de retornar ao frontend.
 * @param {object} obj - Objeto que pode conter payer_tax_id
 * @returns {object} Objeto sem campos de tax ID
 */
export function stripTaxIdFromResponse(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const { payer_tax_id, cpf, tax_id, taxId, ...rest } = obj;
  return rest;
}

/**
 * Patch para limpar CPF após pagamento aprovado.
 * Usar no stripeWebhook após payment_intent.succeeded.
 */
export const CLEAR_TAX_ID_PATCH = { payer_tax_id: null };