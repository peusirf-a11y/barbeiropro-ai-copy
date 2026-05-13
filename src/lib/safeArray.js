/**
 * safeArray — garante que qualquer valor retornado por query/BFF seja sempre um array.
 *
 * Casos tratados:
 *  - Array normal → retorna direto
 *  - { data: [...] } → retorna data
 *  - undefined / null / objeto de erro → retorna []
 */
export function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  return [];
}