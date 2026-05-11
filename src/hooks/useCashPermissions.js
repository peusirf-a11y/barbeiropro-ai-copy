// Hook frontend que devolve as caps resolvidas do usuário logado no módulo Caixa.
// Combina useTeamRole + cash_permissions do próprio TeamMember.

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useTeamRole } from '@/lib/useTeamRole';
import { resolveCashCaps, canAccessUnit } from '@/lib/cashPermissions';

export function useCashPermissions() {
  const { user } = useAuth();
  const { data: teamRole } = useTeamRole();

  // Busca o TeamMember completo (para pegar cash_permissions e unit_ids).
  // Super admin / owner-sem-TeamMember caem em null e ganham caps por role default.
  const { data: tm } = useQuery({
    queryKey: ['team-member-self', teamRole?.team_member_id, user?.email],
    queryFn: async () => {
      if (!teamRole?.team_member_id) return null;
      const list = await base44.entities.TeamMember.filter({ id: teamRole.team_member_id }, null, 1);
      return list?.[0] || null;
    },
    enabled: !!user?.email && !!teamRole?.team_member_id,
    staleTime: 60_000,
  });

  // Constrói um "perfil" unificado para resolver permissões
  const profile = {
    role: teamRole?.role || (user?.is_super_admin ? 'super_admin' : 'barbeiro'),
    is_super_admin: !!teamRole?.is_super_admin || !!user?.is_super_admin,
    cash_permissions: tm?.cash_permissions || null,
    unit_ids: tm?.unit_ids || [],
  };

  const caps = resolveCashCaps(profile);

  return {
    profile,
    caps,
    can: (cap) => caps[cap] === true,
    canAccessUnit: (unitId) => canAccessUnit(profile, unitId),
    isLoading: !teamRole && !user?.is_super_admin,
  };
}