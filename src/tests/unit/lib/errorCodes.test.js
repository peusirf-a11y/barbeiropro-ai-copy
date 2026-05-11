// tests/unit/lib/errorCodes.test.js — Smoke tests do tradutor de erros (F3).

import { translateError, errorResponse, ERROR_MESSAGES } from '@/lib/errorCodes';

export const errorTests = {
  'translateError aceita formato novo {error:{code}}': () => {
    const out = translateError({ error: { code: 'SLOT_TAKEN' } });
    if (out !== ERROR_MESSAGES.SLOT_TAKEN) throw new Error(`Bad: ${out}`);
  },
  'translateError aceita formato legado {error:string}': () => {
    const out = translateError({ error: 'FORBIDDEN_ROLE' });
    if (out !== ERROR_MESSAGES.FORBIDDEN_ROLE) throw new Error(`Bad: ${out}`);
  },
  'translateError aceita axios err': () => {
    const axiosErr = { response: { data: { error: { code: 'RATE_LIMITED' } } } };
    const out = translateError(axiosErr);
    if (out !== ERROR_MESSAGES.RATE_LIMITED) throw new Error(`Bad: ${out}`);
  },
  'translateError usa message do backend se code desconhecido': () => {
    const out = translateError({ error: { code: 'WEIRD_UNKNOWN', message: 'custom msg' } });
    if (out !== 'custom msg') throw new Error(`Bad: ${out}`);
  },
  'translateError usa fallback se nada bate': () => {
    const out = translateError({ error: 'WEIRD_UNKNOWN' }, 'meu fallback');
    if (out !== 'meu fallback') throw new Error(`Bad: ${out}`);
  },
  'translateError tem fallback genérico final': () => {
    const out = translateError(null);
    if (!out || typeof out !== 'string') throw new Error('Sem fallback genérico');
  },
  'errorResponse monta payload padrão': () => {
    const r = errorResponse('SLOT_TAKEN');
    if (r.error.code !== 'SLOT_TAKEN') throw new Error('Code missing');
    if (r.error.message !== ERROR_MESSAGES.SLOT_TAKEN) throw new Error('Message missing');
  },
};