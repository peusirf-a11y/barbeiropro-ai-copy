import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isSuperAdmin } from '@/lib/permissions';

export default function RootRedirect() {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const location = useLocation();

  // Detecção precoce de recuperação de senha via raiz (evita 404 de sub-rotas no preview)
  const searchParams = new URLSearchParams(location.search);
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const isRecovery =
    searchParams.get('type') === 'recovery' ||
    hash.includes('type=recovery') ||
    hash.includes('access_token=');

  if (isRecovery) {
    return <Navigate to={`/reset-password${location.search}${hash}`} replace />;
  }

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F7F8FB]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/landing" replace />;
  }

  if (isSuperAdmin(user)) {
    return <Navigate to="/master/dashboard" replace />;
  }

  return <Navigate to="/app/dashboard" replace />;
}