// RootRedirect — define o destino da rota "/".
// Comportamento (app/APK abre direto no login):
//   - Carregando auth → spinner.
//   - Autenticado → vai para /app/dashboard.
//   - Não autenticado → dispara o login oficial da plataforma Base44.
// A landing pública continua acessível em /landing para visitantes via web.

import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

export default function RootRedirect() {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings } = useAuth();
  const stillLoading = isLoadingAuth || isLoadingPublicSettings;

  useEffect(() => {
    if (stillLoading) return;
    if (!isAuthenticated) {
      // Após login, retornar para a raiz (que então redireciona para o dashboard).
      base44.auth.redirectToLogin(`${window.location.origin}/app/dashboard`);
    }
  }, [stillLoading, isAuthenticated]);

  if (stillLoading || !isAuthenticated) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F7F8FB]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  return <Navigate to="/app/dashboard" replace />;
}