// requestPasswordSetup — Endpoint público chamado pela tela /ativar-acesso.
//
// Objetivo: enviar ao usuário pós-checkout um email com link para criar conta
// e definir senha. Como o usuário ainda não existe como User no Base44 (apenas
// como Company), o caminho oficial `inviteUser`/`resetPasswordRequest` da
// plataforma não funciona (exige caller autenticado ou User pré-existente).
//
// Estratégia: enviamos via Resend (mesmo provedor do email de boas-vindas)
// um email com link para /acesso-rapido?email=...&plan=... — que é a tela
// pública do Base44 onde, ao informar o email, a plataforma cria o User
// automaticamente e permite definir senha.
//
// Fluxo:
//   1) Verifica se existe Company com owner_email == email.
//   2) Aplica cooldown de 60s por email (rate-limit).
//   3) Envia email Resend com CTA "Criar minha senha".
//   4) Registra EmailLog para auditoria.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const COOLDOWN_SECONDS = 60;
const RESEND_API_URL = 'https://api.resend.com/emails';

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildLoginUrl(appUrl, email) {
  const base = (appUrl || 'https://ocorte.app').replace(/\/+$/, '');
  // Rota oficial Base44 para CRIAR CONTA com email + senha (apps públicos).
  // Após cadastro + verificação OTP, o usuário cai em /app/dashboard.
  // `from_url` faz Base44 redirecionar de volta após registro.
  return `${base}/Register?email=${encodeURIComponent(email)}&from_url=${encodeURIComponent('/app/dashboard')}`;
}

function buildEmailHtml({ ownerName, email, loginUrl }) {
  const greet = ownerName ? `Olá, ${escapeHtml(ownerName.split(' ')[0])}!` : 'Olá!';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crie sua senha — O CORTE</title></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;box-shadow:0 4px 24px rgba(15,23,42,0.06);overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;text-align:center;">
          <div style="display:inline-block;font-weight:900;font-size:18px;letter-spacing:-0.02em;color:#0F172A;">O CORTE</div>
        </td></tr>
        <tr><td style="padding:16px 32px 8px;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:-0.02em;color:#0F172A;">Crie sua senha de acesso 🔐</h1>
          <p style="margin:10px 0 0;font-size:14px;color:#64748B;line-height:1.6;">${greet} Clique no botão abaixo para abrir a página de acesso O CORTE. Lá você define sua senha e entra direto no painel da sua barbearia.</p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;">
            <tr><td style="padding:14px 16px;">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8;margin-bottom:4px;">Email de acesso</div>
              <div style="font-size:14px;font-weight:700;color:#0F172A;word-break:break-all;">${escapeHtml(email)}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;text-align:center;">
          <a href="${loginUrl}" style="display:inline-block;background:#0F172A;color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;padding:16px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(15,23,42,0.18);">Criar minha senha</a>
        </td></tr>
        <tr><td style="padding:12px 32px 24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#64748B;line-height:1.6;">Na próxima tela, basta usar <strong style="color:#0F172A;">${escapeHtml(email)}</strong> e criar sua senha de acesso.</p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <div style="border-top:1px solid #F1F5F9;padding-top:16px;font-size:11px;color:#94A3B8;line-height:1.6;text-align:center;">
            Se você não solicitou este email, ignore-o com segurança.
          </div>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#94A3B8;">© O CORTE · Plataforma de gestão para barbearias</p>
    </td></tr>
  </table>
</body></html>`;
}

function buildEmailText({ ownerName, email, loginUrl }) {
  const greet = ownerName ? `Olá, ${ownerName.split(' ')[0]}!` : 'Olá!';
  return [
    'O CORTE — Crie sua senha de acesso',
    '',
    greet,
    '',
    'Clique no link abaixo para definir sua senha e entrar no painel:',
    loginUrl,
    '',
    `Email de acesso: ${email}`,
    '',
    'Se você não solicitou este email, ignore-o.',
  ].join('\n');
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const email = String(payload?.email || '').trim().toLowerCase();

    if (!isValidEmail(email)) {
      return Response.json({ ok: false, error: 'invalid_email' }, { status: 400 });
    }

    // 1) Confirma que existe Company com esse owner_email.
    const companies = await sdk.entities.Company.filter({ owner_email: email }, '-created_date', 1).catch(() => []);
    if (!companies?.length) {
      console.warn(`[requestPasswordSetup ${rid}] no_company_for_email`, { email });
      // Resposta neutra (não vazamos se o email existe).
      return Response.json({ ok: true, dispatched: false });
    }
    const company = companies[0];

    // 2) Rate-limit por email (cooldown de 60s entre envios).
    const recent = await sdk.entities.EmailLog.filter(
      { recipient: email, type: 'password_reset' },
      '-created_date',
      1
    ).catch(() => []);
    if (recent?.length) {
      const lastAt = new Date(recent[0].created_date || recent[0].sent_at || 0).getTime();
      const elapsed = (Date.now() - lastAt) / 1000;
      if (elapsed < COOLDOWN_SECONDS) {
        console.log(`[requestPasswordSetup ${rid}] cooldown_active`, { email, elapsed });
        return Response.json({
          ok: true,
          dispatched: true,
          cooldown: true,
          wait_seconds: Math.ceil(COOLDOWN_SECONDS - elapsed),
        });
      }
    }

    // 3) Valida configuração Resend.
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'O CORTE <acesso@contato.ocorte.app>';
    if (!apiKey) {
      console.error(`[requestPasswordSetup ${rid}] resend_api_key_missing`);
      return Response.json({ ok: false, error: 'email_provider_not_configured' }, { status: 500 });
    }

    // 4) Cria log pendente.
    let log = null;
    try {
      log = await sdk.entities.EmailLog.create({
        company_id: company.id,
        recipient: email,
        subject: 'Crie sua senha — O CORTE',
        type: 'password_reset',
        status: 'pending',
        provider: 'resend',
        metadata: { source: 'acessar_conta', rid },
      });
    } catch (logErr) {
      console.warn(`[requestPasswordSetup ${rid}] log_create_failed`, logErr.message);
    }

    // 5) Envia email via Resend.
    const appUrl = Deno.env.get('APP_URL') || 'https://ocorte.app';
    const loginUrl = buildLoginUrl(appUrl, email);
    const html = buildEmailHtml({ ownerName: company.owner_name, email, loginUrl });
    const text = buildEmailText({ ownerName: company.owner_name, email, loginUrl });
    const subject = 'Crie sua senha de acesso — O CORTE';

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject,
          html,
          text,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errMsg = `Resend ${response.status}: ${body?.message || body?.error || 'unknown'}`;
        console.error(`[requestPasswordSetup ${rid}] resend_failed`, errMsg);
        if (log) {
          await sdk.entities.EmailLog.update(log.id, {
            status: 'failed',
            error_message: errMsg.slice(0, 500),
            sent_at: new Date().toISOString(),
          }).catch(() => {});
        }
        return Response.json({ ok: false, error: 'send_failed' }, { status: 502 });
      }

      if (log) {
        await sdk.entities.EmailLog.update(log.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          metadata: { ...(log.metadata || {}), resend_id: body?.id },
        }).catch(() => {});
      }
      console.log(`[requestPasswordSetup ${rid}] sent`, { email, resend_id: body?.id });
      return Response.json({ ok: true, dispatched: true, resend_id: body?.id });
    } catch (sendErr) {
      const errMsg = (sendErr?.message || String(sendErr)).slice(0, 400);
      console.error(`[requestPasswordSetup ${rid}] send_exception`, errMsg);
      if (log) {
        await sdk.entities.EmailLog.update(log.id, {
          status: 'failed',
          error_message: errMsg,
          sent_at: new Date().toISOString(),
        }).catch(() => {});
      }
      return Response.json({ ok: false, error: 'send_failed' }, { status: 502 });
    }
  } catch (err) {
    console.error(`[requestPasswordSetup ${rid}] INTERNAL`, err?.message, err?.stack);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
});