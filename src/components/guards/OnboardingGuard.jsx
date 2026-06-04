import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Resolve qual Company pertence ao usuário logado.
 * Estratégia de matching (em ordem de prioridade):
 *   1. owner_email === user.email  (caminho ideal — vem do checkout)
 *   2. created_by === user.email   (fallback p/ Companies criadas manualmente
 *                                    ou via login antes do checkout fechar)
 * Aplicar fallback evita o loop reportado: a Company existe e está com
 * onboarding_completed=true, mas owner_email está vazio → o guard achava
 * que o usuário não tinha Company e jogava ele de volta no onboarding.
 */
function findMyCompany(companies, email) {
  if (!email || !Array.isArray(companies) || companies.length === 0) return null;
  return (
    companies.find(c => c.owner_email === email) ||
    companies.find(c => c.created_by === email) ||
    null
  );
}

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

  // Super admin: skip onboarding flow
  if (user?.role === 'admin') {
    return <Navigate to="/master" replace />;
  }

  const myCompany = findMyCompany(companies, user?.email);

  // Already completed onboarding → go to dashboard.
  // Hard-stop: nenhum usuário com onboarding_completed=true deve conseguir
  // renderizar o wizard, em hipótese alguma (evita loop infinito).
  if (myCompany?.onboarding_completed) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}