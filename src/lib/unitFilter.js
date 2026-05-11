// Helpers de filtragem por unidade ativa em multi-unidade.
//
// Histórico:
//  - Modo permissivo (default): registros sem unit_id passam — aceitável DURANTE
//    a migração inicial, quando havia entities sem unit_id (pré-backfill).
//  - Modo estrito (A2 — Sprint C): após o backfill, registros sem unit_id em
//    contexto multi-unit são VAZAMENTOS. Em strict mode, eles são ESCONDIDOS
//    e geramos um warn (uma vez por sessão por entity+id) para telemetria.
//
// Como ativar strict:
//   - localStorage: `localStorage.setItem('bt:strict_unit', '1')` (debug local)
//   - global: chame `setStrictUnitIsolation(true)` no boot (futuro: feature flag)
//
// Default permanece OFF — só endurecemos quando 100% dos tenants estão backfilled.

let STRICT_UNIT_ISOLATION = false;

// Permite override via localStorage (debug / dogfood)
if (typeof window !== 'undefined') {
  try {
    if (window.localStorage?.getItem('bt:strict_unit') === '1') {
      STRICT_UNIT_ISOLATION = true;
    }
  } catch { /* SSR / privacy mode */ }
}

export function setStrictUnitIsolation(value) {
  STRICT_UNIT_ISOLATION = !!value;
}
export function getStrictUnitIsolation() {
  return STRICT_UNIT_ISOLATION;
}

// Telemetria: warn uma vez por chave única (entity_label + id) na sessão.
// Evita poluir o console quando há muitos registros legados.
const _warnedKeys = new Set();
function warnOnce(entityLabel, item) {
  const key = `${entityLabel}:${item?.id || 'unknown'}`;
  if (_warnedKeys.has(key)) return;
  _warnedKeys.add(key);
  console.warn(
    `[unitFilter] ${entityLabel} sem unit_id em contexto multi-unit — provável legado pré-backfill.`,
    { id: item?.id, company_id: item?.company_id }
  );
}

/**
 * Filtra uma lista por unit_id ativo.
 *
 * @param {Array} items
 * @param {string|null} activeUnitId  null = "todas as unidades" (não filtra)
 * @param {boolean} isMultiUnit
 * @param {string} field              padrão 'unit_id'
 * @param {object} [options]
 * @param {string} [options.entityLabel='Item']  rótulo para warn em strict mode
 * @param {boolean} [options.strict]             override por chamada (default: global)
 */
export function filterByUnit(items, activeUnitId, isMultiUnit, field = 'unit_id', options = {}) {
  if (!isMultiUnit || !activeUnitId) return items;
  const strict = options.strict ?? STRICT_UNIT_ISOLATION;
  const label = options.entityLabel || 'Item';

  return items.filter(it => {
    const v = it[field];
    if (v === activeUnitId) return true;
    if (!v) {
      // Sem unit_id: permissivo deixa passar, strict esconde + warn
      if (strict) {
        warnOnce(label, it);
        return false;
      }
      return true;
    }
    return false;
  });
}

// Para Professional (que usa array unit_ids[])
export function filterProfessionalsByUnit(pros, activeUnitId, isMultiUnit, options = {}) {
  if (!isMultiUnit || !activeUnitId) return pros;
  const strict = options.strict ?? STRICT_UNIT_ISOLATION;

  return pros.filter(p => {
    if (Array.isArray(p.unit_ids) && p.unit_ids.length > 0) {
      return p.unit_ids.includes(activeUnitId);
    }
    // Sem unit_ids[] ou vazio: permissivo deixa passar, strict esconde
    if (strict) {
      warnOnce('Professional', p);
      return false;
    }
    return true;
  });
}