// RootRedirect — define o destino da rota "/".
// Comportamento:
//   - Carregando auth → spinner.
//   - Autenticado super admin → /master/dashboard.
//   - Autenticado comum → /app/dashboard.
//   - Não autenticado → /landing (landing premium com CTAs de login/cadastro).
//
// Obs.: este app NÃO usa as páginas boilerplate /login, /register. O fluxo de
// auth roda via plataforma Base44 (popup nativo disparado pelos CTAs da landing
// e da tela de ativação). Chamar base44.auth.redirectToLogin() leva a /login,
// que não existe no router → 404. Por isso usamos /landing como porta de entrada.

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

  // Super admin vai direto para o painel master
  if (user?.role === 'admin' || user?.is_super_admin) {
    return <Navigate to="/master/dashboard" replace />;
  }

  return <Navigate to="/app/dashboard" replace />;
}