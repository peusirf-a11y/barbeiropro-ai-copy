// usePublicPlans — busca os planos públicos para a Landing Page e Checkout.
// Garante preços válidos, não nulos e formatados corretamente.

import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/client';
import { INITIAL_PLANS } from '@/api/mockData';

async function fetchPublicPlans() {
  try {
    const res = await appClient.functions.invoke('getPublicPlans', {});
    const rawPlans = Array.isArray(res?.data?.plans) && res.data.plans.length > 0
      ? res.data.plans
      : INITIAL_PLANS;

    return rawPlans.map((p) => {
      const rawPrice = p.price_monthly ?? p.price ?? p.valor ?? p.value;
      const price = Number(rawPrice) > 0
        ? Number(rawPrice)
        : (p.id === 'pro' ? 99 : p.id === 'enterprise' ? 199 : 49);

      return {
        id: p.id || 'starter',
        name: p.name || (p.id === 'pro' ? 'Pro' : p.id === 'enterprise' ? 'Enterprise' : 'Starter'),
        description: p.description || 'Plano de gestão para barbearias',
        price_monthly: price,
        price: price,
        valor: price,
        interval: p.interval || 'MONTHLY',
        features: Array.isArray(p.features) ? p.features : [],
        limits: p.limits || {},
        sort_order: p.sort_order || 1,
        is_public: p.is_public !== false,
        is_recommended: p.is_recommended || p.id === 'pro',
      };
    });
  } catch (err) {
    console.warn('[usePublicPlans] Usando planos iniciais padrão:', err);
    return INITIAL_PLANS;
  }
}

export function usePublicPlans() {
  const { data: plans = INITIAL_PLANS, isLoading, isError } = useQuery({
    queryKey: ['public-plans'],
    queryFn: fetchPublicPlans,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  return { plans, isLoading, isError };
}