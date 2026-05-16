// CookieBanner — Banner de consentimento LGPD-compliant.
// Mobile-first, discreto, não bloqueia UX.
// Aparece apenas quando não há consentimento ou expirou.

import { useState } from 'react';
import { Cookie, Settings2, X, ChevronRight } from 'lucide-react';
import { acceptAll, rejectOptional } from '@/lib/cookieConsent';
import CookiePreferencesModal from './CookiePreferencesModal';

export default function CookieBanner({ onDismiss }) {
  const [showPreferences, setShowPreferences] = useState(false);

  const handleAcceptAll = () => {
    acceptAll();
    onDismiss();
  };

  const handleRejectOptional = () => {
    rejectOptional();
    onDismiss();
  };

  const handleCustomSaved = () => {
    setShowPreferences(false);
    onDismiss();
  };

  return (
    <>
      {/* Banner fixo no bottom */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9998] p-3 sm:p-4 pointer-events-none"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto max-w-2xl mx-auto bg-white border border-black/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden">
          {/* Barra de destaque */}
          <div className="h-0.5 bg-gradient-to-r from-[#2563EB] to-[#60A5FA]" />

          <div className="px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Cookie className="w-4 h-4 text-[#2563EB]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] text-[#111827] leading-tight mb-1">
                  Usamos cookies para melhorar sua experiência
                </div>
                <p className="text-[11px] text-[#6B7280] leading-relaxed">
                  Cookies necessários são sempre ativos. Você pode aceitar todos, recusar os opcionais ou personalizar suas preferências.{' '}
                  <a href="/politica-de-privacidade" target="_blank" className="text-[#2563EB] underline">
                    Saiba mais
                  </a>
                </p>
              </div>
            </div>

            {/* Botões */}
            <div className="flex flex-col sm:flex-row gap-2 mt-3.5">
              <button
                onClick={handleAcceptAll}
                className="flex-1 sm:flex-none order-1 px-4 py-2.5 bg-[#2563EB] text-white text-xs font-bold rounded-xl hover:bg-[#1d4ed8] transition-colors shadow-[0_2px_8px_rgba(37,99,235,0.3)]"
              >
                Aceitar todos
              </button>
              <button
                onClick={handleRejectOptional}
                className="flex-1 sm:flex-none order-3 sm:order-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Recusar opcionais
              </button>
              <button
                onClick={() => setShowPreferences(true)}
                className="flex-1 sm:flex-none order-2 sm:order-3 flex items-center justify-center gap-1 px-4 py-2.5 border border-black/10 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Personalizar
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPreferences && (
        <CookiePreferencesModal
          onSave={handleCustomSaved}
          onClose={() => setShowPreferences(false)}
        />
      )}
    </>
  );
}