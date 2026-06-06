// RootRedirect — define o destino da rota "/".
//
// Comportamento:
//   - Carregando auth → spinner curto.
//   - Autenticado (admin) → vai para /master/dashboard.
//   - Autenticado (user)  → vai para /app/dashboard.
//   - NÃO autenticado     → renderiza a Landing pública (não redireciona pra login).
//
// IMPORTANTE: a Landing é 100% pública. Nunca disparamos redirectToLogin aqui.
// Quem precisa entrar usa o botão "Entrar" da própria Landing, que leva ao
// fluxo de login oficial. Isso evita o loop de visitantes anônimos serem
// arremessados pra tela de login ao abrir o domínio.

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import LandingPage from '@/pages/LandingPage';

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

  if (isAuthenticated) {
    if (user?.role === 'admin') {
      return <Navigate to="/master/dashboard" replace />;
    }
    return <Navigate to="/app/dashboard" replace />;
  }

  // Visitante anônimo → Landing pública.
  return <LandingPage />;
}