// RootRedirect — controla "/", "/login", "/signin", "/entrar".
//
// Regras:
//   - Carregando auth → spinner.
//   - Autenticado admin → /master/dashboard.
//   - Autenticado user → /app/dashboard.
//   - NÃO autenticado em "/" → /landing (página pública).
//   - NÃO autenticado em /login|/signin|/entrar → dispara fluxo oficial de login Base44
//     (necessário porque o SDK redireciona para /login internamente; sem disparar o auth,
//     a página entraria em loop ou 404).

import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

const LOGIN_PATHS = new Set(['/login', '/signin', '/entrar']);

export default function RootRedirect() {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, user } = useAuth();
  const location = useLocation();
  const stillLoading = isLoadingAuth || isLoadingPublicSettings;
  const isLoginPath = LOGIN_PATHS.has(location.pathname);

  // Não autenticado em rota de login → dispara o fluxo oficial do Base44.
  useEffect(() => {
    if (!stillLoading && !isAuthenticated && isLoginPath) {
      base44.auth.redirectToLogin('/app/dashboard');
    }
  }, [stillLoading, isAuthenticated, isLoginPath]);

  if (stillLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F7F8FB]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Em rota de login mostramos só o spinner enquanto o SDK dispara o redirect.
    if (isLoginPath) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#F7F8FB]">
          <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
        </div>
      );
    }
    return <Navigate to="/landing" replace />;
  }

  if (user?.role === 'admin') {
    return <Navigate to="/master/dashboard" replace />;
  }

  return <Navigate to="/app/dashboard" replace />;
}