/**
 * sanitizeCsv.js — Proteção global contra CSV Injection.
 *
 * Bloqueia fórmulas perigosas que o Excel/LibreOffice executam automaticamente
 * quando uma célula começa com: = + - @ \t \r
 *
 * Referência: OWASP CSV Injection
 * https://owasp.org/www-community/attacks/CSV_Injection
 */

// Chars que iniciam fórmulas em Excel/LibreOffice/Google Sheets
const FORMULA_TRIGGER_CHARS = /^[=+\-@\t\r]/;

/**
 * Escapa um valor individual para uso seguro em CSV.
 * Adiciona prefixo ' para neutralizar fórmulas.
 * Envolve em aspas se contém vírgula, aspas ou quebra de linha.
 *
 * @param {any} value - Valor a escapar
 * @returns {string} Valor seguro para CSV
 */
export function csvEscape(value) {
  if (value === null || value === undefined) return '';

  let str = String(value);

  // Neutralizar fórmulas com prefixo de apóstrofo (padrão OWASP)
  if (FORMULA_TRIGGER_CHARS.test(str)) {
    str = `'${str}`;
  }

  // Escapar aspas internas dobrando-as (padrão RFC 4180)
  if (str.includes('"')) {
    str = str.replace(/"/g, '""');
  }

  // Envolver em aspas se necessário
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str}"`;
  }

  return str;
}

/**
 * Converte um array de objetos em CSV seguro.
 * Adiciona BOM UTF-8 para compatibilidade com Excel.
 *
 * @param {object[]} rows - Array de objetos
 * @param {string[]} [columns] - Colunas a incluir (default: todas)
 * @param {object} [headers] - Mapeamento coluna → label (default: usa chave)
 * @returns {string} CSV seguro com BOM
 */
export function toCsv(rows, columns = null, headers = {}) {
  if (!rows || rows.length === 0) return '\uFEFF'; // BOM vazio

  const cols = columns || Object.keys(rows[0] || {});
  const headerRow = cols.map(c => csvEscape(headers[c] || c)).join(',');
  const dataRows = rows.map(row =>
    cols.map(col => csvEscape(row[col])).join(',')
  );

  // BOM UTF-8 (\uFEFF) garante que Excel abre corretamente sem encoding issues
  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
}

/**
 * Sanitiza um objeto inteiro — aplica csvEscape em todos os valores string.
 * Útil para sanitizar antes de gerar CSV linha por linha.
 *
 * @param {object} obj
 * @returns {object}
 */
export function sanitizeRowForCsv(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = typeof v === 'string' ? csvEscape(v) : v;
  }
  return result;
}

/**
 * Valida se uma string é segura para CSV sem modificação.
 * @param {string} value
 * @returns {boolean}
 */
export function isCsvSafe(value) {
  if (typeof value !== 'string') return true;
  return !FORMULA_TRIGGER_CHARS.test(value);
}