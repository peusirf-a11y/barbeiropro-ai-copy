import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { isSuperAdmin } from '@/lib/permissions';
import { getPartnerToken, getSavedPartner } from '@/hooks/usePartnerAuth';

export default function SuperAdminRoute({ children }) {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, user } = useAuth();
  const partnerToken = getPartnerToken();
  const savedPartner = getSavedPartner();
  const isPartnerSession = Boolean(partnerToken || savedPartner);

  if (isLoadingAuth || isLoadingPublicSettings) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#070D1E]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  // Se for um Parceiro autenticado tentando acessar rota /master/*, redireciona imediatamente tirando da URL restrita
  if (!isAuthenticated && isPartnerSession) {
    return <Navigate to="/parceiro/dashboard?forbidden=403" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Super Admin é estritamente separado de dono de barbearia, barbeiro ou parceiro.
  if (!isSuperAdmin(user)) {
    if (isPartnerSession) {
      return <Navigate to="/parceiro/dashboard?forbidden=403" replace />;
    }
    return <Navigate to="/app/dashboard?forbidden=403" replace />;
  }

  return children;
}