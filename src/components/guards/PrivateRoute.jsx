import { useAuth } from '@/lib/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { isCompanyBlocked } from '@/lib/enforceCompanyAccess';
import { isRouteAllowedByPlan } from '@/lib/featureGate';
import { isRouteBlockedByPastDue } from '@/lib/billingMode';
import { isSuperAdmin } from '@/lib/permissions';

export default function PrivateRoute({ children }) {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();

  const isSuper = isSuperAdmin(user);
  const userEmailClean = user?.email?.toLowerCase().trim();

  // 1. Busca TeamMember de forma não-bloqueante
  const { data: teamMember } = useQuery({
    queryKey: ['private-route-team-member', userEmailClean],
    queryFn: async () => {
      if (!userEmailClean) return null;
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: supaTm } = await supabase
            .from('team_members')
            .select('*')
            .eq('email', userEmailClean)
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
  const { data: companies = [] } = useQuery({
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

  const ownerCompany = companies.find(c => c.owner_email?.toLowerCase().trim() === userEmailClean) ||
    (!isTeamMemberOnly && companies.length > 0 ? companies[0] : null);

  const teamCompany = teamMember?.company_id
    ? (companies.find(c => c.id === teamMember.company_id) || {
        id: teamMember.company_id,
        name: 'Minha Barbearia',
        active: true,
        onboarding_completed: true,
      })
    : null;

  const myCompany = isTeamMemberOnly ? (teamCompany || { id: teamMember?.company_id, name: 'Minha Barbearia', active: true, onboarding_completed: true }) : ownerCompany;

  const blocked = !!myCompany && isCompanyBlocked(myCompany);
  const isManuallyBlocked = !!myCompany && myCompany.status === 'blocked';
  const loggedOutRef = useRef(false);

  useEffect(() => {
    if (isManuallyBlocked && !loggedOutRef.current) {
      loggedOutRef.current = true;
      qc.clear();
      base44.auth.logout();
    }
  }, [isManuallyBlocked, qc]);

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

  useEffect(() => {
    if (blocked) qc.clear();
  }, [blocked, qc]);

  // Se autenticação ainda estiver carregando, exibe indicador limpo
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#070D1E] p-6 text-center">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin mb-4" />
        <p className="text-xs text-white/50">Carregando painel...</p>
      </div>
    );
  }

  // Redireciona para login se não autenticado
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Super Admin com bypass total
  if (isSuper) {
    return children;
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

    const isBillingPage =
      location.pathname === '/app/assinatura-bloqueada' ||
      location.pathname === '/app/configuracoes/assinatura';

    if (blocked && !isBillingPage) {
      return <Navigate to="/app/assinatura-bloqueada" replace />;
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