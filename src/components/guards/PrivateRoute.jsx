import { useAuth } from '@/lib/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { isCompanyBlocked } from '@/lib/enforceCompanyAccess';
import { isRouteAllowedByPlan } from '@/lib/featureGate';
import { isRouteBlockedByPastDue } from '@/lib/billingMode';
import { isSuperAdmin } from '@/lib/permissions';

export default function PrivateRoute({ children }) {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, user, navigateToLogin } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();

  // Refresh a cada 60s — pega bloqueios feitos pelo Master quase em tempo real.
  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['private-route-company', user?.email],
    queryFn: () => base44.entities.Company.list(),
    enabled: !!isAuthenticated && !!user,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const userEmailClean = user?.email?.toLowerCase().trim();

  // Owner direto da empresa.
  // Super-admin da plataforma (Master) não tem empresa vinculada — pula a busca.
  const ownerCompany = isSuperAdmin(user)
    ? null
    : (companies.find(c => c.owner_email?.toLowerCase().trim() === userEmailClean) ||
       companies.find(c => c.owner_name && c.owner_email) ||
       (companies.length > 0 ? companies[0] : null));

  // Fallback: usuário é membro da equipe (barbeiro/recepção/financeiro) → vincula via TeamMember
  const { data: teamMember, isLoading: loadingTeamMember } = useQuery({
    queryKey: ['private-route-team-member', user?.email],
    queryFn: async () => {
      const tm = await base44.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
      return tm?.[0] || null;
    },
    enabled: !!isAuthenticated && !!user && !isSuperAdmin(user) && !ownerCompany,
    staleTime: 60_000,
  });

  const teamCompany = teamMember
    ? companies.find(c => c.id === teamMember.company_id)
    : null;

  const myCompany = ownerCompany || teamCompany;
  const isTeamMemberOnly = !ownerCompany && !!teamMember;

  const blocked = !!myCompany && isCompanyBlocked(myCompany);
  // Bloqueio manual pelo Master (status === 'blocked') → desloga imediatamente
  const isManuallyBlocked = !!myCompany && myCompany.status === 'blocked';
  const loggedOutRef = useRef(false);

  useEffect(() => {
    if (isManuallyBlocked && !loggedOutRef.current) {
      loggedOutRef.current = true;
      qc.clear();
      base44.auth.logout();
    }
  }, [isManuallyBlocked, qc]);

  // Carrega plano da empresa para feature gating (não bloqueia render se falhar/inexistente)
  const { data: plan } = useQuery({
    queryKey: ['private-route-plan', myCompany?.plan_id],
    queryFn: () => base44.entities.Plan.get(myCompany.plan_id),
    enabled: !!myCompany?.plan_id,
    staleTime: 5 * 60_000,
  });

  // Quando detecta bloqueio, invalida TODOS os caches → impede renderização de dados antigos
  useEffect(() => {
    if (blocked) qc.clear();
  }, [blocked, qc]);

  if (isLoadingAuth || isLoadingPublicSettings || (isAuthenticated && loadingCompanies) || (isAuthenticated && loadingTeamMember)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F7F8FB]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Super admin da plataforma (Master): pula todas as checagens de empresa.
  if (isSuperAdmin(user)) {
    return children;
  }

  // No company yet → onboarding (apenas se também NÃO for membro de equipe)
  if (!myCompany) {
    return <Navigate to="/onboarding" replace />;
  }

  // Onboarding not completed → envia para onboarding
  if (!myCompany.onboarding_completed && !isTeamMemberOnly) {
    return <Navigate to="/onboarding" replace />;
  }

  // Hard block (manual ou inadimplência)
  const isBillingPage =
    location.pathname === '/app/assinatura-bloqueada' ||
    location.pathname === '/app/configuracoes/assinatura';

  if (blocked && !isBillingPage) {
    return <Navigate to="/app/assinatura-bloqueada" replace />;
  }

  // Feature gating: company.feature_overrides > Plan.features (ver lib/featureGate.js)
  if (!isRouteAllowedByPlan(location.pathname, plan, myCompany)) {
    return <Navigate to="/app/configuracoes/assinatura?upgrade=1" replace />;
  }

  // Past-due limitado: bloqueia rotas financeiras mas mantém agenda
  if (isRouteBlockedByPastDue(location.pathname, myCompany)) {
    return <Navigate to="/app/configuracoes/assinatura?upgrade=1" replace />;
  }

  return children;
}