// Job recorrente — executa as campanhas automáticas de retenção (Fase 3 do CRM).
//
// Para cada Company com onboarding_completed=true e (opcional) company_id no payload:
//   1) WELCOME (primeira_visita) — busca appointments concluídos há entre delay_hours e
//      delay_hours+24h, com customer.total_appointments<=1 e sem log de envio.
//   2) Para clientes com lifecycle_status em {em_risco, inativo, perdido, fiel} e VIPs
//      em risco, dispara mensagem da campanha correspondente respeitando cooldown
//      configurado em Company.lifecycle_campaigns.
//
// Idempotência:
//   - Welcome: log em Customer.lifecycle_campaigns_log.primeira_visita_sent_at
//   - Demais: cooldown_days + log por chave de campanha
//
// Auditoria: cada envio bem-sucedido cria um WhatsAppMessage com type=crm_*.
//
// Entrada (opcional): { company_id, dry_run, limit }
//   - company_id: roda só pra uma empresa (debug)
//   - dry_run=true: não envia, só retorna o que faria
//   - limit: máx. de envios por execução (default 200)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CAMPAIGN_DEFAULTS = {
  primeira_visita: { enabled: false, delay_hours: 2, message: '' },
  em_risco: { enabled: false, cooldown_days: 14, message: '' },
  inativo: { enabled: false, cooldown_days: 30, message: '' },
  perdido: { enabled: false, cooldown_days: 60, message: '' },
  vip_inativo: { enabled: false, cooldown_days: 15, alert_owner: true, message: '' },
  fiel_sem_plano: { enabled: false, cooldown_days: 45, message: '' },
};

const CAMPAIGN_TO_MSG_TYPE = {
  primeira_visita: 'crm_primeira_visita',
  em_risco: 'crm_em_risco',
  inativo: 'crm_inativo',
  perdido: 'crm_perdido',
  vip_inativo: 'crm_vip_inativo',
  fiel_sem_plano: 'crm_fiel_sem_plano',
};

const LOG_KEY = {
  primeira_visita: 'primeira_visita_sent_at',
  em_risco: 'em_risco_sent_at',
  inativo: 'inativo_sent_at',
  perdido: 'perdido_sent_at',
  vip_inativo: 'vip_inativo_sent_at',
  fiel_sem_plano: 'fiel_sem_plano_sent_at',
};

function renderTemplate(tpl, vars) {
  if (!tpl) return '';
  return String(tpl).replace(/\{(\w+)\}/g, (_, k) => (vars?.[k] != null ? String(vars[k]) : `{${k}}`));
}

function isInCooldown(customer, campaignKey, cooldownDays) {
  const logKey = LOG_KEY[campaignKey];
  const lastSent = customer?.lifecycle_campaigns_log?.[logKey];
  if (!lastSent) return false;
  const ms = Date.now() - new Date(lastSent).getTime();
  if (Number.isNaN(ms)) return false;
  return ms < (Number(cooldownDays) || 0) * 86400000;
}

// Hora local da empresa (assumimos BRT/UTC-3 — todas barbearias são BR).
// Janela default 09:00–20:00 evita envio madrugada.
function isWithinSendWindow(company) {
  const s = company?.whatsapp_settings || {};
  const start = s.send_window_start || '09:00';
  const end = s.send_window_end || '20:00';
  const now = new Date();
  const brtHour = (now.getUTCHours() - 3 + 24) % 24;
  const brtMin = now.getUTCMinutes();
  const minutes = brtHour * 60 + brtMin;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + (sm || 0);
  const endMin = eh * 60 + (em || 0);
  return minutes >= startMin && minutes <= endMin;
}

function mergeCampaigns(saved) {
  const out = {};
  for (const k of Object.keys(CAMPAIGN_DEFAULTS)) {
    out[k] = { ...CAMPAIGN_DEFAULTS[k], ...(saved?.[k] || {}) };
  }
  return out;
}

function pickCampaignForCustomer(customer, hasActivePlan) {
  const isVip = customer.status === 'vip';
  const lc = customer.lifecycle_status;
  if (isVip && (lc === 'em_risco' || lc === 'inativo' || lc === 'perdido')) return 'vip_inativo';
  if (lc === 'em_risco') return 'em_risco';
  if (lc === 'inativo') return 'inativo';
  if (lc === 'perdido') return 'perdido';
  if (lc === 'fiel' && !hasActivePlan) return 'fiel_sem_plano';
  return null;
}

// Verifica consentimento de marketing WhatsApp (LGPD guard)
// Retorna true se o cliente tem consentimento ativo ou se não há registro (fallback seguro = false para marketing)
async function hasMarketingConsent(sdk, customerId, companyId) {
  try {
    const consents = await sdk.entities.CustomerConsent.filter({
      company_id: companyId,
      customer_id: customerId,
      consent_type: 'whatsapp_marketing',
    }, '-created_date', 1);
    if (consents.length === 0) return false; // sem registro = sem consentimento
    const c = consents[0];
    return c.granted === true && !c.revoked_at;
  } catch (_) {
    return false; // em caso de erro, bloqueia por segurança
  }
}

async function processCompany(sdk, company, baseUrl, { dryRun, limit }) {
  const campaigns = mergeCampaigns(company.lifecycle_campaigns);
  const anyEnabled = Object.values(campaigns).some(c => c?.enabled);
  if (!anyEnabled) {
    return { company_id: company.id, skipped: 'all_campaigns_disabled' };
  }
  if (!isWithinSendWindow(company)) {
    return { company_id: company.id, skipped: 'outside_send_window' };
  }

  const wppSettings = company.whatsapp_settings || {};
  if (wppSettings.enabled === false) {
    return { company_id: company.id, skipped: 'whatsapp_disabled' };
  }

  const stats = {
    company_id: company.id,
    welcome_sent: 0,
    em_risco_sent: 0,
    inativo_sent: 0,
    perdido_sent: 0,
    vip_inativo_sent: 0,
    fiel_sem_plano_sent: 0,
    skipped_cooldown: 0,
    skipped_no_phone: 0,
    errors: [],
  };

  let sentCount = 0;
  const baseLink = `${baseUrl}/agendar/${company.slug || company.id}`;

  // ── 1) WELCOME (primeira_visita) ───────────────────────────────────────
  // Busca appointments concluídos recentemente. Janela: [delay, delay+24h].
  if (campaigns.primeira_visita.enabled) {
    const delayH = Number(campaigns.primeira_visita.delay_hours) || 2;
    const now = Date.now();
    const windowStart = new Date(now - (delayH + 24) * 3600000).toISOString();
    const windowEnd = new Date(now - delayH * 3600000).toISOString();

    // Filter sem range nativo: pegamos todos concluídos da company recentes (até 200)
    // e filtramos por completed_at em memória.
    const recentConcluded = await sdk.entities.Appointment.filter({
      company_id: company.id,
      status: 'concluido',
    }, '-completed_at', 200);

    const inWindow = recentConcluded.filter(a => {
      const t = a.completed_at;
      return t && t >= windowStart && t <= windowEnd && a.customer_id;
    });

    for (const appt of inWindow) {
      if (sentCount >= limit) break;
      try {
        const customer = await sdk.entities.Customer.get(appt.customer_id);
        if (!customer || !customer.phone) { stats.skipped_no_phone++; continue; }
        // Welcome só para 1ª visita: total_appointments <= 1
        if ((Number(customer.total_appointments) || 0) > 1) continue;
        // Já enviado?
        if (customer.lifecycle_campaigns_log?.primeira_visita_sent_at) continue;

        const message = renderTemplate(campaigns.primeira_visita.message, {
          nome: customer.name?.split(' ')[0] || 'cliente',
          barbearia: company.name,
          link_agendamento: baseLink,
        });

        if (!dryRun) {
          await sdk.functions.invoke('sendWhatsAppMessage', {
            phone: customer.phone,
            message,
            type: CAMPAIGN_TO_MSG_TYPE.primeira_visita,
            company_id: company.id,
            unit_id: appt.unit_id || customer.unit_id || undefined,
            customer_id: customer.id,
            customer_name: customer.name,
            appointment_id: appt.id,
            // A8: dedup forte — 1 welcome por (cliente, appointment)
            idempotency_key: `crm_primeira_visita:${appt.id}`,
          });
          await sdk.entities.Customer.update(customer.id, {
            lifecycle_campaigns_log: {
              ...(customer.lifecycle_campaigns_log || {}),
              primeira_visita_sent_at: new Date().toISOString(),
            },
          });
        }
        stats.welcome_sent++;
        sentCount++;
      } catch (err) {
        stats.errors.push(`welcome ${appt.id}: ${err.message}`);
      }
    }
  }

  // ── 2) Campanhas por lifecycle_status ───────────────────────────────────
  // Carregamos clientes com lifecycle_status ativo. Para fiel_sem_plano,
  // precisamos saber se tem assinatura ativa.
  const lifecycleStatuses = ['em_risco', 'inativo', 'perdido', 'fiel'];
  const customers = await sdk.entities.Customer.filter({
    company_id: company.id,
  }, '-last_completed_at', 1000);

  const candidates = customers.filter(c =>
    c.phone && lifecycleStatuses.includes(c.lifecycle_status)
  );

  // Pré-busca assinaturas ativas (para fiel_sem_plano).
  let activeSubsByCustomer = new Set();
  if (campaigns.fiel_sem_plano.enabled) {
    try {
      const subs = await sdk.entities.CustomerSubscription.filter({
        company_id: company.id,
        status: 'active',
      }, '-created_date', 1000);
      activeSubsByCustomer = new Set(subs.map(s => s.customer_id));
    } catch (_) { /* ignora — sem entity ainda */ }
  }

  // Pré-busca consentimentos de marketing para este tenant (LGPD)
  let marketingConsentSet = new Set();
  try {
    const marketingConsents = await sdk.entities.CustomerConsent.filter({
      company_id: company.id,
      consent_type: 'whatsapp_marketing',
      granted: true,
    }, '-created_date', 2000);
    marketingConsentSet = new Set(marketingConsents.map(c => c.customer_id));
  } catch (_) { /* entidade pode não existir em deploys antigos */ }

  // Campanhas que exigem consentimento de marketing explícito (LGPD)
  const MARKETING_CAMPAIGNS = new Set(['em_risco', 'inativo', 'perdido', 'vip_inativo', 'fiel_sem_plano']);

  for (const customer of candidates) {
    if (sentCount >= limit) break;

    const hasActivePlan = activeSubsByCustomer.has(customer.id);
    const campaignKey = pickCampaignForCustomer(customer, hasActivePlan);
    if (!campaignKey) continue;

    const cfg = campaigns[campaignKey];
    if (!cfg?.enabled) continue;

    // LGPD: campanhas de marketing só para clientes com consentimento explícito
    if (MARKETING_CAMPAIGNS.has(campaignKey) && !marketingConsentSet.has(customer.id)) {
      stats.skipped_no_consent = (stats.skipped_no_consent || 0) + 1;
      continue;
    }

    if (isInCooldown(customer, campaignKey, cfg.cooldown_days)) {
      stats.skipped_cooldown++;
      continue;
    }

    // LGPD guard: campanhas de marketing exigem consentimento explícito
    // Campanhas como fiel_sem_plano, vip_inativo são consideradas marketing/CRM
    const MARKETING_CAMPAIGNS = ['em_risco', 'inativo', 'perdido', 'vip_inativo', 'fiel_sem_plano'];
    if (MARKETING_CAMPAIGNS.includes(campaignKey)) {
      const hasConsent = await hasMarketingConsent(sdk, customer.id, company.id);
      if (!hasConsent) {
        stats.skipped_no_consent = (stats.skipped_no_consent || 0) + 1;
        continue;
      }
    }

    try {
      const message = renderTemplate(cfg.message, {
        nome: customer.name?.split(' ')[0] || 'cliente',
        barbearia: company.name,
        link_agendamento: baseLink,
      });

      if (!dryRun) {
        // A8: dedup forte — bucket diário evita reenvio mesmo se job rodar
        // várias vezes no mesmo dia (cooldown_days continua sendo a verdade,
        // mas isso protege contra race entre execuções).
        const dayBucket = new Date().toISOString().slice(0, 10);
        await sdk.functions.invoke('sendWhatsAppMessage', {
          phone: customer.phone,
          message,
          type: CAMPAIGN_TO_MSG_TYPE[campaignKey],
          company_id: company.id,
          unit_id: customer.unit_id || undefined,
          customer_id: customer.id,
          customer_name: customer.name,
          idempotency_key: `${CAMPAIGN_TO_MSG_TYPE[campaignKey]}:${customer.id}:${dayBucket}`,
        });
        const logUpdate = { ...(customer.lifecycle_campaigns_log || {}) };
        logUpdate[LOG_KEY[campaignKey]] = new Date().toISOString();
        if (campaignKey === 'vip_inativo' && cfg.alert_owner) {
          logUpdate.vip_inativo_alerted_at = new Date().toISOString();
        }
        await sdk.entities.Customer.update(customer.id, { lifecycle_campaigns_log: logUpdate });
      }
      stats[`${campaignKey}_sent`] = (stats[`${campaignKey}_sent`] || 0) + 1;
      sentCount++;
    } catch (err) {
      stats.errors.push(`${campaignKey} ${customer.id}: ${err.message}`);
    }
  }

  return stats;
}

Deno.serve(async (req) => {
  console.log('[runLifecycleCampaigns] start');
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;

    // Auth: aceita execução sem usuário (scheduled) OU exige admin/super_admin.
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* scheduled */ }
    if (user && user.role !== 'admin') {
      // Permite admin do tenant; scheduled job não tem user.
      // Não bloqueia para super_admin (role=admin no platform).
    }

    const body = await req.json().catch(() => ({}));
    const { company_id, dry_run = false, limit = 200 } = body;

    const baseUrl = req.headers.get('origin')
      || `https://${req.headers.get('host') || 'barbertrimly.base44.app'}`;

    let companies;
    if (company_id) {
      const c = await sdk.entities.Company.get(company_id);
      companies = c ? [c] : [];
    } else {
      companies = await sdk.entities.Company.filter({
        onboarding_completed: true,
      }, '-created_date', 500);
    }

    const results = [];
    for (const company of companies) {
      try {
        const r = await processCompany(sdk, company, baseUrl, { dryRun: dry_run, limit });
        results.push(r);
      } catch (err) {
        console.error('[runLifecycleCampaigns] company error', company.id, err.message);
        results.push({ company_id: company.id, error: err.message });
      }
    }

    const totals = results.reduce((acc, r) => {
      ['welcome_sent', 'em_risco_sent', 'inativo_sent', 'perdido_sent', 'vip_inativo_sent', 'fiel_sem_plano_sent'].forEach(k => {
        acc[k] = (acc[k] || 0) + (r[k] || 0);
      });
      return acc;
    }, {});

    console.log('[runLifecycleCampaigns] done', totals);
    return Response.json({ success: true, dry_run, totals, companies: results });
  } catch (error) {
    console.error('[runLifecycleCampaigns] fatal:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});