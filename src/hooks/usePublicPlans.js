// usePublicPlans — busca os planos públicos (visíveis na landing/checkout)
// via endpoint getPublicPlans. Fonte da verdade dos preços. Cache 30s
// para evitar refetch em cada montagem.
//
// Retorna { plans, isLoading, isError }.
//
// Cada plan tem: { id, name, price_monthly, features, limits, sort_order, stripe_price_id }.

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

async function fetchPublicPlans() {
  const { data } = await base44.functions.invoke('getPublicPlans', {});
  return Array.isArray(data?.plans) ? data.plans : [];
}

export function usePublicPlans() {
  const { data: plans = [], isLoading, isError } = useQuery({
    queryKey: ['public-plans'],
    queryFn: fetchPublicPlans,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  return { plans, isLoading, isError };
}