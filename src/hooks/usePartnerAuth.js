// usePartnerAuth — sessão do parceiro no painel /parceiro/*.
// Token armazenado em localStorage como `partner_session_token`.
// Hooks expostos:
//   useCurrentPartner()        → { partner, isLoading, refresh, logout }
//   getPartnerToken() / setPartnerToken(t) / clearPartnerToken()

import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const KEY = 'partner_session_token';

export function getPartnerToken() {
  try { return window.localStorage.getItem(KEY); } catch { return null; }
}
export function setPartnerToken(t) {
  try { window.localStorage.setItem(KEY, t); } catch { /* no-op */ }
}
export function clearPartnerToken() {
  try { window.localStorage.removeItem(KEY); } catch { /* no-op */ }
}

export function useCurrentPartner() {
  const [partner, setPartner] = useState(null);
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getPartnerToken();
    if (!token) { setPartner(null); setLoading(false); return; }
    try {
      const res = await base44.functions.invoke('partnerAuth', { action: 'me', token });
      if (res?.data?.success) setPartner(res.data.partner);
      else { clearPartnerToken(); setPartner(null); }
    } catch {
      clearPartnerToken();
      setPartner(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    const token = getPartnerToken();
    try { if (token) await base44.functions.invoke('partnerAuth', { action: 'logout', token }); } catch { /* no-op */ }
    clearPartnerToken();
    setPartner(null);
    window.location.href = '/parceiro/login';
  }, []);

  return { partner, isLoading, refresh, logout };
}