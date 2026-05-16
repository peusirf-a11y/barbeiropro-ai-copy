// CustomerConsentPanel — Painel de gerenciamento de consentimentos LGPD
// Exibido na área do cliente (/cliente/:slug) e no painel admin de clientes.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, CheckCircle, X, Loader2 } from 'lucide-react';

const CONSENT_LABELS = {
  whatsapp_marketing: {
    label: 'Marketing via WhatsApp',
    desc: 'Campanhas, promoções e ofertas por WhatsApp',
    marketing: true,
  },
  email_marketing: {
    label: 'Marketing por e-mail',
    desc: 'Newsletters, promoções e novidades por e-mail',
    marketing: true,
  },
  automated_reminders: {
    label: 'Lembretes automáticos',
    desc: 'Lembretes de agendamento (24h e 2h antes)',
    marketing: false,
  },
  post_service_review: {
    label: 'Avaliações pós-atendimento',
    desc: 'Pedido de avaliação após cada atendimento',
    marketing: false,
  },
  ai_recommendations: {
    label: 'Recomendações personalizadas',
    desc: 'Sugestões de planos e serviços com base no histórico',
    marketing: true,
  },
};

export default function CustomerConsentPanel({ companyId, customerId, customerToken, readOnly = false }) {
  const queryClient = useQueryClient();
  const [pendingType, setPendingType] = useState(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['consents', companyId, customerId],
    queryFn: () => base44.functions.invoke('manageConsent', {
      action: 'list',
      company_id: companyId,
      customer_id: customerId,
      customer_token: customerToken,
    }),
    enabled: !!companyId && !!customerId,
    staleTime: 2 * 60 * 1000,
  });

  const consents = res?.data?.consents || [];

  const getConsentStatus = (type) => {
    const c = consents.find(x => x.consent_type === type);
    if (!c) return null; // não definido ainda
    return c.granted && !c.revoked_at ? true : false;
  };

  const setMutation = useMutation({
    mutationFn: ({ type, granted }) => base44.functions.invoke('manageConsent', {
      action: 'set',
      company_id: companyId,
      customer_id: customerId,
      customer_token: customerToken,
      consent_type: type,
      granted,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consents', companyId, customerId] });
      setPendingType(null);
    },
    onError: () => setPendingType(null),
  });

  const handleToggle = (type, currentValue) => {
    if (readOnly) return;
    const newValue = currentValue === true ? false : true;
    setPendingType(type);
    setMutation.mutate({ type, granted: newValue });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  const operationalTypes = Object.entries(CONSENT_LABELS).filter(([, v]) => !v.marketing);
  const marketingTypes = Object.entries(CONSENT_LABELS).filter(([, v]) => v.marketing);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-4 h-4 text-[#2563EB]" />
        <h3 className="font-bold text-sm text-[#111827]">Privacidade & Consentimentos</h3>
      </div>

      {/* Operacional */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Operacional</div>
        <div className="space-y-1">
          {operationalTypes.map(([type, cfg]) => {
            const status = getConsentStatus(type);
            const isActive = status !== false; // null = padrão ativo
            const isPending = pendingType === type;
            return (
              <ConsentRow
                key={type}
                label={cfg.label}
                desc={cfg.desc}
                isActive={isActive}
                isPending={isPending}
                readOnly={readOnly}
                onToggle={() => handleToggle(type, isActive ? true : false)}
              />
            );
          })}
        </div>
      </div>

      {/* Marketing */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Marketing — requer opt-in</div>
        <div className="space-y-1">
          {marketingTypes.map(([type, cfg]) => {
            const status = getConsentStatus(type);
            const isActive = status === true; // null = padrão inativo para marketing
            const isPending = pendingType === type;
            return (
              <ConsentRow
                key={type}
                label={cfg.label}
                desc={cfg.desc}
                isActive={isActive}
                isPending={isPending}
                readOnly={readOnly}
                onToggle={() => handleToggle(type, isActive)}
                marketingBadge
              />
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-gray-400 leading-relaxed">
        Consentimentos registrados conforme Art. 18 da LGPD (Lei 13.709/2018).
        Você pode revogar qualquer consentimento a qualquer momento.
      </p>
    </div>
  );
}

function ConsentRow({ label, desc, isActive, isPending, readOnly, onToggle, marketingBadge }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-transparent hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[#111827]">{label}</span>
          {marketingBadge && (
            <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">OPCIONAL</span>
          )}
        </div>
        <div className="text-xs text-gray-500">{desc}</div>
      </div>
      {readOnly ? (
        <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
          {isActive ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
          {isActive ? 'Ativo' : 'Inativo'}
        </div>
      ) : (
        <button
          onClick={onToggle}
          disabled={isPending}
          className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none ${isActive ? 'bg-[#2563EB]' : 'bg-gray-200'} disabled:opacity-50`}
        >
          {isPending
            ? <Loader2 className="w-3 h-3 text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
            : <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isActive ? 'left-5' : 'left-0.5'}`} />
          }
        </button>
      )}
    </div>
  );
}