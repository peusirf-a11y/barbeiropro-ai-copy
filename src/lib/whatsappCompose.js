// Helpers para abrir o WhatsApp do cliente com mensagens pré-preenchidas
// (envio manual pela barbearia — não usa Z-API).
//
// formatPhoneToIntl: garante código do país (default 55 = Brasil) e remove tudo
//   que não for dígito. Aceita "(11) 9 9999-9999", "+55 11...", etc.
//
// renderTemplate: substitui placeholders {nome}, {barbearia}, {data}, {hora},
//   {link_avaliacao} usados nos templates de whatsapp_settings.

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatPhoneToIntl(raw, defaultCountry = '55') {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  // Já tem DDI (>= 12 dígitos = 55 + DDD + número)
  if (digits.length >= 12) return digits;
  return `${defaultCountry}${digits}`;
}

export function renderTemplate(template, vars = {}) {
  if (!template) return '';
  return Object.entries(vars).reduce((acc, [k, v]) => {
    return acc.replaceAll(`{${k}}`, String(v ?? ''));
  }, template);
}

// Constrói a mensagem de confirmação a partir de Company.whatsapp_settings + appointment.
export function buildConfirmationMessage({ company, appointment }) {
  const settings = company?.whatsapp_settings || {};
  const tpl = settings.msg_confirmation
    || 'Olá, {nome}! Seu horário na {barbearia} foi confirmado para {data} às {hora}. Te esperamos! 💈';
  const dt = appointment?.scheduled_at ? new Date(appointment.scheduled_at) : null;
  return renderTemplate(tpl, {
    nome: (appointment?.customer_name || '').split(' ')[0] || appointment?.customer_name || '',
    barbearia: company?.name || '',
    data: dt ? format(dt, "dd 'de' MMMM", { locale: ptBR }) : '',
    hora: dt ? format(dt, 'HH:mm') : '',
  });
}

// Abre o WhatsApp Web/app numa nova aba com o número e mensagem pré-preenchidos.
export function openWhatsAppCompose({ phone, message }) {
  const intl = formatPhoneToIntl(phone);
  if (!intl) {
    alert('Cliente sem telefone cadastrado.');
    return false;
  }
  const url = `https://wa.me/${intl}?text=${encodeURIComponent(message || '')}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}