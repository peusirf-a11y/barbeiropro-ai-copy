// Hook reativo para saber se há impersonação ativa.
// Usado para esconder/desabilitar ações perigosas durante impersonação.
import { useEffect, useState } from 'react';
import { getImpersonation } from '@/lib/impersonation';

export function useImpersonation() {
  const [imp, setImp] = useState(getImpersonation());

  useEffect(() => {
    const refresh = () => setImp(getImpersonation());
    window.addEventListener('impersonation-changed', refresh);
    window.addEventListener('storage', refresh);
    const t = setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener('impersonation-changed', refresh);
      window.removeEventListener('storage', refresh);
      clearInterval(t);
    };
  }, []);

  return {
    isImpersonating: !!imp?.active,
    impersonation: imp,
  };
}