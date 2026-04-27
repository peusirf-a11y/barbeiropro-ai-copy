// Core function — disparo de mensagens WhatsApp via Z-API
// Pode ser chamada por outras backend functions (jobs, triggers) ou direto pela UI.
// Se as credenciais Z-API não estiverem configuradas, opera em "modo simulado" (loga no banco mas não envia).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Normaliza telefone para formato E.164 sem "+" (esperado pela Z-API). Brasil = 55.
function normalizePhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/\D/g, '');
  if (!p) return null;
  if (p.length <= 11 && !p.startsWith('55')) p = '55' + p;
  return p;
}

async function sendViaZapi({ phone, message }) {
  const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const token = Deno.env.get('ZAPI_TOKEN');
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

  if (!instanceId || !token) {
    return { simulated: true, reason: 'Z-API credentials not configured' };
  }

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
  const headers = { 'Content-Type': 'application/json' };
  if (clientToken) headers['Client-Token'] = clientToken;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, message }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Z-API error ${res.status}`);
  }
  return { simulated: false, response: data };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const {
      phone,
      message,
      type,
      company_id,
      customer_id = null,
      customer_name = null,
      appointment_id = null,
    } = body;

    if (!phone || !message || !type || !company_id) {
      return Response.json({ error: 'Missing required fields: phone, message, type, company_id' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return Response.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const baseLog = {
      company_id,
      customer_id,
      customer_name,
      appointment_id,
      phone: normalizedPhone,
      type,
      message_text: message,
      sent_at: new Date().toISOString(),
    };

    try {
      const result = await sendViaZapi({ phone: normalizedPhone, message });
      const log = await base44.asServiceRole.entities.WhatsAppMessage.create({
        ...baseLog,
        status: result.simulated ? 'simulado' : 'enviado',
        provider_response: result.response || { simulated: true, reason: result.reason },
      });
      return Response.json({ ok: true, simulated: !!result.simulated, log_id: log.id });
    } catch (sendErr) {
      const log = await base44.asServiceRole.entities.WhatsAppMessage.create({
        ...baseLog,
        status: 'erro',
        error_message: sendErr.message,
      });
      return Response.json({ ok: false, error: sendErr.message, log_id: log.id }, { status: 200 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});