// Guard de rota por papel (RBAC). Usado em conjunto com PrivateRoute.
// Quando o papel do utilizador não está autorizado na lista `roles`, redireciona imediatamente
// para fora da URL restrita (ex: Barbeiro tentando acessar /app/financeiro, /app/configuracoes ou /app/equipe).

import { Navigate } from 'react-router-dom';
import { useTeamRole } from '@/lib/useTeamRole';

export default function RoleRoute({ roles = [], children }) {
  const { data, isLoading } = useTeamRole();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#070D1E]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  // Super admin nunca é bloqueado por este guard
  if (data?.is_super_admin) return children;

  const currentRole = String(data?.role || '').toLowerCase();
  const isAllowed = Boolean(data && Array.isArray(roles) && roles.includes(currentRole));

  if (!isAllowed) {
    const fallbackPath = currentRole === 'barbeiro' ? '/app/agenda?forbidden=403' : '/app/dashboard?forbidden=403';
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}