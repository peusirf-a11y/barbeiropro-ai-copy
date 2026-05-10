import { useAuth } from '@/lib/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { isCompanyBlocked } from '@/lib/enforceCompanyAccess';
import { isRouteAllowedByPlan } from '@/lib/featureGate';
import { isRouteBlockedByPastDue } from '@/lib/billingMode';

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

  // Owner direto da empresa
  const ownerCompany = user?.role === 'admin'
    ? null
    : companies.find(c => c.owner_email === user?.email);

  // Fallback: usuário é membro da equipe (barbeiro/recepção/financeiro) → vincula via TeamMember
  const { data: teamMember, isLoading: loadingTeamMember } = useQuery({
    queryKey: ['private-route-team-member', user?.email],
    queryFn: async () => {
      const tm = await base44.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
      return tm?.[0] || null;
    },
    enabled: !!isAuthenticated && !!user && user?.role !== 'admin' && !ownerCompany,
    staleTime: 60_000,
  });

  const teamCompany = teamMember
    ? companies.find(c => c.id === teamMember.company_id)
    : null;

  const myCompany = ownerCompany || teamCompany;
  const isTeamMemberOnly = !ownerCompany && !!teamMember;

  const blocked = !!myCompany && isCompanyBlocked(myCompany);

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
    navigateToLogin();
    return null;
  }

  // Super admin: skip company checks
  if (user?.role === 'admin') {
    return children;
  }

  // No company yet → onboarding (apenas se também NÃO for membro de equipe)
  if (!myCompany) {
    return <Navigate to="/onboarding" replace />;
  }

  // Onboarding not completed → só envia para onboarding o DONO da empresa.
  // Membros de equipe (barbeiro/recepção/financeiro) NÃO devem fazer onboarding.
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