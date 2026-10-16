import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useState, useEffect } from 'react';
import { isSuperAdmin } from '@/lib/permissions';

export default function OnboardingGuard({ children }) {
  const { isAuthenticated, isLoadingAuth, user, navigateToLogin } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  const isSuper = isSuperAdmin(user);

  const { data: companies = [], isLoading: loadingCompanies, error, refetch } = useQuery({
    queryKey: ['companies-onboarding', user?.email],
    queryFn: async () => {
      return await base44.entities.Company.list();
    },
    enabled: !!isAuthenticated && !!user && !isSuper,
    retry: 1,
  });

  if (isSuper) {
    console.log('[OnboardingGuard Bypass] Super Admin redirecionado para /master');
    return <Navigate to="/master" replace />;
  }

  const isStillLoading = isLoadingAuth || (isAuthenticated && loadingCompanies && !timedOut);
  const hasFinishedQuery = isAuthenticated && !loadingCompanies;

  if (isStillLoading && !hasFinishedQuery) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F8F7F3] p-6 text-center">
        <div className="w-8 h-8 border-4 border-[#1B3A4B]/20 border-t-[#1B3A4B] rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-600">A carregar informações da barbearia...</p>
      </div>
    );
  }

  if (timedOut || error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F8F7F3] p-6 text-center">
        <div className="max-w-md bg-white p-6 rounded-xl shadow-lg border border-red-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Ops! Demorou muito a responder</h3>
          <p className="text-sm text-gray-600 mb-4">
            {error ? `Erro ao carregar dados: ${error.message}` : 'A conexão com o servidor demorou mais que o esperado.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setTimedOut(false);
                refetch();
              }}
              className="px-4 py-2 bg-[#1B3A4B] text-white text-sm font-medium rounded-lg hover:bg-[#132a36] transition"
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

  if (!isAuthenticated) {
    console.warn('[OnboardingGuard] Redirecionando para login: Não autenticado.');
    navigateToLogin();
    return null;
  }

  const userEmailClean = user?.email?.toLowerCase().trim();
  const myCompany = companies.find(c => c.owner_email?.toLowerCase().trim() === userEmailClean) ||
    companies.find(c => c.owner_name && c.owner_email) ||
    (companies.length > 0 ? companies[0] : null);

  const isCompleted = Boolean(
    myCompany?.onboarding_completed === true ||
    myCompany?.active === true ||
    (myCompany?.id && localStorage.getItem(`barberpass_onboarding_completed_${myCompany.id}`) === 'true') ||
    (userEmailClean && localStorage.getItem(`barberpass_onboarding_completed_email_${userEmailClean}`) === 'true') ||
    (myCompany?.slug && localStorage.getItem(`barberpass_onboarding_completed_slug_${myCompany.slug}`) === 'true')
  );

  console.log('[OnboardingGuard Check]:', { 
    companyId: myCompany?.id, 
    onboarding_completed: myCompany?.onboarding_completed,
    isCompleted,
    userEmail: userEmailClean 
  });

  // Se a empresa do usuário tiver onboarding_completed === true, redirecione-o para /app/dashboard
  if (isCompleted) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}