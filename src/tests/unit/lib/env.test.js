// tests/unit/lib/env.test.js — Smoke tests do helper de env (F2).

import { getEnv, __resetEnvCache } from '@/lib/env';

export const envTests = {
  'getEnv lê var existente (VITE_BASE44_APP_ID)': () => {
    __resetEnvCache();
    // Em produção essa var existe — só validamos que não joga erro de schema.
    const v = getEnv('VITE_BASE44_APP_ID');
    // Pode ser null (não required) ou string — só não pode jogar.
    if (v !== null && typeof v !== 'string') throw new Error(`Tipo inesperado: ${typeof v}`);
  },
  'getEnv joga erro para var fora do schema': () => {
    __resetEnvCache();
    let threw = false;
    try { getEnv('FOO_BAR_NOT_IN_SCHEMA'); } catch (e) { threw = true; }
    if (!threw) throw new Error('Deveria ter jogado para var desconhecida');
  },
  'getEnv cacheia': () => {
    __resetEnvCache();
    const a = getEnv('VITE_BASE44_APP_ID');
    const b = getEnv('VITE_BASE44_APP_ID');
    if (a !== b) throw new Error('Cache não está estável');
  },
};