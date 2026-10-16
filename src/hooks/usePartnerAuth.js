// usePartnerAuth — gestão de sessão do parceiro em /parceiro/*
import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

const TOKEN_KEY = 'partner_session_token';
const PARTNER_KEY = 'current_partner';

export function getPartnerToken() {
  if (typeof window === 'undefined') return null;
  try {
    return (
      window.localStorage.getItem(TOKEN_KEY) ||
      window.localStorage.getItem('partner_token') ||
      null
    );
  } catch {
    return null;
  }
}

export function getSavedPartner() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PARTNER_KEY) || window.localStorage.getItem('partner_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id || parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

export function savePartnerSession(partnerData, token) {
  if (typeof window === 'undefined') return;
  try {
    if (partnerData) {
      window.localStorage.setItem(PARTNER_KEY, JSON.stringify(partnerData));
      window.localStorage.setItem('partner_user', JSON.stringify(partnerData));
    }
    const tok = token || partnerData?.token || `partner_session_${partnerData?.id || Date.now()}`;
    window.localStorage.setItem(TOKEN_KEY, tok);
    window.localStorage.setItem('partner_token', tok);
  } catch (e) {
    console.warn('[savePartnerSession error]', e);
  }
}

export function setPartnerToken(t) {
  savePartnerSession(getSavedPartner(), t);
}

export function clearPartnerToken() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem('partner_token');
    window.localStorage.removeItem(PARTNER_KEY);
    window.localStorage.removeItem('partner_user');
  } catch (_) {}
}

export function useCurrentPartner() {
  const [partner, setPartner] = useState(() => getSavedPartner());
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const saved = getSavedPartner();
    const token = getPartnerToken();

    if (!token && !saved) {
      setPartner(null);
      setLoading(false);
      return;
    }

    try {
      // Se já possui os dados salvos localmente, preenche imediatamente
      if (saved) {
        setPartner(saved);
      }

      // 1. Tenta revalidar via Supabase Auth se configurado
      if (isSupabaseConfigured && supabase?.auth) {
        try {
          const { data: supaUser } = await supabase.auth.getUser();
          if (supaUser?.user?.email) {
            const { data: pRow } = await supabase
              .from('partners')
              .select('*')
              .eq('email', supaUser.user.email.toLowerCase().trim())
              .maybeSingle();

            if (pRow) {
              const fullP = {
                ...pRow,
                name: pRow.full_name || pRow.name || 'Parceiro',
                email: pRow.email,
                phone: pRow.phone,
                pix_key: pRow.pix_key,
                referral_code: pRow.referral_code,
              };
              savePartnerSession(fullP, token || `partner_session_${pRow.id}`);
              setPartner(fullP);
              setLoading(false);
              return;
            }
          }
        } catch (_) {}
      }

      // 2. Revalida via API partnerAuth 'me'
      const res = await base44.functions.invoke('partnerAuth', {
        action: 'me',
        token: token || saved?.token || saved?.id,
        email: saved?.email,
      });

      if (res?.data?.success && res.data.partner) {
        savePartnerSession(res.data.partner, res.data.token || token);
        setPartner(res.data.partner);
      } else if (saved) {
        console.log('[useCurrentPartner] Mantendo parceiro salvo localmente:', saved);
        setPartner(saved);
      } else {
        clearPartnerToken();
        setPartner(null);
      }
    } catch (err) {
      console.warn('[useCurrentPartner error]', err);
      if (saved) {
        setPartner(saved);
      } else {
        clearPartnerToken();
        setPartner(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    const token = getPartnerToken();
    try {
      if (token) await base44.functions.invoke('partnerAuth', { action: 'logout', token });
    } catch (_) {}
    clearPartnerToken();
    setPartner(null);
    window.location.href = '/parceiro/login';
  }, []);

  return { partner, isLoading, refresh, logout };
}