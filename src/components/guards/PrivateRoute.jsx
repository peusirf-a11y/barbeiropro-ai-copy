import { useAuth } from '@/lib/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { isCompanyBlocked } from '@/lib/enforceCompanyAccess';
import { isRouteAllowedByPlan } from '@/lib/featureGate';
import { isRouteBlockedByPastDue } from '@/lib/billingMode';
import { isSuperAdmin } from '@/lib/permissions';

export default function PrivateRoute({ children }) {
  const { isAuthenticated, isLoadingAuth, user, navigateToLogin } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();
  const [timedOut, setTimedOut] = useState(false);

  const isSuper = isSuperAdmin(user);

  console.log('[Guard Check - PrivateRoute] Usuário:', user?.email, '| isAuthenticated:', isAuthenticated, '| is_super_admin:', isSuper);

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('[PrivateRoute] Timeout de segurança de 15s atingido.');
      setTimedOut(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  const { data: companies = [], isLoading: loadingCompanies, error: companyError, refetch: refetchCompanies } = useQuery({
    queryKey: ['private-route-company', user?.email],
    queryFn: async () => {
      console.log('[PrivateRoute] Buscando dados da empresa...');
      return await base44.entities.Company.list();
    },
    enabled: !!isAuthenticated && !!user && !isSuper,
    refetchInterval: 60_000,
    retry: 1,
  });

  const userEmailClean = user?.email?.toLowerCase().trim();

  const ownerCompany = companies.find(c => c.owner_email?.toLowerCase().trim() === userEmailClean) ||
     companies.find(c => c.owner_name && c.owner_email) ||
     (companies.length > 0 ? companies[0] : null);

  const { data: teamMember, isLoading: loadingTeamMember, error: teamError } = useQuery({
    queryKey: ['private-route-team-member', user?.email],
    queryFn: async () => {
      console.log('[PrivateRoute] Verificando se é membro da equipe...');
      const tm = await base44.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
      return tm?.[0] || null;
    },
    enabled: !!isAuthenticated && !!user && !isSuper && !ownerCompany,
    retry: 1,
  });

  const teamCompany = teamMember
    ? companies.find(c => c.id === teamMember.company_id)
    : null;

  const myCompany = ownerCompany || teamCompany;
  const isTeamMemberOnly = !ownerCompany && !!teamMember;

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
    queryFn: () => base44.entities.Plan.get(myCompany.plan_id),
    enabled: !!myCompany?.plan_id && !isSuper,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (blocked) qc.clear();
  }, [blocked, qc]);

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F7F8FB] p-6 text-center">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-600">Carregando painel...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.warn('[PrivateRoute] Redirecionando para /login: Usuário não autenticado.');
    return <Navigate to="/login" replace />;
  }

  if (isSuper) {
    console.log('[PrivateRoute Bypass] Super Admin com acesso liberado imediato:', user?.email);
    return children;
  }

  const isStillLoading = isLoadingAuth || (isAuthenticated && loadingCompanies && !timedOut) || (isAuthenticated && loadingTeamMember && !timedOut);
  const hasFinishedQuery = isAuthenticated && !loadingCompanies && !loadingTeamMember;

  if (isStillLoading && !hasFinishedQuery) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F7F8FB] p-6 text-center">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-600">Carregando painel...</p>
      </div>
    );
  }

  if (timedOut || companyError || teamError) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F7F8FB] p-6 text-center">
        <div className="max-w-md bg-white p-6 rounded-xl shadow-lg border border-red-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Ops! Demorou muito a carregar</h3>
          <p className="text-sm text-gray-600 mb-4">
            A conexão com o Supabase ou servidor demorou mais que o esperado ou ocorreu um erro.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setTimedOut(false);
                refetchCompanies();
              }}
              className="px-4 py-2 bg-[#2563EB] text-white text-sm font-medium rounded-lg hover:bg-[#1d4ed8] transition"
            >
              Tentar Novamente
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Se não encontrar a empresa no Supabase, redireciona para o onboarding para criar a barbearia
  if (!myCompany) {
    return <Navigate to="/onboarding" replace />;
  }

  const isCompleted = Boolean(
    myCompany.onboarding_completed === true ||
    myCompany.active === true ||
    (myCompany.id && localStorage.getItem(`barberpass_onboarding_completed_${myCompany.id}`) === 'true') ||
    (userEmailClean && localStorage.getItem(`barberpass_onboarding_completed_email_${userEmailClean}`) === 'true') ||
    (myCompany.slug && localStorage.getItem(`barberpass_onboarding_completed_slug_${myCompany.slug}`) === 'true')
  );

  console.log('[PrivateRoute Check]:', { 
    companyId: myCompany?.id, 
    onboarding_completed: myCompany?.onboarding_completed, 
    isCompleted 
  });

  if (!isCompleted && !isTeamMemberOnly) {
    return <Navigate to="/onboarding" replace />;
  }

  const isBillingPage =
    location.pathname === '/app/assinatura-bloqueada' ||
    location.pathname === '/app/configuracoes/assinatura';

  if (blocked && !isBillingPage) {
    return <Navigate to="/app/assinatura-bloqueada" replace />;
  }

  if (!isRouteAllowedByPlan(location.pathname, plan, myCompany)) {
    return <Navigate to="/app/configuracoes/assinatura?upgrade=1" replace />;
  }

  if (isRouteBlockedByPastDue(location.pathname, myCompany)) {
    return <Navigate to="/app/configuracoes/assinatura?upgrade=1" replace />;
  }

  return children;
}