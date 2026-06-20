// CpfRestrictionCard — exibido quando o cadastro detecta CPF (11 dígitos).
// O CORTE opera exclusivamente com CNPJ/MEI para garantir o split automático Asaas.
// Não há modo manual. Casos especiais são tratados via análise comercial (WhatsApp/email).
//
// Política PJ-only: docs/PJ_ONLY_POLICY.md
//
// Props:
//   formData (opcional)  → { name, email, phone, city } pré-preenche a mensagem WhatsApp.
//   origin (opcional)    → identifica de onde o bloqueio veio (checkout | onboarding).

import { Building2, MessageCircle, Mail, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const WHATSAPP_NUMBER = '5511999999999';
const COMMERCIAL_EMAIL = 'comercial@ocorte.app';

function buildWhatsAppMessage({ name, email, phone, city } = {}) {
  const lines = [
    'Olá! Vim do site da O CORTE.',
    'Atuo como pessoa física (CPF) e gostaria de uma análise especial para ativar minha conta.',
    '',
    name ? `Nome: ${name}` : null,
    email ? `E-mail: ${email}` : null,
    phone ? `Telefone: ${phone}` : null,
    city ? `Cidade: ${city}` : null,
    '',
    'Origem: cadastro_pf',
  ].filter(Boolean);
  return encodeURIComponent(lines.join('\n'));
}

function fireEvent(eventType, metadata) {
  try {
    base44.functions.invoke('trackEvent', { event_type: eventType, metadata }).catch(() => {});
  } catch { /* ignore */ }
  // eslint-disable-next-line no-console
  console.info('[pj-only]', eventType, metadata || {});
}

export default function CpfRestrictionCard({ formData, origin = 'checkout' }) {
  const waMessage = buildWhatsAppMessage(formData);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waMessage}`;
  const emailUrl = `mailto:${COMMERCIAL_EMAIL}?subject=${encodeURIComponent('Solicitação de análise especial — cadastro via CPF')}&body=${waMessage}`;

  const handleWhatsApp = () => fireEvent('cpf_contact_click_whatsapp', { origin });
  const handleEmail = () => fireEvent('cpf_contact_click_email', { origin });

  return (
    <div className="bg-white rounded-2xl border border-[#2563EB]/15 p-5 sm:p-6 shadow-card animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-black text-[#0F172A] leading-tight">CNPJ obrigatório</h3>
          <p className="text-xs text-gray-500 mt-0.5">Análise especial pela nossa equipe comercial</p>
        </div>
      </div>

      {/* Texto oficial */}
      <p className="text-sm text-gray-700 leading-relaxed mb-5">
        Para utilizar os recebimentos automáticos do <strong>O CORTE</strong> é necessário possuir um <strong>CNPJ ativo</strong> (MEI também é aceito). Caso precise de uma análise especial, entre em contato pelo WhatsApp.
      </p>

      {/* CTAs */}
      <div className="space-y-2.5">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleWhatsApp}
          className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5b] text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-md active:scale-[0.99]"
        >
          <MessageCircle className="w-4 h-4" />
          Falar no WhatsApp
        </a>
        <a
          href={emailUrl}
          onClick={handleEmail}
          className="w-full flex items-center justify-center gap-2 bg-white border border-black/10 hover:border-[#2563EB] text-[#0F172A] font-semibold py-3 rounded-xl text-sm transition-all"
        >
          <Mail className="w-4 h-4 text-[#2563EB]" />
          Enviar e-mail
        </a>
      </div>

      {/* Reassurance */}
      <div className="mt-5 pt-4 border-t border-black/5 flex items-start gap-2 text-[11px] text-gray-500 leading-relaxed">
        <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0 mt-0.5" />
        <span>
          Nossa equipe responde em horário comercial e avalia caso a caso.
        </span>
      </div>
    </div>
  );
}

// Helpers de validação reaproveitados em Checkout / Onboarding.
export function isPersonaFisica(rawValue) {
  const digits = String(rawValue || '').replace(/\D/g, '');
  return digits.length === 11;
}

export function isPersonaJuridica(rawValue) {
  const digits = String(rawValue || '').replace(/\D/g, '');
  return digits.length === 14;
}