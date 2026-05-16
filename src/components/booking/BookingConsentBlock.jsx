// Bloco de consentimento LGPD compacto para o fluxo de booking público.
// UX: um checkbox essencial visível + link "gerenciar preferências" que expande opcionais.
// Backend: persiste via manageConsent (auditável). Totalmente não-blocante para conversão.

import { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const OPTIONAL_CONSENTS = [
  {
    type: 'whatsapp_marketing',
    label: 'Promoções e ofertas',
    desc: 'Novidades, descontos e campanhas especiais via WhatsApp.',
  },
  {
    type: 'ai_recommendations',
    label: 'Sugestões personalizadas',
    desc: 'Receber sugestões de serviços e planos que combinam com você.',
  },
  {
    type: 'post_service_review',
    label: 'Avaliação pós-atendimento',
    desc: 'Receber pedido de avaliação após cada visita.',
  },
  {
    type: 'email_marketing',
    label: 'E-mail marketing',
    desc: 'Novidades e conteúdo exclusivo por e-mail.',
  },
];

export default function BookingConsentBlock({
  companyId,
  customerId,
  customerToken,
  onChange,
}) {
  const [expanded, setExpanded] = useState(false);
  const [optionals, setOptionals] = useState(
    Object.fromEntries(OPTIONAL_CONSENTS.map(c => [c.type, false]))
  );
  const [saving, setSaving] = useState({});

  const persistConsent = async (type, granted) => {
    if (!companyId) return;
    setSaving(p => ({ ...p, [type]: true }));
    try {
      await base44.functions.invoke('manageConsent', {
        action: 'set',
        company_id: companyId,
        customer_id: customerId,
        customer_token: customerToken,
        consent_type: type,
        granted,
        source: 'booking_flow',
      });
    } catch (_) {
      // silencioso — não bloqueia booking
    } finally {
      setSaving(p => ({ ...p, [type]: false }));
    }
  };

  const handleOptionalToggle = (type) => {
    const next = !optionals[type];
    setOptionals(p => ({ ...p, [type]: next }));
    persistConsent(type, next);
    onChange?.({ ...optionals, [type]: next });
  };

  return (
    <div className="rounded-2xl border border-black/8 bg-white overflow-hidden">
      {/* Linha essencial — sempre visível */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-shrink-0">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500">
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#111827] leading-tight">
            Comunicações essenciais do agendamento
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">
            Confirmação, lembretes e atualizações do seu horário.
          </div>
        </div>
        <Lock className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
      </div>

      {/* Separador + link gerenciar */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border-t border-black/5 bg-gray-50/60 hover:bg-gray-100/60 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-gray-400" />
          <span className="text-[11px] font-semibold text-gray-500">Gerenciar preferências de privacidade</span>
        </div>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {/* Opcionais — expande suavemente */}
      {expanded && (
        <div className="divide-y divide-black/5 border-t border-black/5">
          {OPTIONAL_CONSENTS.map(cfg => {
            const checked = optionals[cfg.type];
            const isSaving = saving[cfg.type];
            return (
              <div key={cfg.type} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#111827] leading-tight">{cfg.label}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{cfg.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleOptionalToggle(cfg.type)}
                  disabled={isSaving}
                  className={`flex-shrink-0 w-9 h-5 rounded-full relative transition-colors duration-200 ${checked ? 'bg-emerald-500' : 'bg-gray-200'} ${isSaving ? 'opacity-50' : ''}`}
                  aria-label={checked ? 'Desativar' : 'Ativar'}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          })}
          <div className="px-4 py-2.5">
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Revogue a qualquer momento em sua conta. · {' '}
              <a href="/politica-de-privacidade" target="_blank" className="underline hover:text-gray-600">
                Política de Privacidade
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}