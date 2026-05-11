// tests/unit/lib/dates.test.js — Smoke tests do helper de datas (F4).
//
// Não usa Vitest (Base44 não dá acesso à toolchain). É um módulo executável
// chamado pelo backend `runFoundationTests`. Cada teste é uma função que
// joga se algo falhar.

import { parseDate, formatDate, dayRange, toISO, plusDays, diffDays, isToday } from '@/lib/dates';

export const dateTests = {
  'parseDate aceita Date': () => {
    const d = new Date(2026, 4, 11);
    if (parseDate(d).getTime() !== d.getTime()) throw new Error('Date pass-through quebrado');
  },
  'parseDate YYYY-MM-DD vira meia-noite local': () => {
    const d = parseDate('2026-05-11');
    if (d.getFullYear() !== 2026 || d.getMonth() !== 4 || d.getDate() !== 11) {
      throw new Error(`Esperado 2026-05-11 local, got ${d}`);
    }
    if (d.getHours() !== 0) throw new Error('Não está em meia-noite local');
  },
  'parseDate ISO completo preserva timezone': () => {
    const d = parseDate('2026-05-11T15:30:00Z');
    if (d.toISOString() !== '2026-05-11T15:30:00.000Z') {
      throw new Error(`ISO round-trip quebrado: ${d.toISOString()}`);
    }
  },
  'parseDate retorna null para inválido': () => {
    if (parseDate(null) !== null) throw new Error('null deveria virar null');
    if (parseDate('') !== null) throw new Error('vazio deveria virar null');
    if (parseDate('lixo') !== null) throw new Error('lixo deveria virar null');
  },
  'formatDate pt-BR': () => {
    const out = formatDate('2026-05-11', 'dd/MM/yyyy');
    if (out !== '11/05/2026') throw new Error(`Esperado 11/05/2026, got ${out}`);
  },
  'dayRange cobre 00:00 a 23:59': () => {
    const { start, end } = dayRange('2026-05-11');
    if (start.getHours() !== 0 || end.getHours() !== 23 || end.getMinutes() !== 59) {
      throw new Error('dayRange fora do esperado');
    }
  },
  'plusDays/diffDays': () => {
    const base = '2026-05-11';
    const later = plusDays(base, 10);
    const d = diffDays(later, base);
    if (d !== 10) throw new Error(`Esperado 10 dias, got ${d}`);
  },
  'isToday detecta hoje': () => {
    const today = new Date();
    if (!isToday(today)) throw new Error('isToday(today) deveria ser true');
    const past = plusDays(today, -3);
    if (isToday(past)) throw new Error('isToday(3 dias atrás) deveria ser false');
  },
  'toISO converte para UTC ISO': () => {
    const out = toISO(new Date(Date.UTC(2026, 4, 11, 12, 0, 0)));
    if (out !== '2026-05-11T12:00:00.000Z') throw new Error(`Bad ISO: ${out}`);
  },
};