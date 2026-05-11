// CSV-safe escape — bloqueia CSV injection (a.k.a. "formula injection") em Excel/LibreOffice.
//
// Problema (M10):
//  - Quando um valor começa com `=`, `+`, `-`, `@`, `\t` ou `\r`, Excel/Sheets
//    interpreta como FÓRMULA ao abrir o CSV. Atacante pode injetar coisas como:
//      =cmd|'/C calc'!A0     (executa código no Windows com DDE habilitado)
//      =HYPERLINK("evil")    (phishing dentro de planilha)
//      @SUM(A1+A2)           (resultado calculado em vez de string literal)
//  - O texto vem de campos abertos (nome do cliente, descrição, observações)
//    que são preenchidos por usuários externos no booking público.
//
// Solução padrão da indústria (OWASP):
//  - Se o valor começa com um caractere "gatilho", prefixar com `'` (apóstrofo).
//  - Excel/Sheets renderizam sem o apóstrofo, mas tratam o conteúdo como texto.
//
// Como usar:
//   import { csvCell, csvLine } from '@/lib/csvSafe';
//   csvCell(value)              // escapa contra injection + aspas + separador
//   csvLine([a, b, c], sep=';') // junta múltiplas células
//
// Atenção: o separador padrão é ';' (pt-BR usa vírgula como separador decimal).

const TRIGGER_CHARS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escapa um único valor para uso em CSV.
 *  - Bloqueia CSV injection prefixando com `'` quando começa com gatilho.
 *  - Faz quote+double-quote quando contém separator, aspas ou newline.
 */
export function csvCell(value, separator = ';') {
  if (value == null) return '';
  let s = String(value);

  // 1. Anti-injection: prefixa apóstrofo se primeiro char é gatilho.
  //    O `'` será removido na renderização da planilha mas neutraliza a fórmula.
  if (s.length > 0 && TRIGGER_CHARS.includes(s[0])) {
    s = `'${s}`;
  }

  // 2. Quote se contiver caracteres especiais de CSV.
  if (s.includes(separator) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Constrói uma linha CSV a partir de um array de valores.
 */
export function csvLine(cells, separator = ';') {
  return cells.map(c => csvCell(c, separator)).join(separator);
}

/**
 * Constrói um arquivo CSV completo (com BOM para abrir corretamente em Excel pt-BR).
 *
 * @param {Array<Array<any>>} rows - linhas; cada linha é um array de células.
 * @param {string} separator
 */
export function buildCsv(rows, separator = ';') {
  const lines = rows.map(r => csvLine(r, separator));
  return '\uFEFF' + lines.join('\n');
}