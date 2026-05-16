// CookieConsentProvider — Monta o banner globalmente e inicializa o sistema de consentimento.
// Inclua este componente dentro do <AuthProvider> em App.jsx.

import { useState, useEffect } from 'react';
import { initCookieConsent } from '@/lib/cookieConsent';
import CookieBanner from './CookieBanner';

export default function CookieConsentProvider({ children = null }) {
  const [bannerState, setBannerState] = useState('hidden'); // 'hidden' | 'show' | 'revalidate'

  useEffect(() => {
    // Pequeno delay para não bloquear render inicial
    const t = setTimeout(() => {
      const status = initCookieConsent();
      if (!status.hasConsent) {
        setBannerState('show');
      } else if (status.revalidationNeeded) {
        setBannerState('revalidate');
      }
    }, 800);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => setBannerState('hidden');

  return (
    <>
      {children}
      {(bannerState === 'show' || bannerState === 'revalidate') && (
        <CookieBanner
          isRevalidation={bannerState === 'revalidate'}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
}