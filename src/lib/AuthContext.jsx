// Contexto de Autenticação O CORTE / BarberPass - Supabase Auth Integrado
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
      try {
        setIsLoadingAuth(true);

        const mockUserStr = localStorage.getItem('barberpass_mock_user');
        if (mockUserStr) {
          try {
            const mockUser = JSON.parse(mockUserStr);
            setUser(mockUser);
            setIsAuthenticated(true);
            setIsLoadingAuth(false);
            return;
          } catch (_) {}
        }

        if (!isSupabaseConfigured || !supabase) {
          setUser(null);
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          const u = session.user;
          u.is_super_admin = u.app_metadata?.role === 'superadmin' || u.user_metadata?.role === 'superadmin' || u.email === 'pedrojesantos@hotmail.com';
          setUser(u);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }

        const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
          if (currentSession?.user) {
            const u = currentSession.user;
            u.is_super_admin = u.app_metadata?.role === 'superadmin' || u.user_metadata?.role === 'superadmin' || u.email === 'pedrojesantos@hotmail.com';
            setUser(u);
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
          setIsLoadingAuth(false);
        });
        authSubscription = listener?.subscription;
      } catch (err) {
        console.warn('[AuthContext] Erro ao verificar sessão do Supabase:', err);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
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
        isAuthenticated,
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