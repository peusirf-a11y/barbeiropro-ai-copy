// PrivateBarberRoute — Guard híbrido para rotas /app/*.
//
// Durante a Fase 1 da migração de auth, aceita DUAS fontes de sessão:
//   1) BarberAccount (nova auth própria O CORTE) — prioridade
//   2) Base44 Auth (legado) — fallback
//
// Se BarberAuth está autenticado, renderiza children direto (não precisa de
// company resolve via Base44 user — o context já entrega a Company).
//
// Se não, delega para o PrivateRoute legado (Base44).

import { useBarberAuth } from '@/lib/BarberAuthContext';
import PrivateRoute from '@/components/guards/PrivateRoute';
import { Navigate, useLocation } from 'react-router-dom';
import { isCompanyBlocked } from '@/lib/enforceCompanyAccess';

export default function PrivateBarberRoute({ children }) {
  const { isAuthenticated, account, company, loading } = useBarberAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F7F8FB]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  // Prioridade: BarberAuth próprio
  if (isAuthenticated && account && company) {
    // Onboarding pendente → onboarding
    if (!company.onboarding_completed) {
      return <Navigate to="/onboarding" replace />;
    }

    // Bloqueio por inadimplência
    const blocked = isCompanyBlocked(company);
    const isBillingPage =
      location.pathname === '/app/assinatura-bloqueada' ||
      location.pathname === '/app/configuracoes/assinatura';
    if (blocked && !isBillingPage) {
      return <Navigate to="/app/assinatura-bloqueada" replace />;
    }
    return children;
  }

  // Fallback: Base44 Auth legado (mantém todo o fluxo já testado de feature gate / past-due / team member)
  return <PrivateRoute>{children}</PrivateRoute>;
}