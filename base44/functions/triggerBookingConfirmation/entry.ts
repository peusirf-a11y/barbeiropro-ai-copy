// Entity automation handler: dispara confirmação quando um Appointment é criado.
// Recebe payload do entity automation (event, data).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function renderTemplate(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    let appointment = payload?.data;
    const appointmentId = payload?.event?.entity_id;

    if ((!appointment || payload?.payload_too_large) && appointmentId) {
      appointment = await base44.asServiceRole.entities.Appointment.get(appointmentId);
    }
    if (!appointment) return Response.json({ skipped: 'no appointment data' });

    if (!appointment.customer_phone) return Response.json({ skipped: 'no phone' });

    const company = await base44.asServiceRole.entities.Company.get(appointment.company_id);
    if (!company) return Response.json({ skipped: 'no company' });

    const settings = company.whatsapp_settings || {};
    if (settings.enabled === false || settings.send_confirmation === false) {
      return Response.json({ skipped: 'confirmation disabled' });
    }

    const tpl = settings.msg_confirmation || 'Olá, {nome}! Seu horário na {barbearia} foi confirmado para {data} às {hora}. Te esperamos! 💈';
    const message = renderTemplate(tpl, {
      nome: appointment.customer_name || 'cliente',
      barbearia: company.name,
      data: fmtDate(appointment.scheduled_at),
      hora: fmtTime(appointment.scheduled_at),
      servico: appointment.service_name || '',
      profissional: appointment.professional_name || '',
    });

    const res = await base44.asServiceRole.functions.invoke('sendWhatsAppMessage', {
      phone: appointment.customer_phone,
      message,
      type: 'confirmacao',
      company_id: company.id,
      customer_id: appointment.customer_id,
      customer_name: appointment.customer_name,
      appointment_id: appointment.id,
      // A8: dedup forte — 1 confirmação por appointment (entity automation
      // pode retriar e a Base44 não garante exactly-once delivery)
      idempotency_key: `confirmacao:${appointment.id}`,
    });

    return Response.json({ ok: true, send_result: res?.data || res });
  } catch (error) {
    console.error('triggerBookingConfirmation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});