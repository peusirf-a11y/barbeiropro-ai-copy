import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function OnboardingGuard({ children }) {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, user, navigateToLogin } = useAuth();

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies-onboarding', user?.email],
    queryFn: () => base44.entities.Company.list(),
    enabled: !!isAuthenticated && !!user,
  });

  if (isLoadingAuth || isLoadingPublicSettings || (isAuthenticated && loadingCompanies)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F8F7F3]">
        <div className="w-8 h-8 border-4 border-[#1B3A4B]/20 border-t-[#1B3A4B] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigateToLogin();
    return null;
  }

  // Super admin (Master da plataforma O CORTE): pula onboarding e vai pro painel Master.
  // NÃO usar user.role === 'admin' aqui — esse é o role default de qualquer dono de app
  // da Base44, então faria todo dono de barbearia cair no Master.
  if (user?.is_super_admin) {
    return <Navigate to="/master" replace />;
  }

  const myCompany = companies.find(c => c.owner_email === user?.email);

  // Already completed onboarding → go to dashboard
  if (myCompany?.onboarding_completed) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}