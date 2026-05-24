// CpfRestrictionCard — exibido quando o cadastro automático detecta CPF (11 dígitos).
// Bloqueia a continuação e oferece contato direto com a equipe O CORTE
// (WhatsApp como CTA principal, e-mail como secundário).
//
// Política PJ-first: docs/PJ_ONLY_POLICY.md
//
// Props:
//   formData (opcional)  → { name, email, phone, city } pré-preenche a mensagem WhatsApp.
//   origin (opcional)    → identifica de onde o bloqueio veio (checkout | onboarding).
//                          Apenas registrado no console (observabilidade local) —
//                          não envia ao backend para evitar exigir auth no /checkout público.

import { Building2, MessageCircle, Mail, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Defaults seguros caso o env não esteja carregado no SSR/build.
// Os secrets reais (OCORTE_COMMERCIAL_WHATSAPP / OCORTE_COMMERCIAL_EMAIL) ficam no backend.
// Para o frontend usar valores específicos por ambiente, exponha-os via APP_URL/config
// — aqui usamos placeholders sensatos.
const WHATSAPP_NUMBER = '5511999999999';      // override em produção via build env se necessário
const COMMERCIAL_EMAIL = 'comercial@ocorte.app';

function buildWhatsAppMessage({ name, email, phone, city } = {}) {
  const lines = [
    'Olá! Vim do site da O CORTE.',
    'Atuo como pessoa física (CPF) e gostaria de saber se posso ativar minha conta.',
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

// Observabilidade local: tenta enviar ao trackEvent (silencioso se não autenticado).
// Em rotas públicas (/checkout), trackEvent retorna 401 — ignorado.
function fireEvent(eventType, metadata) {
  try {
    base44.functions.invoke('trackEvent', { event_type: eventType, metadata }).catch(() => {});
  } catch { /* ignore */ }
  // Log local sempre — útil para debugging mesmo sem auth
  // eslint-disable-next-line no-console
  console.info('[pj-first]', eventType, metadata || {});
}

export default function CpfRestrictionCard({ formData, origin = 'checkout' }) {
  const waMessage = buildWhatsAppMessage(formData);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${waMessage}`;
  const emailUrl = `mailto:${COMMERCIAL_EMAIL}?subject=${encodeURIComponent('Solicitação de cadastro via CPF')}&body=${waMessage}`;

  const handleWhatsApp = () => {
    fireEvent('cpf_contact_click_whatsapp', { origin });
  };
  const handleEmail = () => {
    fireEvent('cpf_contact_click_email', { origin });
  };

  return (
    <div className="bg-white rounded-2xl border border-[#2563EB]/15 p-5 sm:p-6 shadow-card animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-black text-[#0F172A] leading-tight">Cadastro via CPF</h3>
          <p className="text-xs text-gray-500 mt-0.5">Atendimento personalizado pela nossa equipe</p>
        </div>
      </div>

      {/* Texto */}
      <p className="text-sm text-gray-700 leading-relaxed mb-2">
        No momento, o cadastro automático do <strong>O CORTE</strong> está disponível apenas para
        empresas com <strong>CNPJ</strong> ou <strong>MEI</strong>.
      </p>
      <p className="text-sm text-gray-700 leading-relaxed mb-5">
        Se você ainda atua como pessoa física, fale com nossa equipe para avaliarmos possibilidades
        de ativação.
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
          Nossa equipe responde em horário comercial. Já temos barbearias atendidas via análise
          manual — entre em contato e conversamos sobre o seu caso.
        </span>
      </div>
    </div>
  );
}

// Helper exportado para uso em validações de form (Checkout / Onboarding).
// CPF = 11 dígitos; CNPJ = 14 dígitos.
export function isPersonaFisica(rawValue) {
  const digits = String(rawValue || '').replace(/\D/g, '');
  return digits.length === 11;
}

export function isPersonaJuridica(rawValue) {
  const digits = String(rawValue || '').replace(/\D/g, '');
  return digits.length === 14;
}