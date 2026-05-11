// lib/money.js — F5 do Foundation Sprint.
//
// Helpers decimal-safe para BRL. Resolve drift de ponto flutuante
// (price * 0.4 → 12.799999999) e padroniza validação de preços.
//
// Convenção do app:
//  - Money sempre em BRL.
//  - 2 casas decimais.
//  - Armazenado como Number (não string) — round explícito no input/output.

/**
 * Arredonda para 2 casas decimais usando Number.EPSILON para mitigar drift.
 * Aceita string ou number. Inválido → 0.
 */
export function roundBRL(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula comissão sobre um preço.
 * @param {number} price        Preço do serviço em BRL.
 * @param {'percent'|'fixed'} type
 * @param {number} value        Percentual (ex: 40) ou valor fixo em BRL.
 * @returns {number}            Comissão em BRL com 2 casas.
 */
export function calcCommission(price, type, value) {
  const p = Number(price) || 0;
  const v = Number(value) || 0;
  if (type === 'percent') return roundBRL(p * (v / 100));
  if (type === 'fixed')   return roundBRL(v);
  return 0;
}

/**
 * Valida um preço vindo de input do usuário.
 * Retorna { valid, value?, error? } com `value` já normalizado.
 *
 * Regras:
 *  - Number finito.
 *  - >= 0 (zero permitido para serviço gratuito).
 *  - Máximo 2 casas decimais (rejeita 12.999 silenciosamente).
 */
export function validatePrice(input) {
  const n = Number(input);
  if (!Number.isFinite(n)) return { valid: false, error: 'invalid_price' };
  if (n < 0) return { valid: false, error: 'negative_price' };
  // Tolera drift de ponto flutuante: 12.5 * 100 = 1250 (ok), 12.999 * 100 ≈ 1299.9 (rejeita).
  const scaled = n * 100;
  if (Math.abs(scaled - Math.round(scaled)) > 0.001) {
    return { valid: false, error: 'precision_exceeded' };
  }
  return { valid: true, value: roundBRL(n) };
}

/**
 * Formata BRL no padrão pt-BR. NÃO inclui símbolo por padrão (string limpa
 * para concatenar). Use `formatBRL(v, { symbol: true })` se quiser "R$ 12,50".
 */
export function formatBRL(value, { symbol = false } = {}) {
  const n = roundBRL(value);
  const str = n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `R$ ${str}` : str;
}

/**
 * Soma uma lista de valores aplicando round no resultado.
 * Útil para totalizar entries/comissões sem propagar drift.
 */
export function sumBRL(values) {
  if (!Array.isArray(values)) return 0;
  const total = values.reduce((acc, v) => acc + (Number(v) || 0), 0);
  return roundBRL(total);
}