// useCompany — resolve a empresa do usuário logado SEM expor Company.list() ao frontend.
//
// Suporta modo impersonação: quando o Master está impersonando uma barbearia,
// passa o impersonation_token para getMyCompany, que retorna a empresa alvo.
// O resto da UI não precisa saber: useCompany sempre retorna a "empresa corrente".

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useImpersonationContext } from '@/contexts/ImpersonationContext';

export function useCompany() {
  const { user } = useAuth();
  const { isImpersonating, impersonationToken } = useImpersonationContext();

  const { data, isLoading } = useQuery({
    // Inclui isImpersonating+token na queryKey para que a cache invalide
    // quando o Master inicia ou encerra uma sessão de impersonação.
    queryKey: ['my-company', user?.email, isImpersonating ? impersonationToken : null],
    queryFn: async () => {
      const payload = isImpersonating && impersonationToken
        ? { impersonation_token: impersonationToken }
        : {};
      const res = await base44.functions.invoke('getMyCompany', payload);
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