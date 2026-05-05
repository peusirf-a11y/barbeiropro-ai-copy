// Envia e-mail de diagnóstico para o usuário logado (apenas admin ou super_admin).
// Retorna status em tempo real para a UI exibir VERDE/VERMELHO.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const txId = crypto.randomUUID();
    const sentAtIso = new Date().toISOString();
    const sentAtBR = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const subject = `🧪 Teste de envio O CORTE — ${sentAtBR}`;
    const body = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#F8F7F3;color:#0F172A;">
  <div style="background:#fff;border-radius:16px;padding:32px 28px;border:1px solid rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#2563EB 0%,#60A5FA 100%);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="color:#fff;font-size:22px;font-weight:900;letter-spacing:0.06em;">O CORTE 💈</div>
      <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px;">Diagnóstico de envio</div>
    </div>
    <h1 style="font-size:22px;font-weight:900;margin:0 0 12px;">Provedor de e-mail operacional ✅</h1>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Este é um e-mail automático de teste do sistema O CORTE.
    </p>
    <div style="background:#F8F7F3;border-radius:12px;padding:16px;margin:20px 0;font-family:monospace;font-size:13px;color:#334155;">
      <div><strong>ID da transação:</strong> ${txId}</div>
      <div><strong>Disparado em:</strong> ${sentAtBR}</div>
      <div><strong>ISO:</strong> ${sentAtIso}</div>
      <div><strong>Solicitado por:</strong> ${user.email}</div>
      <div><strong>Provedor:</strong> base44_core</div>
    </div>
    <p style="color:#94A3B8;font-size:12px;text-align:center;margin:16px 0 0;">
      Se você recebeu este e-mail, a integração está saudável. Verifique também a pasta de spam.
    </p>
  </div>
</div>`.trim();

    const result = await base44.asServiceRole.functions.invoke('sendAuditedEmail', {
      to: user.email,
      subject,
      body,
      from_name: 'O CORTE Diagnóstico',
      type: 'system_test',
      metadata: { tx_id: txId, requested_by: user.email },
    });

    const data = result?.data || result;
    return Response.json({
      ok: data?.ok === true,
      status: data?.status || 'unknown',
      tx_id: txId,
      log_id: data?.log_id || null,
      recipient: user.email,
      error: data?.error || null,
    });
  } catch (error) {
    console.error('sendDiagnosticEmail error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});