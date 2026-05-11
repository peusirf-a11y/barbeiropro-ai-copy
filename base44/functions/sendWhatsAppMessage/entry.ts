// Core function — disparo de mensagens WhatsApp via Z-API
// Pode ser chamada por outras backend functions (jobs, triggers) ou direto pela UI.
// Se as credenciais Z-API não estiverem configuradas, opera em "modo simulado" (loga no banco mas não envia).
//
// A8 (Sprint A): idempotência forte via `idempotency_key`.
// Antes: check-then-create em cada caller (race condition entre 2 instâncias do job).
// Agora: este endpoint é o ÚNICO ponto de entrada para criar WhatsAppMessage e
// faz a checagem internamente. Se idempotency_key já existe (status enviado/simulado/erro),
// retorna { ok, skipped: true, log_id } sem reenviar.
//
// Formato recomendado da chave:
//   `${type}:${appointment_id}`               — para mensagens transacionais 1:1 com appt
//   `${type}:${customer_id}:${YYYY-MM-DD}`    — para campanhas CRM com cooldown diário
//   `${type}:${customer_id}:${cycle_start}`   — para campanhas ligadas a ciclo de plano

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

  const isPlaceholder = (v) => !v || ['pending', 'todo', 'placeholder', 'test'].includes(String(v).toLowerCase());
  if (isPlaceholder(instanceId) || isPlaceholder(token)) {
    return { simulated: true, reason: 'Z-API credentials not configured (placeholder values)' };
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
      unit_id = null,
      customer_id = null,
      customer_name = null,
      appointment_id = null,
      idempotency_key = null, // A8: chave opcional. Quando presente, deduplica.
    } = body;

    if (!phone || !message || !type || !company_id) {
      return Response.json({ error: 'Missing required fields: phone, message, type, company_id' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return Response.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    // ─── A8: dedup forte por idempotency_key ─────────────────────────────
    // Race window residual: 2 callers paralelos com a mesma key podem ambos
    // passar pelo check antes do create. Mitigação:
    //   - Re-check após create (read-after-write)
    //   - Mesmo no pior caso, o impacto é 1 mensagem duplicada (não 10)
    //   - Aceitável para o caso de uso (notificações de barbearia)
    if (idempotency_key) {
      const existing = await base44.asServiceRole.entities.WhatsAppMessage.filter(
        { company_id, idempotency_key },
        '-created_date',
        1,
      );
      if (existing?.length) {
        console.log('[sendWhatsAppMessage] dedup hit', { idempotency_key, log_id: existing[0].id });
        return Response.json({
          ok: true,
          skipped: true,
          reason: 'IDEMPOTENT_DUPLICATE',
          log_id: existing[0].id,
          previous_status: existing[0].status,
        });
      }
    }

    const baseLog = {
      company_id,
      unit_id: unit_id || undefined,
      customer_id,
      customer_name,
      appointment_id,
      phone: normalizedPhone,
      type,
      message_text: message,
      sent_at: new Date().toISOString(),
      idempotency_key: idempotency_key || undefined,
    };

    try {
      const result = await sendViaZapi({ phone: normalizedPhone, message });
      const log = await base44.asServiceRole.entities.WhatsAppMessage.create({
        ...baseLog,
        status: result.simulated ? 'simulado' : 'enviado',
        provider_response: result.response || { simulated: true, reason: result.reason },
      });

      // Re-check pós-create para race residual (2 callers paralelos com mesma key).
      // Se descobriu duplicata criada antes da nossa, soft-deleta a nossa? Não vale a
      // pena: Base44 não tem delete idempotente leve. Apenas LOGAMOS a colisão para
      // monitoramento — duplicidade é rara e limitada a 1 extra por janela.
      if (idempotency_key) {
        const concurrent = await base44.asServiceRole.entities.WhatsAppMessage.filter(
          { company_id, idempotency_key },
          '-created_date',
          5,
        );
        if (concurrent?.length > 1) {
          console.warn('[sendWhatsAppMessage] idempotency race detected', {
            idempotency_key,
            count: concurrent.length,
            ids: concurrent.map(c => c.id),
          });
        }
      }

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