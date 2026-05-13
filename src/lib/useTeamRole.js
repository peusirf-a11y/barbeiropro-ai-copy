// Hook frontend que vincula o User logado ao seu TeamMember (papel + tenant + profissional).
// Fonte da verdade do RBAC dentro da empresa. Super Admin não tem TeamMember — cai em null.
//
// IMPORTANTE: o frontend confia no resultado APENAS para UI/menu. Toda decisão sensível
// (ler/escrever entidade) precisa ser revalidada no backend (ver lib/serverPermissions.js).

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export function useTeamRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['team-role', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;

      // Super admin não passa pelo RBAC de tenant
      if (user.is_super_admin) {
        return { role: 'super_admin', company_id: null, professional_id: null, is_super_admin: true };
      }

      // Tenta achar TeamMember pelo e-mail
      const tm = await base44.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
      if (tm && tm.length > 0) {
        return {
          role: tm[0].role,
          company_id: tm[0].company_id,
          professional_id: tm[0].professional_id || null,
          team_member_id: tm[0].id,
          is_super_admin: false,
        };
      }

      // Fallback: dono da empresa (Company.owner_email) é tratado como admin do tenant.
      // Compatibilidade com contas criadas antes do RBAC.
      const companies = await base44.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
      if (companies && companies.length > 0) {
        return {
          role: 'admin',
          company_id: companies[0].id,
          professional_id: null,
          is_owner: true,
          is_super_admin: false,
        };
      }

      return null;
    },
    enabled: !!user?.email,
    staleTime: 60_000,
  });
}