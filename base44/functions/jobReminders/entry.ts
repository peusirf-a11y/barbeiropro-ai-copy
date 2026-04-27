// Job: roda a cada 1h. Para cada empresa, encontra agendamentos futuros que precisam de:
//   - lembrete 24h antes
//   - lembrete 2h antes
// Evita duplicidade consultando WhatsAppMessage por appointment_id + tipo.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}
function renderTemplate(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}
function withinSendWindow(settings) {
  const now = new Date();
  const hhmm = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });
  const start = settings?.send_window_start || '09:00';
  const end = settings?.send_window_end || '20:00';
  return hhmm >= start && hhmm <= end;
}

async function sendReminder(base44, appointment, company, type, baseUrl) {
  const settings = company.whatsapp_settings || {};
  const tplKey = type === 'lembrete_24h' ? 'msg_reminder_24h' : 'msg_reminder_2h';
  const tpl = settings[tplKey] || 'Lembrete: você tem horário às {hora} na {barbearia}.';
  const confirmLink = appointment.confirm_token ? `${baseUrl}/confirma/${appointment.confirm_token}` : '';
  let message = renderTemplate(tpl, {
    nome: appointment.customer_name || 'cliente',
    barbearia: company.name,
    hora: fmtTime(appointment.scheduled_at),
    servico: appointment.service_name || '',
    profissional: appointment.professional_name || '',
    link_confirmacao: confirmLink,
  });
  // Se template não menciona confirmação e há token, adiciona automaticamente
  if (confirmLink && !tpl.includes('{link_confirmacao}') && type === 'lembrete_24h') {
    message += `\n\n✅ Confirme em 1 clique: ${confirmLink}`;
  }

  return base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
    phone: appointment.customer_phone,
    message,
    type,
    company_id: company.id,
    customer_id: appointment.customer_id,
    customer_name: appointment.customer_name,
    appointment_id: appointment.id,
  });
}

Deno.serve(async (req) => {
  console.log('JOB START: jobReminders');
  try {
    const base44 = createClientFromRequest(req);
    const baseUrl = req.headers.get('origin') || `https://${req.headers.get('host') || 'barbertrimly.base44.app'}`;

    const now = new Date();
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const in2_5h = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

    // Buscar appointments futuros nas próximas 26h, ainda não atendidos
    const appointments = await base44.asServiceRole.entities.Appointment.list('-scheduled_at', 1000);
    const upcoming = appointments.filter(a => {
      if (!a.scheduled_at || !a.customer_phone) return false;
      if (['cancelado', 'concluido', 'faltou'].includes(a.status)) return false;
      const d = new Date(a.scheduled_at);
      return d > now && d <= in25h;
    });

    if (upcoming.length === 0) return Response.json({ processed: 0 });

    // Cache de empresas
    const companyIds = [...new Set(upcoming.map(a => a.company_id))];
    const companies = {};
    for (const cid of companyIds) {
      try { companies[cid] = await base44.asServiceRole.entities.Company.get(cid); } catch { /* ignore */ }
    }

    // Logs já enviados (filtramos depois)
    const allLogs = await base44.asServiceRole.entities.WhatsAppMessage.filter({}, '-sent_at', 5000);
    const sentSet = new Set(allLogs
      .filter(l => l.status !== 'erro' && l.appointment_id)
      .map(l => `${l.appointment_id}:${l.type}`));

    let sent24 = 0, sent2 = 0, skipped = 0;

    for (const appt of upcoming) {
      const company = companies[appt.company_id];
      if (!company) continue;
      const s = company.whatsapp_settings || {};
      if (s.enabled === false) { skipped++; continue; }
      if (!withinSendWindow(s)) { skipped++; continue; }

      const apptTime = new Date(appt.scheduled_at);
      const diffH = (apptTime - now) / (1000 * 60 * 60);

      // 24h: dispara quando faltam entre 23h e 25h
      if (s.send_reminder_24h !== false && diffH >= 23 && diffH <= 25) {
        if (!sentSet.has(`${appt.id}:lembrete_24h`)) {
          await sendReminder(base44, appt, company, 'lembrete_24h', baseUrl);
          sent24++;
        }
      }
      // 2h: dispara quando faltam entre 1.5h e 2.5h
      if (s.send_reminder_2h !== false && diffH >= 1.5 && diffH <= 2.5) {
        if (!sentSet.has(`${appt.id}:lembrete_2h`)) {
          await sendReminder(base44, appt, company, 'lembrete_2h', baseUrl);
          sent2++;
        }
      }
    }

    console.log('JOB END: jobReminders', { sent24, sent2, skipped });
    return Response.json({ success: true, processed: upcoming.length, sent_24h: sent24, sent_2h: sent2, skipped });
  } catch (error) {
    console.error('JOB ERROR: jobReminders:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});