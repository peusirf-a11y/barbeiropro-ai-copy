// RootRedirect — define o destino da rota "/".
//
// Comportamento:
//   - Carregando auth → spinner curto.
//   - Já autenticado → vai direto para o painel (dashboard ou master).
//   - Não autenticado → renderiza a Landing Page pública (NUNCA força login).
//
// A Landing Page deve ser 100% pública. Login só acontece quando o usuário
// clica explicitamente em "Entrar" ou tenta acessar uma rota privada.

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

  // Usuário já logado: leva direto para o painel correspondente.
  if (isAuthenticated) {
    if (user?.role === 'admin') {
      return <Navigate to="/master/dashboard" replace />;
    }
    return <Navigate to="/app/dashboard" replace />;
  }

  // Visitante anônimo: Landing Page pública, sem redirect para login.
  return <LandingPage />;
}