import { useAuth } from '@/lib/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { isRouteAllowedByPlan } from '@/lib/featureGate';
import { isRouteBlockedByPastDue } from '@/lib/billingMode';
import { isSuperAdmin } from '@/lib/permissions';
import { getPartnerToken, getSavedPartner } from '@/hooks/usePartnerAuth';

export default function PrivateRoute({ children }) {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const location = useLocation();

  const isSuper = isSuperAdmin(user);
  const userEmailClean = user?.email?.toLowerCase().trim();
  const partnerToken = getPartnerToken();
  const savedPartner = getSavedPartner();
  const isPartnerSessionActive = Boolean(partnerToken || savedPartner);

  // 1. Busca TeamMember de forma não-bloqueante
  const { data: teamMember, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['private-route-team-member', userEmailClean],
    queryFn: async () => {
      if (!userEmailClean) return null;
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: supaTm } = await supabase
            .from('team_members')
            .select('*')
            .ilike('email', userEmailClean)
            .maybeSingle();
          if (supaTm) return supaTm;
        }
        const tms = await base44.entities.TeamMember.filter({ email: userEmailClean }, '-created_date', 1);
        return tms?.[0] || null;
      } catch (err) {
        console.warn('[PrivateRoute] Erro ao consultar team_member:', err);
        return null;
      }
    },
    enabled: !!isAuthenticated && !!user && !isSuper,
    staleTime: 60_000,
  });

  const isTeamMemberOnly = !!teamMember;

  // 2. Busca dados da empresa
  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['private-route-company', userEmailClean],
    queryFn: async () => {
      try {
        return await base44.entities.Company.list();
      } catch (err) {
        console.warn('[PrivateRoute] Erro ao carregar companies:', err);
        return [];
      }
    },
    enabled: !!isAuthenticated && !!user && !isSuper && !isTeamMemberOnly,
    staleTime: 60_000,
    retry: 1,
  });

  // 3. Verifica se o usuário autenticado é exclusivamente um Parceiro (Afiliado) sem barbearia própria
  const { data: partnerRecord, isLoading: isLoadingPartnerCheck } = useQuery({
    queryKey: ['private-route-partner-check', userEmailClean],
    queryFn: async () => {
      if (!userEmailClean) return null;
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: pRow } = await supabase
            .from('partners')
            .select('id, email, status')
            .ilike('email', userEmailClean)
            .maybeSingle();
          if (pRow) return pRow;
        }
        return null;
      } catch {
        return null;
      }
    },
    enabled: !!isAuthenticated && !!user && !isSuper,
    staleTime: 60_000,
  });

  const strictlyOwnedCompany = companies.find(
    (c) => c.owner_email?.toLowerCase().trim() === userEmailClean
  );

  // Se o utilizador está numa sessão de Parceiro ou é um Parceiro registado que não é dono de barbearia nem membro de equipa,
  // bloqueia o acesso a qualquer rota /app/* e redireciona imediatamente para /parceiro/dashboard
  const isExclusivelyPartner =
    !isSuper &&
    !strictlyOwnedCompany &&
    !isTeamMemberOnly &&
    (isPartnerSessionActive || Boolean(partnerRecord));

  const ownerCompany =
    strictlyOwnedCompany ||
    (!isTeamMemberOnly && !isExclusivelyPartner && companies.length > 0
      ? companies.find((c) => String(c.status || '').toLowerCase() !== 'blocked') || companies[0]
      : null);

  const teamCompany = teamMember?.company_id
    ? companies.find((c) => c.id === teamMember.company_id) || {
        id: teamMember.company_id,
        name: 'Minha Barbearia',
        active: true,
        onboarding_completed: true,
      }
    : null;

  const myCompany = isTeamMemberOnly
    ? teamCompany || {
        id: teamMember?.company_id,
        name: 'Minha Barbearia',
        active: true,
        onboarding_completed: true,
      }
    : ownerCompany;

  useEffect(() => {
    try {
      sessionStorage.removeItem('ocorte_blocked_account_notice');
    } catch (_) {}
  }, []);

  const { data: plan } = useQuery({
    queryKey: ['private-route-plan', myCompany?.plan_id],
    queryFn: async () => {
      try {
        return await base44.entities.Plan.get(myCompany.plan_id);
      } catch {
        return null;
      }
    },
    enabled: !!myCompany?.plan_id && !isSuper && !isTeamMemberOnly,
    staleTime: 5 * 60_000,
  });

  // Se autenticação ainda estiver carregando, exibe indicador limpo
  if (isLoadingAuth || (isAuthenticated && !isSuper && (isLoadingTeam || isLoadingCompanies || isLoadingPartnerCheck))) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#070D1E] p-6 text-center">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin mb-4" />
        <p className="text-xs text-white/50">Verificando permissões de acesso...</p>
      </div>
    );
  }

  // Se não autenticado no Supabase mas com sessão de Parceiro ativa, redireciona para /parceiro/dashboard
  if (!isAuthenticated) {
    if (isPartnerSessionActive) {
      return <Navigate to="/parceiro/dashboard?forbidden=403" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // Super Admin com bypass total
  if (isSuper) {
    return children;
  }

  // Parceiro tentando acessar /app/* -> Redireciona para /parceiro/dashboard (bloqueio RBAC)
  if (isExclusivelyPartner) {
    return <Navigate to="/parceiro/dashboard?forbidden=403" replace />;
  }

  // Colaborador / Barbeiro não passa por Onboarding nem checagem de assinatura de dono
  if (isTeamMemberOnly) {
    return children;
  }

  // Proprietário da barbearia
  if (myCompany) {
    const isCompleted = Boolean(
      myCompany.onboarding_completed === true ||
        myCompany.active === true ||
        (myCompany.id && localStorage.getItem(`barberpass_onboarding_completed_${myCompany.id}`) === 'true') ||
        (userEmailClean && localStorage.getItem(`barberpass_onboarding_completed_email_${userEmailClean}`) === 'true') ||
        (myCompany.slug && localStorage.getItem(`barberpass_onboarding_completed_slug_${myCompany.slug}`) === 'true')
    );

    if (!isCompleted) {
      return <Navigate to="/onboarding" replace />;
    }

    if (plan && !isRouteAllowedByPlan(location.pathname, plan, myCompany)) {
      return <Navigate to="/app/configuracoes/assinatura?upgrade=1" replace />;
    }

    if (isRouteBlockedByPastDue(location.pathname, myCompany)) {
      return <Navigate to="/app/configuracoes/assinatura?upgrade=1" replace />;
    }
  }

  return children;
}