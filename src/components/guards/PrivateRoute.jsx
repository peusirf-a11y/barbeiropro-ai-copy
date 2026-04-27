import { useAuth } from '@/lib/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const BLOCKED_STATUSES = ['past_due', 'canceled', 'unpaid'];

export default function PrivateRoute({ children }) {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, user, navigateToLogin } = useAuth();
  const location = useLocation();

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['private-route-company', user?.email],
    queryFn: () => base44.entities.Company.list(),
    enabled: !!isAuthenticated && !!user,
  });

  if (isLoadingAuth || isLoadingPublicSettings || (isAuthenticated && loadingCompanies)) {
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

  const myCompany = companies.find(c => c.owner_email === user?.email);

  // No company yet → onboarding
  if (!myCompany) {
    return <Navigate to="/onboarding" replace />;
  }

  // Onboarding not completed → onboarding
  if (!myCompany.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }

  // Block inadimplentes OU bloqueio manual do Master (status='blocked')
  const isBillingPage =
    location.pathname === '/app/assinatura-bloqueada' ||
    location.pathname === '/app/configuracoes/assinatura';

  const isHardBlocked = myCompany.status === 'blocked';
  const isPaymentBlocked = BLOCKED_STATUSES.includes(myCompany.subscription_status);

  if ((isHardBlocked || isPaymentBlocked) && !isBillingPage) {
    return <Navigate to="/app/assinatura-bloqueada" replace />;
  }

  return children;
}