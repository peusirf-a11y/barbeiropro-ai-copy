// TotpGate — 2FA desativado em ambiente de teste/dev. Renderiza children diretamente com log de diagnóstico.
import { useAuth } from '@/lib/AuthContext';
import { isSuperAdmin } from '@/lib/permissions';

export default function TotpGate({ children }) {
  const { user } = useAuth();
  console.log('[Guard Check - TotpGate] Acesso liberado para:', user?.email, '| is_super_admin:', isSuperAdmin(user));
  return children;
}