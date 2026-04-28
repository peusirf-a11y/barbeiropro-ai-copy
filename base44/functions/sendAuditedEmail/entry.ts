// Wrapper único de envio de e-mail com auditoria automática.
// Sempre cria um EmailLog (sent ou failed) e devolve o ID do log.
// Uso: invocar via base44.asServiceRole.functions.invoke('sendAuditedEmail', { ... })
//
// Body esperado:
// { to, subject, body, from_name?, type, company_id?, metadata? }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_TYPES = [
  'booking_confirmation',
  'trial_reminder_d1',
  'trial_reminder_d3',
  'system_test',
  'password_reset',
  'welcome',
  'other',
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const payload = await req.json().catch(() => ({}));
  const { to, subject, body, from_name, company_id, metadata } = payload;
  const type = VALID_TYPES.includes(payload.type) ? payload.type : 'other';

  if (!to || !subject || !body) {
    return Response.json({ error: 'Campos obrigatórios: to, subject, body' }, { status: 400 });
  }

  // 1) Cria o log em estado "pending"
  let log = null;
  try {
    log = await base44.asServiceRole.entities.EmailLog.create({
      company_id: company_id || null,
      recipient: to,
      subject,
      type,
      status: 'pending',
      provider: 'base44_core',
      metadata: metadata || {},
    });
  } catch (logErr) {
    console.error('[sendAuditedEmail] Falha ao criar EmailLog inicial:', logErr.message);
  }

  // 2) Tenta enviar
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to,
      subject,
      body,
      from_name: from_name || 'BarberTrimly',
    });

    if (log) {
      await base44.asServiceRole.entities.EmailLog.update(log.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
    }
    return Response.json({ ok: true, log_id: log?.id || null, status: 'sent' });
  } catch (sendErr) {
    const errMsg = sendErr?.message || String(sendErr);
    console.error('[sendAuditedEmail] Falha no envio:', errMsg);
    if (log) {
      await base44.asServiceRole.entities.EmailLog.update(log.id, {
        status: 'failed',
        error_message: errMsg.slice(0, 500),
        sent_at: new Date().toISOString(),
      });
    }
    return Response.json({ ok: false, log_id: log?.id || null, status: 'failed', error: errMsg }, { status: 500 });
  }
});