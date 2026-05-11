// tests/unit/lib/money.test.js — Smoke tests do helper monetário (F5).

import { roundBRL, calcCommission, validatePrice, formatBRL, sumBRL } from '@/lib/money';

export const moneyTests = {
  'roundBRL mata drift de ponto flutuante': () => {
    // 0.1 + 0.2 === 0.30000000000000004
    if (roundBRL(0.1 + 0.2) !== 0.3) throw new Error('Drift não foi tratado');
  },
  'roundBRL trata input inválido': () => {
    if (roundBRL('abc') !== 0) throw new Error('Inválido deveria virar 0');
    if (roundBRL(null) !== 0) throw new Error('null deveria virar 0');
  },
  'calcCommission percent': () => {
    const c = calcCommission(50, 'percent', 40);
    if (c !== 20) throw new Error(`Esperado 20, got ${c}`);
  },
  'calcCommission fixed': () => {
    const c = calcCommission(50, 'fixed', 15);
    if (c !== 15) throw new Error(`Esperado 15, got ${c}`);
  },
  'calcCommission com drift': () => {
    // 32 * 0.4 = 12.8 (exato), mas 32 * 0.15 = 4.8000... varia
    const c = calcCommission(32, 'percent', 15);
    if (c !== 4.8) throw new Error(`Esperado 4.80, got ${c}`);
  },
  'validatePrice aceita 2 casas': () => {
    const r = validatePrice(12.5);
    if (!r.valid || r.value !== 12.5) throw new Error(`12.5 deveria ser válido, got ${JSON.stringify(r)}`);
  },
  'validatePrice rejeita 3+ casas': () => {
    const r = validatePrice(12.999);
    if (r.valid) throw new Error('12.999 deveria ser rejeitado');
    if (r.error !== 'precision_exceeded') throw new Error(`Erro errado: ${r.error}`);
  },
  'validatePrice rejeita negativo': () => {
    const r = validatePrice(-1);
    if (r.valid) throw new Error('-1 deveria ser rejeitado');
  },
  'validatePrice rejeita NaN': () => {
    const r = validatePrice('abc');
    if (r.valid) throw new Error('NaN deveria ser rejeitado');
  },
  'formatBRL': () => {
    if (formatBRL(1234.5) !== '1.234,50') throw new Error(`Bad format: ${formatBRL(1234.5)}`);
    if (formatBRL(1234.5, { symbol: true }) !== 'R$ 1.234,50') throw new Error('Symbol bad');
  },
  'sumBRL sem drift': () => {
    // 0.1 + 0.2 + 0.3 = 0.6000000000000001 com Number normal
    const total = sumBRL([0.1, 0.2, 0.3]);
    if (total !== 0.6) throw new Error(`Esperado 0.6, got ${total}`);
  },
};