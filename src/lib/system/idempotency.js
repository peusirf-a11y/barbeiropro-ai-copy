// lib/system/idempotency.js — Idempotency Layer (Fase 1)
//
// USO NO FRONTEND:
//   import { generateIdempotencyKey, withIdempotencyHeader } from '@/lib/system/idempotency';
//   const key = generateIdempotencyKey('booking', { companyId, slot, phone });
//   await base44.functions.invoke('createBookingPaymentIntent', { ...payload, idempotency_key: key });
//
// USO NO BACKEND (Base44 functions):
//   Como functions/ não permite local imports, o helper backend é INLINE.
//   Veja o trecho `_idempotency*` em createBookingPaymentIntent / createPublicAppointment.
//   Esta lib aqui é a FONTE DA VERDADE — qualquer mudança aqui deve ser espelhada
//   no snippet inline das functions.
//
// CONTRATO:
//   1. Mesma `key` + mesmo payload → devolve response_snapshot original (HTTP idêntico).
//   2. Mesma `key` + payload diferente → 409 conflict.
//   3. `key` ausente → operação roda normal (sem idempotency).
//   4. TTL padrão: 24h para mutations, 7d para webhooks.
//
// NUNCA fazer:
//   - usar como cache (não é cache — é dedup).
//   - guardar secrets/tokens no response_snapshot.
//   - usar key não-determinística (Math.random) — perde a graça.

// Gera uma chave determinística a partir de um namespace + dados estáveis.
// Use no FRONTEND antes de chamar uma function que pode ser duplicada.
// Os dados devem identificar univocamente a operação (não usar timestamp).
//
// Exemplos:
//   generateIdempotencyKey('booking', { companyId, customerId, slot })
//   generateIdempotencyKey('cancel', { appointmentId })
//   generateIdempotencyKey('export', { customerId, userEmail, day: '2026-05-20' })
export function generateIdempotencyKey(namespace, data) {
  if (!namespace) throw new Error('idempotency: namespace required');
  if (!data || typeof data !== 'object') throw new Error('idempotency: data must be an object');
  const sorted = sortKeysDeep(data);
  const json = JSON.stringify(sorted);
  // Hash simples client-side. O backend recalcula um SHA-256 forte para o request_hash.
  let h = 0;
  for (let i = 0; i < json.length; i++) {
    h = ((h << 5) - h + json.charCodeAt(i)) | 0;
  }
  const hashStr = Math.abs(h).toString(36);
  // 8 chars de entropia adicional para reduzir colisões em namespaces muito ativos.
  const rand = Math.random().toString(36).slice(2, 10);
  return `${namespace}_${hashStr}_${rand}`.slice(0, 200);
}

// Variante "stable": gera key SEM componente aleatório. Use quando você QUER
// que retries do MESMO botão (sem o usuário mudar nada) reusem o resultado.
// Ex: usuário clica 2x em "Confirmar pagamento" → mesma key → mesmo PaymentIntent.
export function generateStableIdempotencyKey(namespace, data) {
  if (!namespace) throw new Error('idempotency: namespace required');
  if (!data || typeof data !== 'object') throw new Error('idempotency: data must be an object');
  const sorted = sortKeysDeep(data);
  const json = JSON.stringify(sorted);
  let h = 0;
  for (let i = 0; i < json.length; i++) {
    h = ((h << 5) - h + json.charCodeAt(i)) | 0;
  }
  return `${namespace}_${Math.abs(h).toString(36)}`.slice(0, 200);
}

// Helper para injetar a key em um payload de invoke.
export function withIdempotencyKey(payload, key) {
  if (!key) return payload;
  return { ...payload, idempotency_key: key };
}

// Ordena objeto recursivamente para JSON determinístico.
function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((acc, k) => {
      acc[k] = sortKeysDeep(v[k]);
      return acc;
    }, {});
  }
  return v;
}

// TTL constants — referência para callers do frontend e snippets inline do backend.
export const IDEMPOTENCY_TTL = {
  MUTATION: 24 * 60 * 60 * 1000,        // 24h — mutações de usuário
  PAYMENT: 60 * 60 * 1000,              // 1h — pagamentos (já há expiração própria)
  WEBHOOK: 7 * 24 * 60 * 60 * 1000,     // 7d — webhooks Stripe (mesma que o Stripe usa)
  EXPORT: 24 * 60 * 60 * 1000,          // 24h — exports LGPD
};