// Seção de consentimentos LGPD para a área do cliente.
// Renderiza os toggles de consentimento e permite revogar/conceder em tempo real.

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, Loader2, ChevronDown } from 'lucide-react';

const CONSENT_CONFIG = [
  {
    type: 'automated_reminders',
    label: 'Lembretes automáticos',
    desc: 'Receber lembretes de agendamento via WhatsApp (24h e 2h antes).',
    default: true,
    required: false,
  },
  {
    type: 'post_service_review',
    label: 'Avaliação pós-atendimento',
    desc: 'Receber pedido de avaliação após cada atendimento.',
    default: true,
    required: false,
  },
  {
    type: 'whatsapp_marketing',
    label: 'Marketing via WhatsApp',
    desc: 'Promoções, campanhas e ofertas especiais via WhatsApp. Pode revogar a qualquer momento.',
    default: false,
    required: false,
  },
  {
    type: 'email_marketing',
    label: 'E-mail marketing',
    desc: 'Novidades, promoções e conteúdo exclusivo por e-mail.',
    default: false,
    required: false,
  },
  {
    type: 'ai_recommendations',
    label: 'Recomendações personalizadas',
    desc: 'Uso do seu histórico para sugestões de planos e serviços sob medida.',
    default: false,
    required: false,
  },
];

export default function CustomerConsentSection({ companyId, customerId, token, isDark = true, tw: twProp }) {
  const tw = twProp || {
    text: isDark ? 'text-white' : 'text-[#111827]',
    textMuted: isDark ? 'text-white/40' : 'text-gray-500',
    textFaint: isDark ? 'text-white/20' : 'text-gray-400',
    card: isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-black/8',
    divider: isDark ? 'border-white/10' : 'border-black/8',
  };
  const queryClient = useQueryClient();
  const [localState, setLocalState] = useState({});
  const [saving, setSaving] = useState({});
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-consents', companyId, customerId],
    queryFn: () => base44.functions.invoke('manageConsent', {
      action: 'list',
      company_id: companyId,
      customer_id: customerId,
      customer_token: token,
    }),
    enabled: !!companyId && !!customerId && !!token,
  });

  const consents = data?.data?.consents || [];

  useEffect(() => {
    if (consents.length > 0) {
      const state = {};
      consents.forEach(c => { state[c.consent_type] = c.granted; });
      setLocalState(state);
    } else {
      // Defaults quando não há registros ainda
      const defaults = {};
      CONSENT_CONFIG.forEach(c => { defaults[c.type] = c.default; });
      setLocalState(defaults);
    }
  }, [consents.length]);

  const handleToggle = async (consentType, value) => {
    setLocalState(prev => ({ ...prev, [consentType]: value }));
    setSaving(prev => ({ ...prev, [consentType]: true }));
    try {
      await base44.functions.invoke('manageConsent', {
        action: 'set',
        company_id: companyId,
        customer_id: customerId,
        customer_token: token,
        consent_type: consentType,
        granted: value,
      });
      queryClient.invalidateQueries({ queryKey: ['customer-consents', companyId, customerId] });
    } catch (err) {
      // Reverte em caso de erro
      setLocalState(prev => ({ ...prev, [consentType]: !value }));
    } finally {
      setSaving(prev => ({ ...prev, [consentType]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${tw.textFaint}`} />
          <div className="text-left">
            <div className={`font-bold text-sm ${tw.text}`}>Suas preferências de comunicação</div>
            {!expanded && <div className={`text-xs ${tw.textMuted}`}>Toque para gerenciar</div>}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 ${tw.textFaint} flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && <>
        <div className={`text-xs ${tw.textMuted} -mt-1`}>Revogue a qualquer momento. Algumas comunicações são essenciais ao serviço.</div>

      {CONSENT_CONFIG.map(cfg => {
        const isGranted = localState[cfg.type] ?? cfg.default;
        const isSaving = saving[cfg.type];

        return (
          <div key={cfg.type} className={`flex items-start justify-between gap-3 ${tw.card} rounded-xl px-4 py-3`}>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${tw.text}`}>{cfg.label}</div>
              <div className={`text-xs ${tw.textMuted} mt-0.5 leading-relaxed`}>{cfg.desc}</div>
            </div>
            <button
              onClick={() => handleToggle(cfg.type, !isGranted)}
              disabled={isSaving}
              className={`flex-shrink-0 w-11 h-6 rounded-full relative transition-colors duration-200 mt-0.5 ${isGranted ? 'bg-emerald-500' : isDark ? 'bg-white/20' : 'bg-gray-200'} ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
              aria-label={isGranted ? 'Revogar consentimento' : 'Conceder consentimento'}
            >
              {isSaving ? (
                <Loader2 className="w-3 h-3 text-white absolute top-1.5 left-1/2 -translate-x-1/2 animate-spin" />
              ) : (
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isGranted ? 'translate-x-5' : 'translate-x-0.5'}`} />
              )}
            </button>
          </div>
        );
      })}

      <div className={`text-[10px] ${tw.textFaint} text-center pt-1`}>
        Seus consentimentos são registrados com data/hora para sua proteção. · <a href="/politica-de-privacidade" className="underline" target="_blank">Política de Privacidade</a>
      </div>
      </>}
    </div>
  );
}