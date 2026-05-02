// useActiveUnit — gerencia a unidade ativa do usuário (persistida em localStorage por empresa).
// Retorna { activeUnitId, setActiveUnitId, units, isMultiUnit, isLoading, isAllUnits }.
//
// Regras:
// - Se a empresa tem 0 ou 1 unidade => isMultiUnit = false; activeUnitId aponta pra única (ou null).
// - Se tem 2+ => isMultiUnit = true e o seletor aparece (com opção "Todas").
// - "Todas as unidades" = activeUnitId === null (sentinel "__all__" no storage).
// - Storage key inclui o companyId pra evitar vazar entre contas.

import { useEffect, useState, useCallback } from 'react';
import { useUnits } from '@/hooks/useUnits';
import { useCompany } from '@/hooks/useCompany';

const storageKey = (companyId) => `bt:active_unit:${companyId || 'none'}`;

export function useActiveUnit() {
  const { companyId } = useCompany();
  const { units, isLoading } = useUnits();
  const [activeUnitId, setActiveUnitIdState] = useState(null);

  // Hidrata a partir do localStorage quando companyId/units chegam
  useEffect(() => {
    if (!companyId || isLoading) return;
    if (units.length === 0) { setActiveUnitIdState(null); return; }

    const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey(companyId)) : null;
    // Sentinel especial: usuário escolheu "Todas as unidades" explicitamente
    if (stored === '__all__') { setActiveUnitIdState(null); return; }
    const valid = stored && units.some(u => u.id === stored);
    if (valid) {
      setActiveUnitIdState(stored);
    } else {
      // Default = unidade marcada como is_default, senão a primeira
      const def = units.find(u => u.is_default) || units[0];
      setActiveUnitIdState(def?.id || null);
    }
  }, [companyId, units, isLoading]);

  const setActiveUnitId = useCallback((id) => {
    setActiveUnitIdState(id);
    if (companyId && typeof window !== 'undefined') {
      // null = "Todas as unidades"; persistimos com sentinel para distinguir de "ainda não escolhi"
      localStorage.setItem(storageKey(companyId), id === null ? '__all__' : (id || ''));
    }
  }, [companyId]);

  const isMultiUnit = units.length > 1;
  // "Todas as unidades" só faz sentido em multi-unidade
  const isAllUnits = isMultiUnit && activeUnitId === null;

  return {
    activeUnitId,
    setActiveUnitId,
    units,
    isMultiUnit,
    isAllUnits,
    isLoading,
  };
}