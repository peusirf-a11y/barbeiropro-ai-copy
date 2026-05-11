// useCompany — resolve a empresa do usuário logado SEM expor Company.list() ao frontend.
//
// A1 (Sprint A): antes, este hook chamava `Company.list()` direto no frontend e
// dependia do backend filtrar por tenant. Isso era:
//   1) risco de vazamento tenant (se o RLS quebrasse, o frontend veria outras empresas)
//   2) comportamento não determinístico (companies[0] como fallback)
//   3) anti-pattern cultural — normalizava queries tenant-sensitive no client
//
// Agora chama a backend function `getMyCompany` que resolve owner/team_member
// de forma autoritativa, retornando apenas a empresa do caller.

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export function useCompany() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['my-company', user?.email],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMyCompany', {});
      // axios-like response: dados em `data`
      return res?.data || { company: null, role: null };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const company = data?.company || null;
  return {
    company,
    companyId: company?.id || null,
    role: data?.role || null,
    isLoading,
  };
}