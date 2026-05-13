// Hook frontend que vincula o User logado ao seu TeamMember (papel + tenant + profissional).
// Fonte da verdade do RBAC dentro da empresa. Super Admin não tem TeamMember — cai em null.
//
// IMPORTANTE: o frontend confia no resultado APENAS para UI/menu. Toda decisão sensível
// (ler/escrever entidade) precisa ser revalidada no backend (ver lib/serverPermissions.js).
//
// Usa BFF getTeamRole (não TeamMember.filter direto) para evitar falha de RLS:
// o RLS de TeamMember exige user.data.company_id preenchido no User entity,
// que pode não estar disponível para donos de empresa.

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export function useTeamRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['team-role', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;

      const res = await base44.functions.invoke('getTeamRole', {});
      const data = res?.data;
      if (!data || data.error) return null;
      return data;
    },
    enabled: !!user?.email,
    staleTime: 60_000,
  });
}