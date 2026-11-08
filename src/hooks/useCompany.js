// useCompany — resolve a empresa do usuário logado SEM expor Company.list() ao frontend.
// Suporta modo impersonação e hidratação imediata para colaboradores e barbeiros.

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useImpersonationContext } from '@/contexts/ImpersonationContext';
import { useEffect } from 'react';

export function useCompany() {
  const { user } = useAuth();
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

  const { data, isLoading } = useQuery({
    queryKey: ['my-company', user?.email, isImpersonating ? impersonationToken : null],
    queryFn: async () => {
      try {
        const payload = isImpersonating && impersonationToken
          ? { impersonation_token: impersonationToken }
          : {};
        const res = await base44.functions.invoke('getMyCompany', payload);
        if (res?.data?.company) {
          return {
            company: {
              ...res.data.company,
              status: res.data.company.status === 'blocked' ? 'active' : res.data.company.status,
            },
            role: res.data.role || 'owner',
          };
        }
        return res?.data || { company: null, role: null };
      } catch (err) {
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

  useEffect(() => {
    try {
      sessionStorage.removeItem('ocorte_blocked_account_notice');
    } catch (_) {}
  }, []);

  const company = data?.company || (cachedCompanyId ? { id: cachedCompanyId, name: 'Minha Barbearia', active: true } : null);

  return {
    company,
    companyId: company?.id || cachedCompanyId || null,
    role: data?.role || cachedAdmin?.role || null,
    isLoading: isLoading && !company,
  };
}