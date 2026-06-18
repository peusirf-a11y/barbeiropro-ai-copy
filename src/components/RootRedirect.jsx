// RootRedirect — define o destino da rota "/".
// Comportamento:
//   - Carregando auth → spinner.
//   - Autenticado admin → /master/dashboard.
//   - Autenticado user → /app/dashboard.
//   - Não autenticado → /landing (app é pública, não tem login oficial Base44).

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function RootRedirect() {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, user } = useAuth();
  const stillLoading = isLoadingAuth || isLoadingPublicSettings;

  if (stillLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F7F8FB]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/landing" replace />;
  }

  if (user?.role === 'admin') {
    return <Navigate to="/master/dashboard" replace />;
  }

  return <Navigate to="/app/dashboard" replace />;
}