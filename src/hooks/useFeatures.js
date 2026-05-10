// ============================================================================
// HOOK ÚNICO PARA GATING DE FEATURES NO FRONTEND
// ============================================================================
// Uso:
//   const allowed = useFeature('crm_retention');         → boolean
//   if (!allowed) return null;
//
//   const { has, isLoading } = useFeatures();             → API completa
//   has('crm_retention') && <CRMCard />
//
// Carrega Company (via useCompany) + Plan (via id) e aplica hasFeature().
// Cacheado pelo react-query, então usar em vários componentes é seguro.
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/hooks/useCompany';
import { hasFeature } from '@/lib/featureGate';

export function useFeatures() {
  const { company, isLoading: loadingCompany } = useCompany();

  const { data: plan, isLoading: loadingPlan } = useQuery({
    queryKey: ['feature-plan', company?.plan_id],
    queryFn: () => base44.entities.Plan.get(company.plan_id),
    enabled: !!company?.plan_id,
    staleTime: 5 * 60_000,
  });

  const isLoading = loadingCompany || (!!company?.plan_id && loadingPlan);

  return {
    isLoading,
    plan,
    company,
    has: (key) => hasFeature(plan, company, key),
  };
}

export function useFeature(key) {
  const { has } = useFeatures();
  return has(key);
}