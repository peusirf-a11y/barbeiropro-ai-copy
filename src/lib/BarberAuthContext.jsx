// BarberAuthContext — Context React que gerencia a sess\u00e3o do dono/gestor.
//
// Persiste o token em localStorage (ocorte_barber_session) e expõe:
//   account, company, loading, login, logout, me, requestReset, resetPassword
//
// Independente do AuthContext (Base44). PrivateBarberRoute consulta os dois
// para fazer transição híbrida durante a Fase 1.

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const STORAGE_KEY = 'ocorte_barber_session';
const BarberAuthContext = createContext(null);

function readToken() {
  try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
}
function writeToken(token) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

async function invoke(action, payload = {}) {
  const res = await base44.functions.invoke('barberAuth', { action, ...payload });
  const data = res?.data || {};
  if (data && data.success === false) {
    throw new Error(data.error || 'Erro de autentica\u00e7\u00e3o');
  }
  return data;
}

export function BarberAuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [company, setCompany] = useState(null);
  const [token, setToken] = useState(() => readToken());
  const [loading, setLoading] = useState(true);
  const refreshedAt = useRef(0);

  const me = useCallback(async () => {
    const t = readToken();
    if (!t) {
      setAccount(null); setCompany(null); setLoading(false);
      return null;
    }
    try {
      const data = await invoke('me', { token: t });
      if (!data?.account) {
        writeToken(null);
        setToken(null);
        setAccount(null); setCompany(null);
      } else {
        setAccount(data.account);
        setCompany(data.company || null);
      }
      refreshedAt.current = Date.now();
      return data;
    } catch (err) {
      console.warn('[barberAuth] me failed:', err?.message);
      writeToken(null); setToken(null);
      setAccount(null); setCompany(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { me(); }, [me]);

  // Renova "me" quando a aba volta a ficar visível (após 5min).
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && readToken()) {
        if (Date.now() - refreshedAt.current > 5 * 60 * 1000) me();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [me]);

  const login = useCallback(async ({ email, password }) => {
    const data = await invoke('login', { email, password });
    if (!data?.token) throw new Error('Resposta inválida do servidor');
    writeToken(data.token);
    setToken(data.token);
    setAccount(data.account);
    setCompany(data.company || null);
    refreshedAt.current = Date.now();
    return data;
  }, []);

  const logout = useCallback(async ({ all = false } = {}) => {
    const t = readToken();
    try { if (t) await invoke('logout', { token: t, all }); } catch { /* ignore */ }
    writeToken(null);
    setToken(null);
    setAccount(null);
    setCompany(null);
  }, []);

  const requestReset = useCallback(async (email) => {
    return await invoke('request_reset', { email });
  }, []);

  const resetPassword = useCallback(async ({ token: resetToken, password }) => {
    const data = await invoke('reset_password', { token: resetToken, password });
    if (data?.token) {
      writeToken(data.token);
      setToken(data.token);
      setAccount(data.account);
      setCompany(data.company || null);
      refreshedAt.current = Date.now();
    }
    return data;
  }, []);

  const activate = useCallback(async ({ token: activationToken, password, name }) => {
    const data = await invoke('activate_account', { token: activationToken, password, name });
    if (data?.token) {
      writeToken(data.token);
      setToken(data.token);
      setAccount(data.account);
      setCompany(data.company || null);
      refreshedAt.current = Date.now();
    }
    return data;
  }, []);

  const value = {
    account,
    company,
    token,
    loading,
    isAuthenticated: !!account && !!token,
    me,
    login,
    logout,
    requestReset,
    resetPassword,
    activate,
  };

  return <BarberAuthContext.Provider value={value}>{children}</BarberAuthContext.Provider>;
}

export function useBarberAuth() {
  const ctx = useContext(BarberAuthContext);
  if (!ctx) throw new Error('useBarberAuth must be used within BarberAuthProvider');
  return ctx;
}