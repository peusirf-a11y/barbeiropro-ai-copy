// Client API Autônomo O CORTE / BarberPass - Supabase Auth Integrado
import { entities } from './entities';
import { invokeFunction } from './functions';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

async function compressImageToDataUrl(file, maxDimension = 512, quality = 0.86) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Nenhum arquivo selecionado.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = (event) => {
      const rawDataUrl = event?.target?.result;
      if (typeof rawDataUrl !== 'string') {
        reject(new Error('Formato de arquivo inválido.'));
        return;
      }

      // Se for SVG ou não for imagem raster, retorna o Data URL diretamente
      if (!file.type || !file.type.startsWith('image/') || file.type === 'image/svg+xml') {
        resolve(rawDataUrl);
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(rawDataUrl);
      img.onload = () => {
        try {
          let targetWidth = img.width || maxDimension;
          let targetHeight = img.height || maxDimension;

          if (targetWidth > maxDimension || targetHeight > maxDimension) {
            if (targetWidth >= targetHeight) {
              targetHeight = Math.max(1, Math.round((targetHeight * maxDimension) / targetWidth));
              targetWidth = maxDimension;
            } else {
              targetWidth = Math.max(1, Math.round((targetWidth * maxDimension) / targetHeight));
              targetHeight = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          ctx.clearRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Usa WebP para manter transparência (PNG/WebP) com alta compressão
          let outputDataUrl = canvas.toDataURL('image/webp', quality);
          if (!outputDataUrl || !outputDataUrl.startsWith('data:image/webp')) {
            const fallbackMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            outputDataUrl = canvas.toDataURL(fallbackMime, quality);
          }

          resolve(outputDataUrl || rawDataUrl);
        } catch (_) {
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

class AppClient {
  constructor() {
    this.entities = entities;
    this.functions = {
      invoke: async (functionName, payload) => invokeFunction(functionName, payload),
    };
    this.integrations = {
      Core: {
        UploadFile: async ({ file } = {}) => {
          if (!file) {
            throw new Error('Nenhum arquivo enviado.');
          }
          const dataUrl = await compressImageToDataUrl(file, 512, 0.86);
          return { file_url: dataUrl };
        },
      },
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
