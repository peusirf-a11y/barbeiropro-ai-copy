// Helpers para abrir o WhatsApp do cliente com mensagens pré-preenchidas
// (envio manual pela barbearia — não usa Z-API).
//
// Reutiliza os MESMOS templates que o dono já configurou em
// Company.whatsapp_settings.msg_* (confirmação, lembrete 24h/2h, pós-atendimento,
// reativação). Não cria sistema paralelo de mensagens.
//
// Placeholders padronizados (mantidos para compat com whatsapp_settings):
//   {nome}, {barbearia}, {data}, {hora}, {link_avaliacao}, {link_agendamento}

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Normalização / link ─────────────────────────────────────────────────

export function normalizeWhatsAppNumber(raw, defaultCountry = '55') {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  // Já tem DDI (>= 12 dígitos = 55 + DDD + número)
  if (digits.length >= 12) return digits;
  return `${defaultCountry}${digits}`;
}

// Alias antigo mantido para não quebrar usos atuais (EditAppointmentModal etc.)
export const formatPhoneToIntl = normalizeWhatsAppNumber;

export function buildWhatsAppLink(phone, message) {
  const intl = normalizeWhatsAppNumber(phone);
  if (!intl) return null;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message || '')}`;
}

// ─── Template engine ─────────────────────────────────────────────────────

// Substitui {placeholder} (estilo whatsapp_settings) E {{placeholder}} (estilo
// pedido no enunciado). Mantém compat com qualquer template salvo no banco.
export function interpolateTemplate(template, vars = {}) {
  if (!template) return '';
  return Object.entries(vars).reduce((acc, [k, v]) => {
    const value = String(v ?? '');
    return acc.replaceAll(`{{${k}}}`, value).replaceAll(`{${k}}`, value);
  }, template);
}

// Alias antigo
export const renderTemplate = interpolateTemplate;

// ─── Builders de mensagem ────────────────────────────────────────────────
// Cada builder lê primeiro o template configurado pela barbearia em
// Company.whatsapp_settings.* — se vazio, cai num default razoável.

function appointmentVars({ company, appointment, reviewLink, bookingLink }) {
  // Guarda contra scheduled_at ausente OU inválido (ex: legado, drag em curso).
  // date-fns format() joga RangeError para Date inválido — protegemos com isNaN.
  let dt = null;
  if (appointment?.scheduled_at) {
    const parsed = new Date(appointment.scheduled_at);
    if (!Number.isNaN(parsed.getTime())) dt = parsed;
  }
  const fullName = appointment?.customer_name || '';
  return {
    nome: fullName.split(' ')[0] || fullName,
    nome_completo: fullName,
    barbearia: company?.name || '',
    data: dt ? format(dt, "dd 'de' MMMM", { locale: ptBR }) : '',
    hora: dt ? format(dt, 'HH:mm') : '',
    servico: appointment?.service_name || '',
    profissional: appointment?.professional_name || '',
    link_avaliacao: reviewLink || '',
    link_agendamento: bookingLink || '',
    // Aliases em inglês — para devs futuros (não usados pelos templates do dono)
    first_name: fullName.split(' ')[0] || fullName,
    company_name: company?.name || '',
    review_link: reviewLink || '',
    service_name: appointment?.service_name || '',
    professional_name: appointment?.professional_name || '',
    date: dt ? format(dt, "dd 'de' MMMM", { locale: ptBR }) : '',
    time: dt ? format(dt, 'HH:mm') : '',
  };
}

export function buildConfirmationMessage({ company, appointment }) {
  const tpl = company?.whatsapp_settings?.msg_confirmation
    || 'Olá, {nome}! Seu horário na {barbearia} foi confirmado para {data} às {hora}. Te esperamos! 💈';
  return interpolateTemplate(tpl, appointmentVars({ company, appointment }));
}

// Lembrete — usa msg_reminder_2h por padrão (mais próximo do "hoje").
// Caller pode passar variant='24h' para usar msg_reminder_24h.
export function buildReminderMessage({ company, appointment, variant = '2h' }) {
  const settings = company?.whatsapp_settings || {};
  const tpl = (variant === '24h' ? settings.msg_reminder_24h : settings.msg_reminder_2h)
    || 'Olá, {nome}! Passando para lembrar do seu horário às {hora} na {barbearia}. Nos vemos em breve ✂️';
  return interpolateTemplate(tpl, appointmentVars({ company, appointment }));
}

export function buildPostAppointmentMessage({ company, appointment, reviewLink }) {
  const tpl = company?.whatsapp_settings?.msg_post_appointment
    || 'Olá {nome} 🙌\n\nComo foi sua experiência hoje na {barbearia}? Sua opinião é muito importante para nós.\n\nAvaliar atendimento: {link_avaliacao}';
  return interpolateTemplate(tpl, appointmentVars({ company, appointment, reviewLink }));
}

export function buildReactivationMessage({ company, customer }) {
  const tpl = company?.whatsapp_settings?.msg_reactivation
    || 'Fala, {nome}! Sumiu hein 👀 Já tá na hora de dar aquele trato! Quer que eu veja um horário pra você essa semana?';
  const name = customer?.name || '';
  return interpolateTemplate(tpl, {
    nome: name.split(' ')[0] || name,
    nome_completo: name,
    barbearia: company?.name || '',
    first_name: name.split(' ')[0] || name,
    company_name: company?.name || '',
  });
}

// Reagendamento — não há template no whatsapp_settings; sempre usa default.
export function buildReschedulingMessage({ company, customer }) {
  const name = customer?.name || '';
  return interpolateTemplate(
    'Olá {nome} 👋\n\nPrecisamos reagendar seu atendimento. Pode me responder aqui para escolhermos um novo horário? 🙌',
    {
      nome: name.split(' ')[0] || name,
      barbearia: company?.name || '',
    }
  );
}

// ─── Abertura do WhatsApp ────────────────────────────────────────────────

// Detecta mobile/desktop apenas para fins de logging. Ambos os formatos
// (wa.me e api.whatsapp.com) funcionam nas duas plataformas, mas wa.me é
// o universal — o app/Web detectam e abrem corretamente.
function isMobileUA() {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
}

// API canônica nova. Retorna true em caso de sucesso, false se sem telefone.
// O caller pode mostrar um toast quando false (UX preferida vs alert).
export function openWhatsApp(phone, message) {
  const url = buildWhatsAppLink(phone, message);
  if (!url) return false;
  // noopener/noreferrer + _blank: abre nova aba no desktop, app nativo no mobile.
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

// Alias antigo mantido — ainda usado em EditAppointmentModal.
export function openWhatsAppCompose({ phone, message }) {
  const ok = openWhatsApp(phone, message);
  if (!ok) {
    // Fallback ao alert antigo (compat). Componentes novos devem usar openWhatsApp diretamente
    // e tratar o false com toast amigável.
    alert('Cliente sem WhatsApp cadastrado.');
  }
  return ok;
}

// Exporta para testes / debug
export const __debug = { isMobileUA };