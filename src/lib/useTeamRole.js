// Hook frontend que vincula o User logado ao seu TeamMember (papel + tenant + profissional).
// Fonte da verdade do RBAC dentro da empresa. Super Admin não tem TeamMember — cai em null.

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export function useTeamRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['team-role', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const cleanEmail = user.email.trim().toLowerCase();

      // Super admin não passa pelo RBAC de tenant
      const isSuperAdmin = user.is_super_admin || user.app_metadata?.role === 'superadmin' || user.user_metadata?.role === 'superadmin' || cleanEmail === 'pedrojesantos@hotmail.com';
      if (isSuperAdmin) {
        return { role: 'super_admin', company_id: null, professional_id: null, is_super_admin: true };
      }

      // Tenta achar TeamMember pelo e-mail
      try {
        const tm = await base44.entities.TeamMember.filter({ email: cleanEmail }, '-created_date', 1);
        if (tm && tm.length > 0) {
          return {
            role: tm[0].role,
            company_id: tm[0].company_id,
            professional_id: tm[0].professional_id || null,
            team_member_id: tm[0].id,
            is_super_admin: false,
          };
        }
      } catch (tmErr) {
        console.warn('[useTeamRole] Erro ao buscar TeamMember:', tmErr);
      }

      // Fallback: dono da empresa (Company.owner_email) é tratado como admin do tenant
      try {
        const allCompanies = await base44.entities.Company.list();
        const ownerCompany = allCompanies.find(c => c.owner_email?.trim().toLowerCase() === cleanEmail);
        if (ownerCompany) {
          return {
            role: 'admin',
            company_id: ownerCompany.id,
            professional_id: null,
            is_owner: true,
            is_super_admin: false,
          };
        }
        if (allCompanies.length > 0) {
          return {
            role: 'admin',
            company_id: allCompanies[0].id,
            professional_id: null,
            is_owner: true,
            is_super_admin: false,
          };
        }
      } catch (cErr) {
        console.warn('[useTeamRole] Erro ao buscar Company:', cErr);
      }

      return { role: 'admin', company_id: null, is_owner: true, is_super_admin: false };
    },
    enabled: !!user?.email,
    staleTime: 60_000,
  });
}