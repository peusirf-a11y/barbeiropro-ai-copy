// Contexto de Autenticação O CORTE / BarberPass - Supabase Auth Integrado com Timeout de Segurança
import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { queryClientInstance } from '@/lib/query-client';
import { flushTenantCache } from '@/lib/queryKeys';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let authSubscription = null;

    const initAuth = async () => {
      let timeoutId = null;
      try {
        setIsLoadingAuth(true);

        // Timeout de segurança de 12 segundos para dar margem a conexões em produção
        const authTimeoutPromise = new Promise((resolve) => {
          timeoutId = setTimeout(() => {
            console.warn('[AuthContext] Auth init timeout de 12s atingido. Finalizando loading.');
            resolve({ session: null, error: new Error('Auth timeout') });
          }, 12000);
        });

        if (!isSupabaseConfigured || !supabase) {
          setUser(null);
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
          if (timeoutId) clearTimeout(timeoutId);
          return;
        }

        const sessionPromise = supabase.auth.getSession();
        const res = await Promise.race([sessionPromise, authTimeoutPromise]);
        if (timeoutId) clearTimeout(timeoutId);

        const session = res?.data?.session || res?.session || null;
        const error = res?.error || null;

        console.log("[Supabase Auth] Status da sessão em produção:", session);

        if (error && error.message !== 'Auth timeout') {
          console.warn('[AuthContext] Session error:', error);
        }

        if (session?.user) {
          const u = session.user;
          const normalizedEmail = String(u.email || '').trim().toLowerCase();
          u.is_super_admin = u.app_metadata?.role === 'superadmin' || normalizedEmail === 'pedrojesantos@hotmail.com';
          setUser(u);
          setIsAuthenticated(true);
        } else {
          try {
            localStorage.removeItem('barberpass_mock_user');
          } catch (_) {}
          setUser(null);
          setIsAuthenticated(false);
        }

        try {
          const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            console.log("[Supabase Auth] onAuthStateChange event:", _event, "| Session:", currentSession);
            if (currentSession?.user) {
              const u = currentSession.user;
              const normalizedEmail = String(u.email || '').trim().toLowerCase();
              u.is_super_admin = u.app_metadata?.role === 'superadmin' || normalizedEmail === 'pedrojesantos@hotmail.com';
              setUser(u);
              setIsAuthenticated(true);
            } else {
              setUser(null);
              setIsAuthenticated(false);
            }
            setIsLoadingAuth(false);
          });
          authSubscription = listener?.subscription;
        } catch (_) {}
      } catch (err) {
        console.warn('[AuthContext] Erro ao verificar sessão do Supabase:', err);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        setIsLoadingAuth(false);
      }
    };

    initAuth();

    return () => {
      if (authSubscription?.unsubscribe) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    try {
      localStorage.removeItem('barberpass_mock_user');
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (_) {}

    setUser(null);
    setIsAuthenticated(false);
    flushTenantCache(queryClientInstance);

    if (shouldRedirect && typeof window !== 'undefined') {
      window.location.replace(`${window.location.origin}/login`);
    }
  };

  const navigateToLogin = () => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated,
        setIsAuthenticated,
        isLoadingAuth,
        authError,
        logout,
        navigateToLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de AuthProvider');
  }
  return context;
};