// Campanhas D1/D3/D7 (cron diário).
// Idempotente via flags em UserEvent (campaign_d{1,3,7}_sent).
//
// Regras:
//   D1: company criada há 1 dia + onboarding NÃO completo → mensagem "ajuda 2 min"
//   D3: company criada há 3 dias + 0 appointments         → mensagem "trazer clientes"
//   D7: company criada há 7 dias + score < 71             → mensagem "demo assistida"
//
// Envio: usa sendWhatsAppMessage (function existente). Em caso de falha de envio,
// NÃO marca como enviado (próxima execução tenta de novo).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ROLES = ['admin']; // só super admin pode invocar manualmente
class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

async function alreadySent(sdk, company_id, event_type) {
  const ev = await sdk.entities.UserEvent.filter({ company_id, event_type }, '-created_date', 1);
  return ev && ev.length > 0;
}

async function markSent(sdk, company_id, event_type, metadata = {}) {
  await sdk.entities.UserEvent.create({ company_id, event_type, source: 'automation', metadata });
}

async function calcScore(sdk, company) {
  const [appts, customers, pros, payments] = await Promise.all([
    sdk.entities.Appointment.filter({ company_id: company.id }, '-created_date', 1),
    sdk.entities.Customer.filter({ company_id: company.id }, '-created_date', 1),
    sdk.entities.Professional.filter({ company_id: company.id, active: true }, '-created_date', 1),
    sdk.entities.FinancialEntry.filter({ company_id: company.id, type: 'entrada' }, '-created_date', 1),
  ]);
  return (
    (company.onboarding_completed ? 30 : 0) +
    (appts.length > 0 ? 20 : 0) +
    (customers.length > 0 ? 10 : 0) +
    (pros.length > 0 ? 20 : 0) +
    (payments.length > 0 ? 20 : 0)
  );
}

async function sendCampaign(base44, company, type, message) {
  if (!company.whatsapp) return { sent: false, reason: 'no_whatsapp' };
  try {
    const res = await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
      company_id: company.id,
      phone: company.whatsapp,
      customer_name: company.owner_name || '',
      type,
      message_text: message,
    });
    return { sent: !!res?.data?.success, reason: res?.data?.error };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

Deno.serve(async (req) => {
  console.log('[jobActivationCampaigns] start');
  try {
    const base44 = createClientFromRequest(req);

    // Permite invocação manual só por super_admin (cron passa sem user).
    let user = null;
    try { user = await base44.auth.me(); } catch { /* cron */ }
    if (user && !user.is_super_admin) {
      return Response.json({ success: false, error: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    const sdk = base44.asServiceRole;
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    // Busca companies criadas nos últimos 14 dias (janela suficiente para D1/D3/D7)
    const all = await sdk.entities.Company.list('-created_date', 500);
    const candidates = all.filter(c => {
      const created = new Date(c.created_date).getTime();
      return now - created <= 14 * DAY && c.status !== 'inactive' && c.status !== 'blocked';
    });

    const stats = { d1: 0, d3: 0, d7: 0, skipped: 0 };

    for (const company of candidates) {
      const ageDays = Math.floor((now - new Date(company.created_date).getTime()) / DAY);

      const APP_URL = 'https://barbertrimly.base44.app';

      // D1
      if (ageDays >= 1 && ageDays < 3 && !company.onboarding_completed) {
        if (!(await alreadySent(sdk, company.id, 'campaign_d1_sent'))) {
          const msg = `Olá ${company.owner_name || 'tudo certo'}! Aqui é da BarberTrimly 💈 Posso te ajudar a configurar sua barbearia em 2 minutos? Acesse: ${APP_URL}/onboarding`;
          const r = await sendCampaign(base44, company, 'reativacao', msg);
          if (r.sent) { await markSent(sdk, company.id, 'campaign_d1_sent', r); stats.d1++; }
          else stats.skipped++;
        }
      }

      // D3
      if (ageDays >= 3 && ageDays < 7) {
        const appts = await sdk.entities.Appointment.filter({ company_id: company.id }, '-created_date', 1);
        if (appts.length === 0 && !(await alreadySent(sdk, company.id, 'campaign_d3_sent'))) {
          const msg = `Fala ${company.owner_name || 'tudo bem'}! Vi que você ainda não tem agendamentos. Quer que eu te ajude a trazer seus primeiros clientes? Compartilha seu link público de agendamento: ${APP_URL}/agendar/${company.slug}`;
          const r = await sendCampaign(base44, company, 'reativacao', msg);
          if (r.sent) { await markSent(sdk, company.id, 'campaign_d3_sent', r); stats.d3++; }
          else stats.skipped++;
        }
      }

      // D7
      if (ageDays >= 7 && ageDays < 14) {
        const score = await calcScore(sdk, company);
        if (score < 71 && !(await alreadySent(sdk, company.id, 'campaign_d7_sent'))) {
          const msg = `${company.owner_name ? company.owner_name + ', ' : ''}sua barbearia ainda não decolou no BarberTrimly. Quer uma demo assistida grátis? Responde aqui que a gente marca um horário 🔥`;
          const r = await sendCampaign(base44, company, 'reativacao', msg);
          if (r.sent) { await markSent(sdk, company.id, 'campaign_d7_sent', r); stats.d7++; }
          else stats.skipped++;
        }
      }
    }

    console.log('[jobActivationCampaigns] done', stats);
    return Response.json({ success: true, stats, scanned: candidates.length });
  } catch (error) {
    if (error instanceof AuthzError) return Response.json({ success: false, error: error.code }, { status: error.status });
    console.error('[jobActivationCampaigns] error:', error.message);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});