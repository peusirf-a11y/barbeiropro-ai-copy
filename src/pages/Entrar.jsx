// Entrar — rota /entrar usada pelo botão "Entrar" da landing.
// Comportamento:
//   - Se já autenticado → manda direto para /app/dashboard (ou /master se super admin).
//   - Se não autenticado → dispara o fluxo nativo de login da plataforma Base44
//     (popup/redirect oficial). Não usa /login boilerplate, que não existe aqui.
//
// Mostra um spinner enquanto resolve.
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

export default function Entrar() {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, user } = useAuth();
  const stillLoading = isLoadingAuth || isLoadingPublicSettings;

  useEffect(() => {
    if (stillLoading) return;
    if (!isAuthenticated) {
      // Dispara o login oficial. Depois do login, volta para /.
      base44.auth.redirectToLogin(`${window.location.origin}/`);
    }
  }, [stillLoading, isAuthenticated]);

  if (!stillLoading && isAuthenticated) {
    if (user?.role === 'admin' || user?.is_super_admin) {
      return <Navigate to="/master/dashboard" replace />;
    }
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F7F8FB] gap-4">
      <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      <p className="text-sm text-[#0F172A]/60">Redirecionando para o login…</p>
    </div>
  );
}