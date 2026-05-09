// useActiveUnit — gerencia a unidade ativa do usuário (persistida em localStorage por empresa).
//
// IMPORTANTE: agora usa um Context GLOBAL para garantir que todos os consumidores
// (UnitSwitcher, páginas, hooks) compartilhem o MESMO valor. Sem isso, cada
// `useState` local causa "vazamento" (página A com unidade X, página B com Y).
//
// Quando a unidade muda:
//   1. Atualiza o state global e o localStorage.
//   2. Invalida TODAS as queries multi-unit (appointments, customers, financial,
//      commissions, professionals, services, etc.) — força refetch e re-render.

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUnits } from '@/hooks/useUnits';
import { useCompany } from '@/hooks/useCompany';

const storageKey = (companyId) => `bt:active_unit:${companyId || 'none'}`;

// Lista de queryKeys que dependem de unidade — invalidadas ao trocar.
// Todas essas devem incluir `activeUnitId` na queryKey (página por página).
const UNIT_DEPENDENT_KEYS = [
  'appointments',
  'customers',
  'customer-subscriptions',
  'customer-subscriptions-active',
  'financial',
  'commissions',
  'professionals',
  'services',
  'blocked-times',
  'cash-register',
  'reviews',
];

const ActiveUnitContext = createContext(null);

export function ActiveUnitProvider({ children }) {
  const { companyId } = useCompany();
  const { units, isLoading } = useUnits();
  const queryClient = useQueryClient();
  const [activeUnitId, setActiveUnitIdState] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  // Hidrata a partir do localStorage quando companyId/units chegam
  useEffect(() => {
    if (!companyId || isLoading) return;
    if (units.length === 0) {
      setActiveUnitIdState(null);
      setHydrated(true);
      return;
    }

    const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey(companyId)) : null;
    if (stored === '__all__') {
      setActiveUnitIdState(null);
    } else {
      const valid = stored && units.some(u => u.id === stored);
      if (valid) {
        setActiveUnitIdState(stored);
      } else {
        const def = units.find(u => u.is_default) || units[0];
        setActiveUnitIdState(def?.id || null);
      }
    }
    setHydrated(true);
  }, [companyId, units, isLoading]);

  const setActiveUnitId = useCallback((id) => {
    setActiveUnitIdState(id);
    if (companyId && typeof window !== 'undefined') {
      localStorage.setItem(storageKey(companyId), id === null ? '__all__' : (id || ''));
    }
    // 🚨 Crítico: invalida todas as queries que dependem de unidade.
    // Como `activeUnitId` está nas queryKeys das páginas, o React Query
    // refetch automaticamente. Isso garante que dashboard/agenda/clientes/
    // financeiro NUNCA mostrem dados de outra unidade.
    UNIT_DEPENDENT_KEYS.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  }, [companyId, queryClient]);

  const isMultiUnit = units.length > 1;
  const isAllUnits = isMultiUnit && activeUnitId === null;

  const value = useMemo(() => ({
    activeUnitId,
    setActiveUnitId,
    units,
    isMultiUnit,
    isAllUnits,
    isLoading: isLoading || !hydrated,
  }), [activeUnitId, setActiveUnitId, units, isMultiUnit, isAllUnits, isLoading, hydrated]);

  return (
    <ActiveUnitContext.Provider value={value}>
      {children}
    </ActiveUnitContext.Provider>
  );
}

export function useActiveUnit() {
  const ctx = useContext(ActiveUnitContext);
  if (ctx) return ctx;

  // Fallback "burro" para componentes ainda não envolvidos pelo Provider
  // (não deve acontecer em produção — todas as rotas /app passam pelo Provider).
  // Retorna shape compatível para evitar quebrar.
  return {
    activeUnitId: null,
    setActiveUnitId: () => {},
    units: [],
    isMultiUnit: false,
    isAllUnits: false,
    isLoading: false,
  };
}