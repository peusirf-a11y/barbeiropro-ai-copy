// RootRedirect — define o destino da rota "/".
// Comportamento:
//   - Carregando auth → spinner curto.
//   - Autenticado super admin → /master/dashboard.
//   - Autenticado comum → /app/dashboard.
//   - Não autenticado → /landing (pública, sem forçar login).
//
// IMPORTANTE: este componente NÃO força login automático. Quem visita "/"
// sem estar logado vai para a landing pública e decide se clica em "Entrar".

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

  if (user?.role === 'admin' || user?.is_super_admin) {
    return <Navigate to="/master/dashboard" replace />;
  }

  return <Navigate to="/app/dashboard" replace />;
}