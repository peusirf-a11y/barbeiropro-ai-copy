import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export default function RecoveryRedirectHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';

    const isRecoveryParam = searchParams.get('type') === 'recovery' || hash.includes('type=recovery');
    const isRecoveryHash = hash.includes('access_token=') && hash.includes('type=recovery');
    const isResetPage = location.pathname === '/reset-password' || location.pathname === '/resetar-senha';

    if ((isRecoveryParam || isRecoveryHash) && !isResetPage) {
      console.log('[RecoveryRedirectHandler] Detectado link de recuperação de senha. Redirecionando para /reset-password');
      navigate(`/reset-password${location.search}${hash}`, { replace: true });
    }

    // Escuta evento nativo PASSWORD_RECOVERY do Supabase GoTrue
    if (isSupabaseConfigured && supabase?.auth?.onAuthStateChange) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY' && !isResetPage) {
          console.log('[RecoveryRedirectHandler] Evento PASSWORD_RECOVERY capturado. Redirecionando para /reset-password');
          navigate('/reset-password', { replace: true });
        }
      });

      return () => {
        subscription?.unsubscribe?.();
      };
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}
