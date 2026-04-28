import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function formatDateBR(isoString) {
  const date = new Date(isoString);
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return { full: `${dayName}, ${day} de ${month} de ${year}`, time: `${hours}:${minutes}` };
}

function buildEmailHtml({ customerName, companyName, serviceName, professionalName, dateFull, dateTime, price, address, whatsapp, primaryColor }) {
  const color = primaryColor || '#1B3A4B';
  const priceStr = typeof price === 'number' ? `R$ ${price.toFixed(2).replace('.', ',')}` : '';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Agendamento Confirmado</title></head>
<body style="margin:0;padding:0;background:#F8F7F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1B1C1E;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:${color};color:#fff;padding:32px;border-radius:16px 16px 0 0;text-align:center;">
      <div style="font-size:14px;opacity:.8;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Agendamento Confirmado</div>
      <div style="font-size:24px;font-weight:800;">${companyName}</div>
    </div>
    <div style="background:#fff;padding:32px;border:1px solid #00000010;border-top:0;border-radius:0 0 16px 16px;">
      <p style="font-size:16px;margin:0 0 16px;">Olá <strong>${customerName || 'cliente'}</strong>,</p>
      <p style="font-size:14px;color:#555;margin:0 0 24px;line-height:1.6;">Seu horário foi reservado com sucesso. Veja os detalhes abaixo:</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr><td style="padding:10px 0;border-bottom:1px solid #00000010;color:#888;font-size:13px;">Serviço</td><td style="padding:10px 0;border-bottom:1px solid #00000010;text-align:right;font-weight:600;">${serviceName || '-'}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #00000010;color:#888;font-size:13px;">Profissional</td><td style="padding:10px 0;border-bottom:1px solid #00000010;text-align:right;font-weight:600;">${professionalName || '-'}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #00000010;color:#888;font-size:13px;">Data</td><td style="padding:10px 0;border-bottom:1px solid #00000010;text-align:right;font-weight:600;">${dateFull}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #00000010;color:#888;font-size:13px;">Horário</td><td style="padding:10px 0;border-bottom:1px solid #00000010;text-align:right;font-weight:600;">${dateTime}</td></tr>
        ${priceStr ? `<tr><td style="padding:10px 0;color:#888;font-size:13px;">Valor</td><td style="padding:10px 0;text-align:right;font-weight:800;font-size:18px;color:${color};">${priceStr}</td></tr>` : ''}
      </table>

      ${address ? `<div style="background:#F8F7F3;padding:16px;border-radius:12px;margin-bottom:16px;"><div style="font-size:12px;color:#888;margin-bottom:4px;">Endereço</div><div style="font-size:14px;font-weight:600;">${address}</div></div>` : ''}

      ${whatsapp ? `<a href="https://wa.me/55${whatsapp.replace(/\D/g, '')}" style="display:block;background:#25D366;color:#fff;text-align:center;padding:14px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:8px;">Falar pelo WhatsApp</a>` : ''}

      <p style="font-size:12px;color:#888;text-align:center;margin:24px 0 0;line-height:1.5;">Caso precise remarcar ou cancelar, entre em contato com a barbearia.<br>Te esperamos!</p>
    </div>
    <p style="font-size:11px;color:#aaa;text-align:center;margin-top:16px;">Enviado por ${companyName} via BarbeiroPro AI</p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const { appointment_id } = await req.json();
    if (!appointment_id) {
      return Response.json({ error: 'appointment_id é obrigatório' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    const appointment = await base44.asServiceRole.entities.Appointment.get(appointment_id);
    if (!appointment) {
      return Response.json({ error: 'Agendamento não encontrado' }, { status: 404 });
    }

    if (!appointment.customer_email) {
      return Response.json({ skipped: true, reason: 'Cliente não forneceu e-mail' });
    }

    const companies = await base44.asServiceRole.entities.Company.filter({ id: appointment.company_id });
    const company = companies[0];
    if (!company) {
      return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    const { full: dateFull, time: dateTime } = formatDateBR(appointment.scheduled_at);

    const html = buildEmailHtml({
      customerName: appointment.customer_name,
      companyName: company.name,
      serviceName: appointment.service_name,
      professionalName: appointment.professional_name,
      dateFull,
      dateTime,
      price: appointment.price,
      address: company.address,
      whatsapp: company.whatsapp,
      primaryColor: company.primary_color,
    });

    const sendResult = await base44.asServiceRole.functions.invoke('sendAuditedEmail', {
      from_name: company.name,
      to: appointment.customer_email,
      subject: `Agendamento confirmado em ${company.name} - ${dateFull} às ${dateTime}`,
      body: html,
      type: 'booking_confirmation',
      company_id: company.id,
      metadata: { appointment_id, customer_id: appointment.customer_id },
    });

    const sendData = sendResult?.data || sendResult;
    if (sendData?.ok) {
      await base44.asServiceRole.entities.Appointment.update(appointment_id, {
        confirmation_email_sent: true,
      });
    }

    return Response.json({ success: !!sendData?.ok, sent_to: appointment.customer_email, log_id: sendData?.log_id });
  } catch (error) {
    console.error('sendBookingConfirmation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});