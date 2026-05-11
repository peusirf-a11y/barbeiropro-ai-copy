// lib/dateRangeQueries.js
//
// Helpers para queries por intervalo de data — A3 (Sprint B).
//
// Anti-pattern que isso substitui:
//   await base44.entities.FinancialEntry.filter({ company_id }, '-date', 300);
//   // ...e filtrar período no client com `date >= startOfMonth(now)`
//
// Por que isso é perigoso:
//   - Truncamento silencioso: "últimos 300" vira "300 mais recentes", não
//     "todos do mês". Se houve um pico de lançamentos, o relatório fica errado
//     sem nenhum warning.
//   - Bug financeiro pior tipo: UI parece certa, números errados.
//
// Padrão correto:
//   1. Calcule o range no FRONTEND (ex: startOfMonth → endOfMonth).
//   2. Passe { date: { $gte, $lte } } para o backend.
//   3. Paginar EXPLICITAMENTE se houver mais que o limite.
//
// Uso típico:
//   const range = periodToRange('this_month');
//   const entries = await base44.entities.FinancialEntry.filter({
//     company_id,
//     ...dateRangeFilter('date', range),
//   }, '-date', 5000);
//
// Importante:
//   - O SDK do Base44 aceita operators ($gte/$lte) na query — usamos isso.
//   - Limites altos (5000) são aceitáveis quando há filtro de período;
//     ninguém faz 5000 lançamentos num mês legítimo. Se acontecer, é hora
//     de paginar de verdade.

import { startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, format, addDays } from 'date-fns';

/**
 * Converte um período-chave em { from, to } como Date.
 * Mantém compatibilidade com os períodos usados pelo Financeiro.
 *
 * @param {'this_month'|'last_month'|'last_30d'|'last_90d'|'today'|'all'} period
 * @returns {{ from: Date|null, to: Date|null }}
 */
export function periodToRange(period) {
  const now = new Date();
  switch (period) {
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last_month': {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
    case 'last_30d':
      return { from: startOfDay(subMonths(now, 1)), to: endOfDay(now) };
    case 'last_90d':
      return { from: startOfDay(subMonths(now, 3)), to: endOfDay(now) };
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'all':
    default:
      return { from: null, to: null };
  }
}

/**
 * Constrói o sub-filtro de data no formato do Base44 SDK.
 * Tipos de campo suportados:
 *  - 'date' (yyyy-MM-dd): usa string ISO date (sem hora).
 *  - 'datetime' (ISO 8601 completo): usa Date.toISOString().
 *
 * @param {string} field nome do campo na entity
 * @param {{from: Date|null, to: Date|null}} range
 * @param {'date'|'datetime'} fieldType
 * @returns {object} pedaço do filter, ex: { date: { $gte: '...', $lte: '...' } }
 */
export function dateRangeFilter(field, range, fieldType = 'date') {
  if (!range || (!range.from && !range.to)) return {};
  const fmt = (d) => {
    if (!d) return undefined;
    if (fieldType === 'datetime') return d.toISOString();
    return format(d, 'yyyy-MM-dd');
  };
  const sub = {};
  if (range.from) sub.$gte = fmt(range.from);
  if (range.to) sub.$lte = fmt(range.to);
  return { [field]: sub };
}

/**
 * Helper combinado — devolve o pedaço pronto para spread no filter.
 *
 * Ex:
 *   FinancialEntry.filter({
 *     company_id,
 *     ...buildPeriodFilter('date', 'this_month'),
 *   })
 */
export function buildPeriodFilter(field, period, fieldType = 'date') {
  return dateRangeFilter(field, periodToRange(period), fieldType);
}

/**
 * Janela "next N dias" — para PublicBooking (A4).
 * Retorna range em datetime ISO.
 */
export function nextDaysRange(days = 14) {
  const now = new Date();
  return { from: startOfDay(now), to: endOfDay(addDays(now, days)) };
}