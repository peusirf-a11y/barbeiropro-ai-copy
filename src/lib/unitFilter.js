// Helpers de filtragem por unidade ativa em multi-unidade.
// Regra geral: registros sem unit_id (legado / pré-backfill) sempre passam,
// para não esconder dados antigos durante a migração.

export function filterByUnit(items, activeUnitId, isMultiUnit, field = 'unit_id') {
  if (!isMultiUnit || !activeUnitId) return items;
  return items.filter(it => !it[field] || it[field] === activeUnitId);
}

// Para Professional (que usa array unit_ids[])
export function filterProfessionalsByUnit(pros, activeUnitId, isMultiUnit) {
  if (!isMultiUnit || !activeUnitId) return pros;
  return pros.filter(p => !p.unit_ids || p.unit_ids.length === 0 || p.unit_ids.includes(activeUnitId));
}