// CookiePreferencesModal — Modal granular de preferências de cookies.
// Permite ligar/desligar analytics, marketing e funcionais separadamente.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ChevronUp, Lock, BarChart2, Megaphone, Sliders } from 'lucide-react';
import { COOKIE_CATEGORIES, setCustomConsent, getConsentState, revokeConsent } from '@/lib/cookieConsent';

const CATEGORY_ICONS = {
  necessary: Lock,
  analytics: BarChart2,
  marketing: Megaphone,
  functional: Sliders,
};

const CATEGORY_COLORS = {
  necessary: 'text-gray-500 bg-gray-100',
  analytics: 'text-blue-600 bg-blue-50',
  marketing: 'text-violet-600 bg-violet-50',
  functional: 'text-emerald-600 bg-emerald-50',
};

export default function CookiePreferencesModal({ onSave, onClose, isRevoke = false }) {
  const current = getConsentState();
  const [expanded, setExpanded] = useState(null);
  const [prefs, setPrefs] = useState({
    analytics: current?.accepted_categories?.includes('analytics') ?? false,
    marketing: current?.accepted_categories?.includes('marketing') ?? false,
    functional: current?.accepted_categories?.includes('functional') ?? false,
  });

  const handleSave = () => {
    setCustomConsent(prefs);
    onSave?.();
  };

  const handleRevoke = () => {
    if (!confirm('Isso irá revogar todo o consentimento e recarregar a página. Confirmar?')) return;
    revokeConsent();
  };

  const categories = Object.values(COOKIE_CATEGORIES);

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 flex-shrink-0">
          <div>
            <h2 className="font-bold text-[#111827] text-base">Preferências de cookies</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">Escolha quais categorias você aceita</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body scrollável */}
        <div className="flex-1 overflow-y-auto modal-scroll px-5 py-4 space-y-3">
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat.id];
            const colorClass = CATEGORY_COLORS[cat.id];
            const isOn = cat.always_on ? true : prefs[cat.id];
            const isExpanded = expanded === cat.id;

            return (
              <div key={cat.id} className="border border-black/8 rounded-xl overflow-hidden">
                {/* Linha principal */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[#111827]">{cat.label}</div>
                    <div className="text-[11px] text-[#6B7280] leading-snug mt-0.5 line-clamp-2">{cat.description}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle */}
                    {cat.always_on ? (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Sempre ativo</span>
                    ) : (
                      <button
                        onClick={() => setPrefs(p => ({ ...p, [cat.id]: !p[cat.id] }))}
                        className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 flex-shrink-0 ${isOn ? 'bg-[#2563EB]' : 'bg-gray-200'}`}
                        style={{ height: '22px', width: '40px' }}
                      >
                        <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform duration-200 ${isOn ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
                          style={{ height: '18px', width: '18px', transform: isOn ? 'translateX(18px)' : 'translateX(2px)' }}
                        />
                      </button>
                    )}
                    {/* Expand */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : cat.id)}
                      className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Detalhes expandidos */}
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-black/5 pt-2 bg-gray-50/50">
                    {cat.cookies?.length > 0 && (
                      <div className="mb-2">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cookies</div>
                        <div className="flex flex-wrap gap-1">
                          {cat.cookies.map(c => (
                            <code key={c} className="text-[10px] bg-white border border-black/8 px-1.5 py-0.5 rounded text-gray-600">{c}</code>
                          ))}
                        </div>
                      </div>
                    )}
                    {cat.scripts?.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Scripts de terceiros</div>
                        <div className="flex flex-col gap-0.5">
                          {cat.scripts.map(s => (
                            <code key={s} className="text-[10px] text-gray-500">{s}</code>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Expiração */}
          <div className="text-[11px] text-gray-400 text-center pt-1">
            Consentimento válido por 6 meses · Revalidação automática
          </div>
        </div>

        {/* Footer com ações */}
        <div className="flex-shrink-0 border-t border-black/5 px-5 py-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-black/10 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-bold hover:bg-[#1d4ed8] transition-colors shadow-[0_2px_8px_rgba(37,99,235,0.3)]"
            >
              Salvar preferências
            </button>
          </div>
          {current && (
            <button
              onClick={handleRevoke}
              className="w-full text-xs text-red-400 hover:text-red-600 transition-colors py-1"
            >
              Revogar todo o consentimento
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}