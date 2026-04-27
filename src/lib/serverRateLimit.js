// Rate-limit em memória (per-isolate). Bom para proteção básica de abuso.
// Use nas backend functions críticas do Master.
//
//   import { checkRate } from './_shared'; // copy-inline if needed
//
// NOTA: este arquivo é JS puro; cada function Deno deve copiar a função
// localmente (functions são deployadas isoladamente). Mantido aqui apenas
// como referência canônica do algoritmo.

export function makeLimiter() {
  const buckets = new Map();
  return function check(key, { limit, windowMs }) {
    const now = Date.now();
    const arr = (buckets.get(key) || []).filter(t => now - t < windowMs);
    if (arr.length >= limit) return false;
    arr.push(now);
    buckets.set(key, arr);
    return true;
  };
}