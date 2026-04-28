// Guard de rota por papel. Usado em conjunto com PrivateRoute.
// Se o papel do usuário não estiver na lista, redireciona para o dashboard.

import { Navigate } from 'react-router-dom';
import { useTeamRole } from '@/lib/useTeamRole';

export default function RoleRoute({ roles, children }) {
  const { data, isLoading } = useTeamRole();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F7F8FB]">
        <div className="w-8 h-8 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  // Super admin nunca é bloqueado por este guard
  if (data?.is_super_admin) return children;

  if (!data || !roles.includes(data.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}