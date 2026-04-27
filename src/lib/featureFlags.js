// Helper de feature flags (frontend). Cacheia em memória após primeira leitura.
// Uso: const enabled = await isFeatureEnabled('whatsapp_automation');
import { base44 } from '@/api/base44Client';

let cache = null;
let cachePromise = null;

async function loadFlags() {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = base44.entities.FeatureFlag.list('-created_date', 100).then(list => {
    cache = Object.fromEntries(list.map(f => [f.key, f.enabled !== false]));
    cachePromise = null;
    return cache;
  });
  return cachePromise;
}

export async function isFeatureEnabled(key, defaultValue = true) {
  const flags = await loadFlags();
  return flags[key] ?? defaultValue;
}

export function clearFeatureFlagCache() {
  cache = null;
  cachePromise = null;
}