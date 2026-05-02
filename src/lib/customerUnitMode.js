// Determina se clientes são compartilhados entre unidades.
// Default: TRUE (clientes pertencem à barbearia inteira).
//
// Quando shared=true → não filtrar Customer/WhatsAppMessage por unit_id.
// Quando shared=false → filtrar pela unidade ativa; gravar unit_id no create.

export function isCustomersShared(company) {
  // default true (compatibilidade com lojas mono-unidade e default da entity)
  return company?.customers_shared_across_units !== false;
}

// Retorna se devemos aplicar filtro de unit_id em clientes/mensagens.
// Só faz sentido quando: multi-unidade está ligado E shared=false E há unidade ativa.
export function shouldScopeCustomersByUnit(company, activeUnitId) {
  if (!company?.multi_unit_enabled) return false;
  if (isCustomersShared(company)) return false;
  return !!activeUnitId;
}