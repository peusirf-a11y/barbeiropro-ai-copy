// RootRedirect — controla apenas "/".
//   - Carregando auth → spinner.
//   - Autenticado super-admin (Master da plataforma O CORTE) → /master/dashboard.
//   - Autenticado outros (donos de barbearia, equipe) → /app/dashboard.
//   - Não autenticado → /landing.
//
// IMPORTANTE: "Master" é controlado por user.is_super_admin (flag da plataforma Base44),
// NÃO por user.role. O role=admin é o padrão da Base44 pra qualquer dono de app —
// se usássemos role aqui, todos os donos de barbearia cairiam no painel Master.

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function RootRedirect() {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, user } = useAuth();

  if (isLoadingAuth || isLoadingPublicSettings) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F7F8FB]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/landing" replace />;
  }

  if (user?.is_super_admin) {
    return <Navigate to="/master/dashboard" replace />;
  }

  return <Navigate to="/app/dashboard" replace />;
}