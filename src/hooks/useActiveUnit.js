// useActiveUnit — gerencia a unidade ativa do usuário (persistida em localStorage por empresa).
// Retorna { activeUnitId, setActiveUnitId, units, isMultiUnit, isLoading }.
//
// Regras:
// - Se a empresa tem 0 ou 1 unidade => isMultiUnit = false; activeUnitId aponta pra única (ou null).
// - Se tem 2+ => isMultiUnit = true e o seletor aparece.
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
      localStorage.setItem(storageKey(companyId), id || '');
    }
  }, [companyId]);

  return {
    activeUnitId,
    setActiveUnitId,
    units,
    isMultiUnit: units.length > 1,
    isLoading,
  };
}