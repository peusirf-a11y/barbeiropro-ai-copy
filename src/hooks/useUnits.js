// useUnits — lista as unidades da empresa atual.
// Sempre habilita queries quando há companyId. Retorna array vazio se ainda não criadas.

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/hooks/useCompany';

export function useUnits() {
  const { companyId } = useCompany();
  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units', companyId],
    queryFn: () => base44.entities.Unit.filter({ company_id: companyId, active: true }, 'sort_order'),
    enabled: !!companyId,
    staleTime: 30_000,
  });
  return { units, isLoading };
}