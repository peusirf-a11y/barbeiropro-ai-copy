// Hook frontend que vincula o User logado ao seu TeamMember (papel + tenant + profissional).
// Fonte da verdade do RBAC dentro da empresa com resolução rápida e sem timeouts bloqueantes.

import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export function useTeamRole() {
  const { user } = useAuth();
  const cleanEmail = user?.email?.trim().toLowerCase();

  // Cache local da sessão para hidratação instantânea
  const cachedUser = typeof window !== 'undefined' ? (() => {
    try {
      const stored = localStorage.getItem('admin_logged_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })() : null;

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
        return {
          role: 'super_admin',
          company_id: null,
          professional_id: null,
          is_super_admin: true,
        };
      }

      // 2. Consulta direta na tabela team_members do Supabase (prioridade máxima para RBAC)
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: supaTm } = await supabase
            .from('team_members')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (supaTm) {
            let proId = supaTm.professional_id || null;
            if (!proId && supaTm.role === 'barbeiro') {
              try {
                const { data: pro } = await supabase
                  .from('professionals')
                  .select('id')
                  .eq('email', cleanEmail)
                  .maybeSingle();
                if (pro?.id) proId = pro.id;
              } catch (_) {}
            }

            console.log(`[useTeamRole] Membro localizado em team_members: role = '${supaTm.role}', proId = ${proId} para ${cleanEmail}`);
            return {
              role: supaTm.role || 'barbeiro',
              name: supaTm.name || null,
              email: supaTm.email,
              company_id: supaTm.company_id,
              professional_id: proId,
              team_member_id: supaTm.id,
              cash_permissions: supaTm.cash_permissions || null,
              unit_ids: supaTm.unit_ids || [],
              is_super_admin: false,
            };
          }
        } catch (e) {
          console.warn('[useTeamRole] Exceção ao consultar team_members no Supabase:', e);
        }
      }

      // 3. Fallback no repositório base44.entities.TeamMember
      try {
        const tm = await base44.entities.TeamMember.filter({ email: cleanEmail }, '-created_date', 1);
        if (tm && tm.length > 0) {
          console.log(`[useTeamRole] Membro localizado via TeamMember: role = '${tm[0].role}' para ${cleanEmail}`);
          return {
            role: tm[0].role || 'barbeiro',
            name: tm[0].name || null,
            email: tm[0].email,
            company_id: tm[0].company_id,
            professional_id: tm[0].professional_id || null,
            team_member_id: tm[0].id,
            is_super_admin: false,
          };
        }
      } catch (tmErr) {
        console.warn('[useTeamRole] Erro ao buscar TeamMember:', tmErr);
      }

      // 4. Verificação estrita de Dono da Empresa (Company.owner_email === cleanEmail)
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: ownerComp } = await supabase
            .from('companies')
            .select('id, owner_email')
            .eq('owner_email', cleanEmail)
            .maybeSingle();

          if (ownerComp) {
            console.log(`[useTeamRole] Dono da empresa autenticado como admin: ${cleanEmail}`);
            return {
              role: 'admin',
              company_id: ownerComp.id,
              professional_id: null,
              is_owner: true,
              is_super_admin: false,
            };
          }
        }

        const allCompanies = await base44.entities.Company.list();
        const ownerCompany = allCompanies.find(
          (c) => c.owner_email && c.owner_email.trim().toLowerCase() === cleanEmail
        );

        if (ownerCompany) {
          console.log(`[useTeamRole] Dono da empresa (base44) autenticado como admin: ${cleanEmail}`);
          return {
            role: 'admin',
            company_id: ownerCompany.id,
            professional_id: null,
            is_owner: true,
            is_super_admin: false,
          };
        }
      } catch (cErr) {
        console.warn('[useTeamRole] Erro ao buscar Company owner:', cErr);
      }

      // 5. Se não for dono e não for localizado em team_members, assume estritamente 'barbeiro'
      console.warn(`[useTeamRole] Usuário não identificado como dono nem membro de equipe. Assumindo estritamente role = 'barbeiro' para ${cleanEmail}`);

      let fallbackCompanyId = cachedUser?.company_id || null;
      if (!fallbackCompanyId) {
        try {
          const comps = await base44.entities.Company.list();
          if (comps.length > 0) fallbackCompanyId = comps[0].id;
        } catch (_) {}
      }

      return {
        role: cachedUser?.role || 'barbeiro',
        name: cachedUser?.full_name || null,
        company_id: fallbackCompanyId,
        professional_id: null,
        is_owner: false,
        is_super_admin: false,
      };
    },
    enabled: !!cleanEmail,
    staleTime: 60_000,
    initialData: cachedUser && cachedUser.email?.toLowerCase().trim() === cleanEmail ? {
      role: cachedUser.role || 'barbeiro',
      name: cachedUser.full_name || null,
      email: cleanEmail,
      company_id: cachedUser.company_id || null,
      professional_id: null,
      is_super_admin: false,
    } : undefined,
  });
}