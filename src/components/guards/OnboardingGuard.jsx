import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { isSuperAdmin } from '@/lib/permissions';

export default function OnboardingGuard({ children }) {
  const { isAuthenticated, isLoadingAuth, user, navigateToLogin } = useAuth();
  const isSuper = isSuperAdmin(user);

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies-onboarding', user?.email],
    queryFn: async () => {
      try {
        return await base44.entities.Company.list();
      } catch (err) {
        console.warn('[OnboardingGuard] Erro ao carregar empresas:', err);
        return [];
      }
    },
    enabled: !!isAuthenticated && !!user && !isSuper,
    staleTime: 60_000,
    retry: 1,
  });

  if (isSuper) {
    return <Navigate to="/master" replace />;
  }

  if (isLoadingAuth || (isAuthenticated && loadingCompanies && companies.length === 0)) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F8F7F3] p-6 text-center">
        <div className="w-8 h-8 border-4 border-[#1B3A4B]/20 border-t-[#1B3A4B] rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-600">Carregando informações da barbearia...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
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

  // Se a empresa do usuário já tiver concluído o onboarding, redireciona para o painel
  if (isCompleted) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}