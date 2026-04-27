// Helper de feature flags com suporte a escopo (frontend).
// Suporta scope: 'global' | 'plan' | 'company'.
//
// Uso:
//   const enabled = await isFeatureEnabled('ai_growth');
//   const enabled = await isFeatureEnabled('ai_growth', { company_id, plan_id });
//
// Regra de avaliação (todas as flags com a mesma key são consideradas):
//   - Uma flag global enabled=true habilita por padrão.
//   - Uma flag plan/company com target_ids inclui a empresa/plano dada → habilita (override permissivo).
//   - Se houver flag global enabled=false, fica desabilitado, exceto se houver override scoped enabled=true.
//   - Se nenhuma flag existir para a key → defaultValue.

import { base44 } from '@/api/base44Client';

let cache = null;       // { [key]: FeatureFlag[] }
let cachePromise = null;

async function loadFlags() {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = base44.entities.FeatureFlag.list('-created_date', 200).then(list => {
    const grouped = {};
    for (const f of list) {
      if (!grouped[f.key]) grouped[f.key] = [];
      grouped[f.key].push(f);
    }
    cache = grouped;
    cachePromise = null;
    return cache;
  });
  return cachePromise;
}

export async function isFeatureEnabled(key, contextOrDefault = true) {
  // Backward compat: se segundo arg for boolean, é o defaultValue
  let context = {};
  let defaultValue = true;
  if (typeof contextOrDefault === 'boolean') {
    defaultValue = contextOrDefault;
  } else if (contextOrDefault && typeof contextOrDefault === 'object') {
    context = contextOrDefault;
    if (typeof context.defaultValue === 'boolean') defaultValue = context.defaultValue;
  }

  const all = await loadFlags();
  const flagsForKey = all[key];
  if (!flagsForKey || flagsForKey.length === 0) return defaultValue;

  let result = defaultValue;
  let hasGlobal = false;

  for (const f of flagsForKey) {
    const scope = f.scope || 'global';
    const enabled = f.enabled !== false;
    const targets = Array.isArray(f.target_ids) ? f.target_ids : [];

    if (scope === 'global') {
      hasGlobal = true;
      result = enabled;
    } else if (scope === 'company' && context.company_id && targets.includes(context.company_id)) {
      // Override por empresa específica
      return enabled;
    } else if (scope === 'plan' && context.plan_id && targets.includes(context.plan_id)) {
      // Override por plano
      result = enabled;
    }
  }

  // Se não havia flag global e nenhum scoped match, mantém default
  if (!hasGlobal && result === defaultValue) return defaultValue;
  return result;
}

export function clearFeatureFlagCache() {
  cache = null;
  cachePromise = null;
}