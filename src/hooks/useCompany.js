// useCompany — resolve a empresa do usuário logado SEM expor Company.list() ao frontend.
// Suporta modo impersonação e hidratação imediata para colaboradores e barbeiros.

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useImpersonationContext } from '@/contexts/ImpersonationContext';
import { useEffect } from 'react';

export function useCompany() {
  const { user, logout } = useAuth();
  const { isImpersonating, impersonationToken } = useImpersonationContext();

  // Recupera company_id armazenado no login/sessão para hidratação imediata sem flash
  const cachedAdmin = typeof window !== 'undefined' ? (() => {
    try {
      const stored = localStorage.getItem('admin_logged_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })() : null;

  const cachedCompanyId = cachedAdmin?.company_id || null;

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-company', user?.email, isImpersonating ? impersonationToken : null],
    queryFn: async () => {
      try {
        const payload = isImpersonating && impersonationToken
          ? { impersonation_token: impersonationToken }
          : {};
        const res = await base44.functions.invoke('getMyCompany', payload);
        if (res?.data?.error === 'COMPANY_BLOCKED') {
          throw Object.assign(new Error('COMPANY_BLOCKED'), { code: 'COMPANY_BLOCKED' });
        }
        return res?.data || { company: null, role: null };
      } catch (err) {
        if (err?.code === 'COMPANY_BLOCKED') throw err;
        console.warn('[useCompany] Falha ao obter empresa remota, usando fallback:', err);
        return {
          company: cachedCompanyId ? { id: cachedCompanyId, name: 'Minha Barbearia', active: true } : null,
          role: cachedAdmin?.role || null,
        };
      }
    },
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
  });

  // Se empresa bloqueada, persiste o aviso de bloqueio e desloga mantendo o alerta na tela de login
  useEffect(() => {
    if (error?.code === 'COMPANY_BLOCKED') {
      try {
        sessionStorage.setItem('ocorte_blocked_account_notice', '1');
        localStorage.removeItem('admin_logged_user');
        localStorage.removeItem('barberpass_auth_email');
      } catch (_) {}
      logout(false);
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login?blocked=1');
      }
    }
  }, [error, logout]);

  const company = data?.company || (cachedCompanyId ? { id: cachedCompanyId, name: 'Minha Barbearia', active: true } : null);

  return {
    company,
    companyId: company?.id || cachedCompanyId || null,
    role: data?.role || cachedAdmin?.role || null,
    isLoading: isLoading && !company,
  };
}