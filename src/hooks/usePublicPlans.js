// usePublicPlans — busca os planos públicos para a Landing Page e Checkout.
// Garante preços válidos, não nulos e formatados corretamente.

import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { INITIAL_PLANS } from '@/api/mockData';

async function fetchPublicPlans() {
  try {
    let rawPlans = [];

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .is('company_id', null)
        .order('order_index', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        rawPlans = data.filter((p) => p.company_id === null || p.company_id === undefined);
      } else {
        const fbRes = await supabase
          .from('plans')
          .select('*')
          .is('company_id', null)
          .order('sort_order', { ascending: true });
        if (!fbRes.error && Array.isArray(fbRes.data) && fbRes.data.length > 0) {
          rawPlans = fbRes.data.filter((p) => p.company_id === null || p.company_id === undefined);
        }
      }
    }

    if (rawPlans.length === 0) {
      const res = await appClient.functions.invoke('getPublicPlans', {});
      rawPlans =
        Array.isArray(res?.data?.plans) && res.data.plans.length > 0
          ? res.data.plans.filter((p) => p.company_id === null || p.company_id === undefined)
          : INITIAL_PLANS;
    }

    return rawPlans.map((p) => {
      const rawPrice = p.price_monthly ?? p.price ?? p.valor ?? p.value;
      const price = Number(rawPrice) > 0
        ? Number(rawPrice)
        : (p.id === 'pro' ? 99 : p.id === 'enterprise' ? 199 : 49);

      return {
        id: p.id || 'starter',
        company_id: null,
        name: p.name || (p.id === 'pro' ? 'Pro' : p.id === 'enterprise' ? 'Enterprise' : 'Starter'),
        description: p.description || 'Plano de gestão para barbearias',
        price_monthly: price,
        price: price,
        valor: price,
        interval: p.interval || 'MONTHLY',
        features: Array.isArray(p.features) ? p.features : [],
        limits: p.limits || {},
        order_index: p.order_index ?? p.sort_order ?? 1,
        sort_order: p.sort_order ?? p.order_index ?? 1,
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