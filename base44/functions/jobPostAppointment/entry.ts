// Job: roda a cada 1h. Envia mensagem de pós-atendimento ~2h após "concluido".

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

Deno.serve(async (req) => {
  console.log('JOB START: jobPostAppointment');
  try {
    const base44 = createClientFromRequest(req);
    const baseUrl = req.headers.get('origin') || `https://${req.headers.get('host') || 'barbertrimly.base44.app'}`;

    const now = new Date();
    const concluded = await base44.asServiceRole.entities.Appointment.filter({ status: 'concluido' }, '-completed_at', 1000);

    // Pega completados entre 2h e 4h atrás (janela de tolerância pra cobrir quem rodar 1x/h)
    const candidates = concluded.filter(a => {
      if (!a.completed_at || !a.customer_phone) return false;
      const c = new Date(a.completed_at);
      const diffH = (now - c) / (1000 * 60 * 60);
      return diffH >= 2 && diffH <= 4;
    });

    if (candidates.length === 0) return Response.json({ processed: 0 });

    const companyIds = [...new Set(candidates.map(a => a.company_id))];
    const companies = {};
    for (const cid of companyIds) {
      try { companies[cid] = await base44.asServiceRole.entities.Company.get(cid); } catch { /* ignore */ }
    }

    const allLogs = await base44.asServiceRole.entities.WhatsAppMessage.filter({ type: 'pos_atendimento' }, '-sent_at', 5000);
    const sentSet = new Set(allLogs.filter(l => l.status !== 'erro' && l.appointment_id).map(l => l.appointment_id));

    let sent = 0, skipped = 0;

    for (const appt of candidates) {
      if (sentSet.has(appt.id)) { skipped++; continue; }
      const company = companies[appt.company_id];
      if (!company) continue;
      const s = company.whatsapp_settings || {};
      if (s.enabled === false || s.send_post_appointment === false) { skipped++; continue; }
      if (!withinSendWindow(s)) { skipped++; continue; }

      const tpl = s.msg_post_appointment || 'Valeu por colar na {barbearia}, {nome}! 🔥 Se puder, deixa sua avaliação: {link_avaliacao}';
      // Prioriza nosso link interno (1-clique). Se não houver token, usa review_link configurado.
      const reviewLink = appt.review_token
        ? `${baseUrl}/avaliar/${appt.review_token}`
        : (s.review_link || '');
      const message = renderTemplate(tpl, {
        nome: appt.customer_name || 'cliente',
        barbearia: company.name,
        link_avaliacao: reviewLink,
      });

      await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
        phone: appt.customer_phone,
        message,
        type: 'pos_atendimento',
        company_id: company.id,
        customer_id: appt.customer_id,
        customer_name: appt.customer_name,
        appointment_id: appt.id,
      });
      sent++;
    }

    console.log('JOB END: jobPostAppointment', { sent, skipped });
    return Response.json({ success: true, processed: candidates.length, sent, skipped });
  } catch (error) {
    console.error('JOB ERROR: jobPostAppointment:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});