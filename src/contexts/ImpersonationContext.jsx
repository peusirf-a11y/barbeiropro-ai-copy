// Contexto global de impersonação — fonte da verdade para todo o frontend.
//
// Expõe:
//   isImpersonating  : boolean
//   impersonatedCompanyId : string | null
//   impersonatedCompanyName : string | null
//   impersonationToken : string | null (passado nos payloads BFF)
//   startImpersonation({ company_id, company_name, token, expires_at }) : void
//   stopImpersonation() : void
//
// Persiste no localStorage (TTL 15min). Reativo via window event.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const COMPANY_CACHE_KEYS = [
  'my-company', 'appointments', 'customers', 'customer-subscriptions',
  'customer-subscriptions-active', 'professionals', 'services', 'blocked-times',
  'financial', 'financial-entries', 'commissions', 'reviews', 'whatsapp-messages',
  'customers-crm', 'customer-plans', 'cash-register', 'cash-registers',
  'cash-entries', 'dashboard',
];

const STORAGE_KEY = 'master_impersonation_v1';
const TTL_MS = 15 * 60 * 1000;

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.expires_at || new Date(data.expires_at).getTime() < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

const ImpersonationContext = createContext({
  isImpersonating: false,
  impersonatedCompanyId: null,
  impersonatedCompanyName: null,
  impersonationToken: null,
  startImpersonation: () => {},
  stopImpersonation: () => {},
});

export function ImpersonationProvider({ children }) {
  const [state, setState] = useState(() => readStorage());
  const queryClient = useQueryClient();

  // Sincroniza com localStorage (outra aba ou TTL expirado)
  useEffect(() => {
    const sync = () => setState(readStorage());
    window.addEventListener('impersonation-changed', sync);
    window.addEventListener('storage', sync);
    const tick = setInterval(sync, 30_000);
    return () => {
      window.removeEventListener('impersonation-changed', sync);
      window.removeEventListener('storage', sync);
      clearInterval(tick);
    };
  }, []);

  const startImpersonation = useCallback(({ company_id, company_name, token, expires_at }) => {
    const data = {
      active: true,
      company_id,
      company_name,
      token,
      expires_at: expires_at || new Date(Date.now() + TTL_MS).toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setState(data);
    window.dispatchEvent(new Event('impersonation-changed'));
    // Limpa cache completo ao iniciar impersonação para evitar dados do tenant anterior
    queryClient.clear();
  }, [queryClient]);

  const stopImpersonation = useCallback(() => {
    const current = readStorage();
    if (current?.token) {
      // Best-effort: avisa o backend para encerrar a sessão
      base44.functions.invoke('endImpersonation', { token: current.token }).catch(() => {});
    }
    localStorage.removeItem(STORAGE_KEY);
    setState(null);
    window.dispatchEvent(new Event('impersonation-changed'));
    // Limpa TODO o cache do React Query ao fim de impersonação
    // (garante que dados da empresa impersonada não vazem para a próxima sessão)
    queryClient.clear();
  }, [queryClient]);

  const value = {
    isImpersonating: !!state?.active,
    impersonatedCompanyId: state?.company_id || null,
    impersonatedCompanyName: state?.company_name || null,
    impersonationToken: state?.token || null,
    impersonationExpiresAt: state?.expires_at || null,
    startImpersonation,
    stopImpersonation,
  };

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonationContext() {
  return useContext(ImpersonationContext);
}