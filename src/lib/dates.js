// lib/dates.js — F4 do Foundation Sprint.
//
// Wrapper único sobre date-fns para padronizar parsing/formatação no app.
// Mata o anti-pattern `new Date('2026-05-11T00:00:00')` que confunde local vs UTC
// e quebra em DST.
//
// Regras:
//  - YYYY-MM-DD (sem T) → meia-noite LOCAL (não UTC).
//  - ISO completo (com T) → parseISO de date-fns (preserva timezone).
//  - Date object → passa direto.
//  - null/undefined/'' → null.
//
// ESLint rule (F7) bane `new Date(string)` — força usar parseDate().

import {
  parseISO,
  format,
  startOfDay,
  endOfDay,
  addDays,
  subDays,
  differenceInDays,
  isToday as _isToday,
  isValid,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Parse permissivo: aceita Date, string ISO, string YYYY-MM-DD ou null.
 * Retorna Date ou null (nunca Invalid Date — sempre testa isValid).
 */
export function parseDate(input) {
  if (input == null || input === '') return null;
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input !== 'string') return null;

  // YYYY-MM-DD → meia-noite LOCAL. Crítico para evitar shift de dia em UTC-3.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
    return isValid(dt) ? dt : null;
  }

  // ISO completo (com T ou Z) → date-fns sabe lidar.
  const parsed = parseISO(input);
  return isValid(parsed) ? parsed : null;
}

/**
 * Formata uma data no padrão pt-BR. Retorna string vazia se inválida.
 */
export function formatDate(input, pattern = 'dd/MM/yyyy') {
  const d = parseDate(input);
  if (!d) return '';
  return format(d, pattern, { locale: ptBR });
}

/**
 * Retorna { start, end } cobrindo o dia inteiro (00:00:00 até 23:59:59.999).
 * Útil para queries `date $gte/$lte`.
 */
export function dayRange(input) {
  const d = parseDate(input);
  if (!d) return { start: null, end: null };
  return { start: startOfDay(d), end: endOfDay(d) };
}

/**
 * Adiciona/subtrai dias. Wrappers para evitar import direto de date-fns
 * em call sites de domínio.
 */
export function plusDays(input, n) {
  const d = parseDate(input);
  return d ? addDays(d, n) : null;
}

export function minusDays(input, n) {
  const d = parseDate(input);
  return d ? subDays(d, n) : null;
}

/**
 * Diferença em dias inteiros (later - earlier). Negativo se invertido.
 */
export function diffDays(later, earlier) {
  const a = parseDate(later);
  const b = parseDate(earlier);
  if (!a || !b) return null;
  return differenceInDays(a, b);
}

/**
 * True se a data é hoje (no fuso local).
 */
export function isToday(input) {
  const d = parseDate(input);
  return d ? _isToday(d) : false;
}

/**
 * Converte para ISO 8601 (preserva timezone do input).
 * Útil ao montar payloads para o backend.
 */
export function toISO(input) {
  const d = parseDate(input);
  return d ? d.toISOString() : null;
}