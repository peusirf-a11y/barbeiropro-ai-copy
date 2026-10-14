// Client API Autônomo O CORTE / BarberPass - Supabase Auth Integrado
import { entities } from './entities';
import { invokeFunction } from './functions';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

class AppClient {
  constructor() {
    this.entities = entities;
    this.functions = {
      invoke: async (functionName, payload) => invokeFunction(functionName, payload),
    };
    this.auth = {
      me: async () => {
        if (!isSupabaseConfigured || !supabase) return null;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            return {
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || 'Utilizador',
              role: session.user.user_metadata?.role || 'owner',
              is_super_admin: session.user.email === 'pedrojesantos@hotmail.com',
            };
          }
        } catch (_) {}
        return null;
      },
      updateMe: async (patchData) => {
        if (!isSupabaseConfigured || !supabase) return null;
        try {
          const { data: { user } } = await supabase.auth.updateUser({
            data: patchData,
          });
          if (user) {
            return {
              id: user.id,
              email: user.email,
              ...user.user_metadata,
            };
          }
        } catch (_) {}
        return { id: 'usr_supabase', ...patchData };
      },
      login: async (email, password) => {
        if (!isSupabaseConfigured || !supabase) {
          return { ok: false, error: 'supabase_not_configured', message: 'Supabase não configurado' };
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data?.session) {
          return { ok: false, error: 'invalid_credentials', message: error?.message || 'E-mail ou palavra-passe inválidos' };
        }
        return { ok: true, user: data.session.user, access_token: data.session.access_token };
      },
      logout: async () => {
        if (supabase) {
          try { await supabase.auth.signOut(); } catch (_) {}
        }
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      },
      isAuthenticated: async () => {
        if (!isSupabaseConfigured || !supabase) return false;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          return !!session?.user;
        } catch {
          return false;
        }
      },
      verifyOtp: async ({ email, otpCode }) => {
        if (!isSupabaseConfigured || !supabase) {
          return { data: { ok: false, error: 'supabase_not_configured' } };
        }
        const cleanEmail = String(email || '').trim().toLowerCase();
        const { data, error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: otpCode,
          type: 'email',
        });
        if (error || !data?.session) {
          return { data: { ok: false, error: error?.message || 'OTP inválido' } };
        }
        return { data: { ok: true, access_token: data.session.access_token, user: data.session.user } };
      },
      sendOtp: async ({ email }) => {
        if (!isSupabaseConfigured || !supabase) {
          return { data: { ok: false, error: 'supabase_not_configured' } };
        }
        const cleanEmail = String(email || '').trim().toLowerCase();
        const { error } = await supabase.auth.signInWithOtp({ email: cleanEmail });
        if (error) {
          return { data: { ok: false, error: error.message } };
        }
        return { data: { ok: true, wait_seconds: 60 } };
      },
      setToken: (token, userObj) => {
        // Supabase gerencia tokens nativamente
      },
      getToken: async () => {
        if (!isSupabaseConfigured || !supabase) return null;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          return session?.access_token || null;
        } catch {
          return null;
        }
      },
      redirectToLogin: (redirectUrl) => {
        if (typeof window !== 'undefined') {
          window.location.href = `/login${redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`;
        }
      },
    };
  }
}

export const appClient = new AppClient();
export const base44 = appClient;
export default appClient;
