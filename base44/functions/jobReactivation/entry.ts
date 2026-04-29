// Job: roda 1x/dia. Detecta clientes inativos (último atendimento > X dias) e envia mensagem de reativação.
// Não duplica: se já existe WhatsAppMessage tipo "reativacao" para o cliente nos últimos N dias, pula.

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
  console.log('JOB START: jobReactivation');
  try {
    const base44 = createClientFromRequest(req);

    const companies = await base44.asServiceRole.entities.Company.list('-created_date', 1000);
    const now = new Date();

    let totalSent = 0, totalSkipped = 0, totalCandidates = 0;
    const perCompany = [];

    for (const company of companies) {
      if (company.status !== 'active') continue;
      const s = company.whatsapp_settings || {};
      if (s.enabled === false || s.send_reactivation === false) continue;
      if (!withinSendWindow(s)) continue;

      const days = Number(s.reactivation_days) || 30;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const customers = await base44.asServiceRole.entities.Customer.filter({ company_id: company.id }, '-last_appointment_at', 5000);
      const inactive = customers.filter(c => {
        if (!c.phone || !c.last_appointment_at) return false;
        if (c.status === 'inactive') return false;
        return new Date(c.last_appointment_at) < cutoff;
      });

      // Mensagens de reativação já enviadas pra essa empresa nos últimos 'days' dias
      const recentLogs = await base44.asServiceRole.entities.WhatsAppMessage.filter(
        { company_id: company.id, type: 'reativacao' }, '-sent_at', 2000
      );
      const recentCutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const alreadySent = new Set(
        recentLogs
          .filter(l => l.status !== 'erro' && l.customer_id && new Date(l.sent_at) > recentCutoff)
          .map(l => l.customer_id)
      );

      let sent = 0;
      for (const c of inactive) {
        if (alreadySent.has(c.id)) { totalSkipped++; continue; }

        // Sugere um horário ideal (encaixe inteligente). Falha silenciosa: se
        // não houver sugestão, segue com a mensagem padrão sem horário.
        let suggestion = null;
        try {
          const res = await base44.asServiceRole.functions.invoke('suggestReactivationSlot', {
            company_id: company.id,
            customer_id: c.id,
            days_ahead: 7,
          });
          suggestion = res?.data?.suggestion || null;
        } catch (e) {
          console.warn('[jobReactivation] suggestReactivationSlot failed:', e.message);
        }

        // Template: aceita {horario_sugerido} opcional. Se não houver sugestão,
        // remove a frase entre [[ ]] (placeholder de bloco condicional).
        const tplBase = s.msg_reactivation || 'Fala, {nome}! Sumiu hein 👀 Já tá na hora de dar aquele trato![[ Tenho um horário {horario_sugerido}, encaixa pra você?]]';
        const conditional = /\[\[(.*?)\]\]/gs;
        const tpl = suggestion
          ? tplBase.replace(conditional, '$1')
          : tplBase.replace(conditional, '');

        const message = renderTemplate(tpl, {
          nome: c.name || 'cliente',
          barbearia: company.name,
          horario_sugerido: suggestion?.label || '',
          profissional_sugerido: suggestion?.professional_name || '',
        });

        await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
          phone: c.phone,
          message,
          type: 'reativacao',
          company_id: company.id,
          customer_id: c.id,
          customer_name: c.name,
        });
        sent++;
        totalSent++;
      }

      totalCandidates += inactive.length;
      perCompany.push({ company: company.name, candidates: inactive.length, sent });
    }

    console.log('JOB END: jobReactivation', { totalSent, totalSkipped, totalCandidates });
    return Response.json({ success: true, total_candidates: totalCandidates, total_sent: totalSent, total_skipped: totalSkipped, per_company: perCompany });
  } catch (error) {
    console.error('JOB ERROR: jobReactivation:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});