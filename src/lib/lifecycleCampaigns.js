// Helpers puros para campanhas de lifecycle (Fase 3 — CRM ativo).
// Usados tanto pelo backend (runLifecycleCampaigns) quanto pela UI de
// configuração para garantir uma única fonte da verdade.

export const CAMPAIGN_KEYS = [
  'primeira_visita',
  'em_risco',
  'inativo',
  'perdido',
  'vip_inativo',
  'fiel_sem_plano',
];

// Defaults usados quando a Company ainda não tem lifecycle_campaigns salvo.
// Mantém paridade com o schema da entity Company.
export const CAMPAIGN_DEFAULTS = {
  primeira_visita: {
    enabled: false,
    delay_hours: 2,
    message: 'Eaí {nome}, foi um prazer te receber na {barbearia} hoje! 🔥 Esperamos te ver de volta em breve. Quando quiser marcar de novo, é só chamar: {link_agendamento}',
  },
  em_risco: {
    enabled: false,
    cooldown_days: 14,
    message: 'Fala {nome}! Faz um tempinho que você não passa aqui na {barbearia} 👀 Bora marcar aquele trato? {link_agendamento}',
  },
  inativo: {
    enabled: false,
    cooldown_days: 30,
    message: 'Oi {nome}! Sentimos sua falta na {barbearia} 💈 Que tal voltar com a gente? Marca seu horário: {link_agendamento}',
  },
  perdido: {
    enabled: false,
    cooldown_days: 60,
    message: '{nome}, faz tempo né? 😅 Se você quiser dar uma chance pra gente de novo, a {barbearia} tá te esperando. Marca aí: {link_agendamento}',
  },
  vip_inativo: {
    enabled: false,
    cooldown_days: 15,
    alert_owner: true,
    message: 'Oi {nome}! Faz um tempo que não te vemos por aqui e queríamos muito te receber de novo na {barbearia} 👑 Posso te garantir um horário VIP essa semana? {link_agendamento}',
  },
  fiel_sem_plano: {
    enabled: false,
    cooldown_days: 45,
    message: 'Eaí {nome}! Como você é cliente da casa aqui na {barbearia}, queria te oferecer nossos planos com desconto. Vale muito a pena, dá uma olhada: {link_agendamento}',
  },
};

// Metadados visuais e textuais para a UI.
export const CAMPAIGN_LABELS = {
  primeira_visita: { label: 'Boas-vindas (1ª visita)', icon: '👋', color: 'sky', desc: 'Disparada algumas horas após o primeiro atendimento concluído. Cria vínculo e abre porta para volta.' },
  em_risco: { label: 'Em risco', icon: '⚠️', color: 'amber', desc: 'Cliente sumiu há ~30 dias. Reengajamento leve e direto.' },
  inativo: { label: 'Inativo', icon: '💤', color: 'orange', desc: 'Cliente sem visita há ~60 dias. Tentativa de recuperação.' },
  perdido: { label: 'Perdido', icon: '🚪', color: 'red', desc: 'Cliente +90 dias inativo. Última cartada antes de aceitar a perda.' },
  vip_inativo: { label: 'VIP em risco', icon: '👑', color: 'purple', desc: 'Cliente VIP que entrou em risco/inativo. Tratamento prioritário.' },
  fiel_sem_plano: { label: 'Cliente fiel sem plano', icon: '⭐', color: 'emerald', desc: 'Cliente recorrente sem assinatura ativa. Oferta de upsell.' },
};

// Mapeia chave de campanha → tipo gravado em WhatsAppMessage.type
export const CAMPAIGN_TO_MSG_TYPE = {
  primeira_visita: 'crm_primeira_visita',
  em_risco: 'crm_em_risco',
  inativo: 'crm_inativo',
  perdido: 'crm_perdido',
  vip_inativo: 'crm_vip_inativo',
  fiel_sem_plano: 'crm_fiel_sem_plano',
};

// Chave do log dentro de Customer.lifecycle_campaigns_log
export const CAMPAIGN_TO_LOG_KEY = {
  primeira_visita: 'primeira_visita_sent_at',
  em_risco: 'em_risco_sent_at',
  inativo: 'inativo_sent_at',
  perdido: 'perdido_sent_at',
  vip_inativo: 'vip_inativo_sent_at',
  fiel_sem_plano: 'fiel_sem_plano_sent_at',
};

// Mescla defaults com config salva (proteção contra campanhas ausentes).
export function mergeCampaignsConfig(saved) {
  const out = {};
  for (const k of CAMPAIGN_KEYS) {
    out[k] = { ...CAMPAIGN_DEFAULTS[k], ...(saved?.[k] || {}) };
  }
  return out;
}

// Renderiza template substituindo {nome}, {barbearia}, {link_agendamento}.
export function renderTemplate(tpl, vars) {
  if (!tpl) return '';
  return String(tpl).replace(/\{(\w+)\}/g, (_, k) => (vars?.[k] != null ? String(vars[k]) : `{${k}}`));
}

// Verifica se um cliente está em cooldown para uma campanha.
export function isInCooldown(customer, campaignKey, cooldownDays) {
  const logKey = CAMPAIGN_TO_LOG_KEY[campaignKey];
  const lastSent = customer?.lifecycle_campaigns_log?.[logKey];
  if (!lastSent) return false;
  const ms = Date.now() - new Date(lastSent).getTime();
  if (Number.isNaN(ms)) return false;
  return ms < (Number(cooldownDays) || 0) * 86400000;
}

// Determina qual campanha de lifecycle é elegível para um cliente.
// Retorna a chave da campanha (ou null se nenhuma).
// Regra: VIP+inativo/em_risco → vip_inativo; senão lifecycle_status; fiel_sem_plano só se hasActivePlan=false.
export function pickCampaignForCustomer(customer, { hasActivePlan = false } = {}) {
  if (!customer) return null;
  const isVip = customer.status === 'vip';
  const lc = customer.lifecycle_status;

  if (isVip && (lc === 'em_risco' || lc === 'inativo' || lc === 'perdido')) {
    return 'vip_inativo';
  }
  if (lc === 'em_risco') return 'em_risco';
  if (lc === 'inativo') return 'inativo';
  if (lc === 'perdido') return 'perdido';
  if (lc === 'fiel' && !hasActivePlan) return 'fiel_sem_plano';
  return null;
}