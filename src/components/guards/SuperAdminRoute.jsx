import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { isSuperAdmin } from '@/lib/permissions';

export default function SuperAdminRoute({ children }) {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, user, navigateToLogin } = useAuth();

  console.log('[Guard Check - SuperAdminRoute] Usuário:', user?.email, '| isAuthenticated:', isAuthenticated, '| is_super_admin:', isSuperAdmin(user));

  if (isLoadingAuth || isLoadingPublicSettings) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F8F7F3]">
        <div className="w-8 h-8 border-4 border-[#1B3A4B]/20 border-t-[#1B3A4B] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    console.warn('[SuperAdminRoute] Redirecionando para /login: Usuário não autenticado.');
    return <Navigate to="/login" replace />;
  }

  // Super Admin é separado de admin de tenant. role=admin NÃO basta.
  if (!isSuperAdmin(user)) {
    console.warn('[SuperAdminRoute] Redirecionando para /app/dashboard: Usuário não é super admin.', user?.email);
    return <Navigate to="/app/dashboard" replace />;
  }

  console.log('[SuperAdminRoute] Acesso permitido para Super Admin:', user?.email);
  return children;
}