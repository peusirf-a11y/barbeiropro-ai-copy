// Hook frontend que vincula o User logado ao seu TeamMember (papel + tenant + profissional).
// Fonte da verdade do RBAC dentro da empresa com resolução estrita e case-insensitive.

import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export function useTeamRole() {
  const { user } = useAuth();
  const rawEmail = user?.email?.trim() || '';
  const cleanEmail = rawEmail.toLowerCase();

  return useQuery({
    queryKey: ['team-role', cleanEmail],
    queryFn: async () => {
      if (!cleanEmail) return null;

      // 1. Super Admin Check
      const isSuperAdmin =
        user?.is_super_admin ||
        user?.app_metadata?.role === 'superadmin' ||
        user?.user_metadata?.role === 'superadmin' ||
        cleanEmail === 'pedrojesantos@hotmail.com';

      if (isSuperAdmin) {
        const result = {
          role: 'super_admin',
          isBarbeiro: false,
          isAdmin: true,
          is_owner: false,
          is_super_admin: true,
          company_id: null,
          professional_id: null,
          name: user?.user_metadata?.name || 'Super Admin',
          email: cleanEmail,
        };
        console.log('[useTeamRole] Perfil identificado:', { email: rawEmail, role: result.role, isBarbeiro: result.isBarbeiro, isAdmin: result.isAdmin });
        return result;
      }

      // 2. Consulta direta na tabela team_members do Supabase usando ilike (case-insensitive)
      if (isSupabaseConfigured && supabase) {
        try {
          // Busca tanto por cleanEmail quanto por rawEmail de forma insensível a maiúsculas
          const { data: supaTm, error: tmErr } = await supabase
            .from('team_members')
            .select('*')
            .ilike('email', cleanEmail)
            .maybeSingle();

          if (tmErr) {
            console.warn('[useTeamRole] Erro na query ilike team_members:', tmErr.message);
          }

          if (supaTm) {
            const memberRole = String(supaTm.role || 'barbeiro').trim().toLowerCase();
            const isBarbeiro = memberRole === 'barbeiro';
            const isAdmin = memberRole === 'admin';

            let proId = supaTm.professional_id || null;
            if (!proId && isBarbeiro) {
              try {
                const { data: pro } = await supabase
                  .from('professionals')
                  .select('id')
                  .ilike('email', cleanEmail)
                  .maybeSingle();
                if (pro?.id) proId = pro.id;
              } catch (_) {}
            }

            const result = {
              role: memberRole,
              isBarbeiro,
              isAdmin,
              is_owner: false,
              is_super_admin: false,
              name: supaTm.name || user?.user_metadata?.name || null,
              email: supaTm.email || cleanEmail,
              company_id: supaTm.company_id,
              professional_id: proId,
              team_member_id: supaTm.id,
              cash_permissions: supaTm.cash_permissions || null,
              unit_ids: supaTm.unit_ids || [],
            };

            console.log('[useTeamRole] Perfil identificado:', { email: rawEmail, role: result.role, isBarbeiro: result.isBarbeiro, isAdmin: result.isAdmin });
            return result;
          }
        } catch (e) {
          console.warn('[useTeamRole] Exceção ao consultar team_members no Supabase:', e);
        }
      }

      // 3. Fallback no repositório base44.entities.TeamMember
      try {
        const allTeam = await base44.entities.TeamMember.list();
        const tm = allTeam.find(t => t.email && t.email.trim().toLowerCase() === cleanEmail);
        if (tm) {
          const memberRole = String(tm.role || 'barbeiro').trim().toLowerCase();
          const isBarbeiro = memberRole === 'barbeiro';
          const isAdmin = memberRole === 'admin';

          const result = {
            role: memberRole,
            isBarbeiro,
            isAdmin,
            is_owner: false,
            is_super_admin: false,
            name: tm.name || user?.user_metadata?.name || null,
            email: tm.email || cleanEmail,
            company_id: tm.company_id,
            professional_id: tm.professional_id || null,
            team_member_id: tm.id,
          };

          console.log('[useTeamRole] Perfil identificado:', { email: rawEmail, role: result.role, isBarbeiro: result.isBarbeiro, isAdmin: result.isAdmin });
          return result;
        }
      } catch (tmErr) {
        console.warn('[useTeamRole] Erro ao buscar TeamMember Base44:', tmErr);
      }

      // 4. Verificação estrita de Dono da Empresa (Company.owner_email === cleanEmail)
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: ownerComp } = await supabase
            .from('companies')
            .select('id, owner_email')
            .ilike('owner_email', cleanEmail)
            .maybeSingle();

          if (ownerComp) {
            const result = {
              role: 'admin',
              isBarbeiro: false,
              isAdmin: true,
              is_owner: true,
              is_super_admin: false,
              company_id: ownerComp.id,
              professional_id: null,
              name: user?.user_metadata?.name || 'Administrador',
              email: cleanEmail,
            };
            console.log('[useTeamRole] Perfil identificado:', { email: rawEmail, role: result.role, isBarbeiro: result.isBarbeiro, isAdmin: result.isAdmin });
            return result;
          }
        }

        const allCompanies = await base44.entities.Company.list();
        const ownerCompany = allCompanies.find(
          (c) => c.owner_email && c.owner_email.trim().toLowerCase() === cleanEmail
        );

        if (ownerCompany) {
          const result = {
            role: 'admin',
            isBarbeiro: false,
            isAdmin: true,
            is_owner: true,
            is_super_admin: false,
            company_id: ownerCompany.id,
            professional_id: null,
            name: user?.user_metadata?.name || 'Administrador',
            email: cleanEmail,
          };
          console.log('[useTeamRole] Perfil identificado:', { email: rawEmail, role: result.role, isBarbeiro: result.isBarbeiro, isAdmin: result.isAdmin });
          return result;
        }
      } catch (cErr) {
        console.warn('[useTeamRole] Erro ao buscar Company owner:', cErr);
      }

      // 5. NUNCA atribui 'admin' por defeito a um utilizador que não seja dono comprovado
      // Se não for dono e não for achado em team_members, assume estritamente 'barbeiro'
      let fallbackCompanyId = null;
      try {
        const comps = await base44.entities.Company.list();
        if (comps.length > 0) fallbackCompanyId = comps[0].id;
      } catch (_) {}

      const result = {
        role: 'barbeiro',
        isBarbeiro: true,
        isAdmin: false,
        is_owner: false,
        is_super_admin: false,
        name: user?.user_metadata?.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        company_id: fallbackCompanyId,
        professional_id: null,
      };

      console.log('[useTeamRole] Perfil identificado:', { email: rawEmail, role: result.role, isBarbeiro: result.isBarbeiro, isAdmin: result.isAdmin });
      return result;
    },
    enabled: !!cleanEmail,
    staleTime: 60_000,
  });
}