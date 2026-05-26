// testResendEmail — Função de diagnóstico admin-only.
//
// Envia um email de boas-vindas O CORTE via Resend IGNORANDO a flag de
// idempotência (onboarding_email_sent_at). Usada para validar a configuração
// do provedor após mudanças de DNS/API key/template.
//
// Payload: { company_id?: string, to?: string }
//   • Se company_id for informado, usa os dados da Company.
//   • Se to for informado, envia para esse email com plano "Pro" fake.
//
// Segurança: só admin pode invocar.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RESEND_API_URL = 'https://api.resend.com/emails';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAccessUrl(appUrl, email, planKey) {
  const base = (appUrl || 'https://ocorte.app').replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (email) params.set('email', email);
  if (planKey) params.set('plan', planKey);
  return `${base}/ativar-acesso?${params.toString()}`;
}

function buildEmailHtml({ ownerName, planName, accessUrl, email }) {
  const greet = ownerName ? `Olá, ${escapeHtml(ownerName.split(' ')[0])}!` : 'Olá!';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sua barbearia já está pronta</title></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;box-shadow:0 4px 24px rgba(15,23,42,0.06);overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;text-align:center;">
          <div style="display:inline-block;font-weight:900;font-size:18px;letter-spacing:-0.02em;color:#0F172A;">O CORTE</div>
        </td></tr>
        <tr><td style="padding:8px 32px 0;text-align:center;">
          <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:#ECFDF5;color:#047857;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">✓ Plano ativado</div>
        </td></tr>
        <tr><td style="padding:16px 32px 8px;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:-0.02em;color:#0F172A;">Sua barbearia já está pronta 🚀</h1>
          <p style="margin:10px 0 0;font-size:14px;color:#64748B;line-height:1.6;">${greet} Seu plano foi ativado com sucesso. Agora falta apenas <strong style="color:#0F172A;">acessar sua conta e definir como você quer entrar na plataforma</strong>.</p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;">
            <tr><td style="padding:14px 16px;">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8;margin-bottom:4px;">Email de acesso</div>
              <div style="font-size:14px;font-weight:700;color:#0F172A;word-break:break-all;">${escapeHtml(email)}</div>
            </td></tr>
            <tr><td style="padding:0 16px 14px;">
              <div style="border-top:1px solid #E2E8F0;padding-top:10px;">
                <table width="100%"><tr>
                  <td style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8;">Plano contratado</td>
                  <td align="right" style="font-size:13px;font-weight:700;color:#0F172A;">O CORTE · ${escapeHtml(planName)}</td>
                </tr></table>
              </div>
              <div style="margin-top:8px;">
                <table width="100%"><tr>
                  <td style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8;">Trial</td>
                  <td align="right" style="font-size:13px;font-weight:700;color:#059669;">7 dias grátis</td>
                </tr></table>
              </div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;text-align:center;">
          <a href="${accessUrl}" style="display:inline-block;background:#0F172A;color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;padding:16px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(15,23,42,0.18);">Ativar meu acesso</a>
        </td></tr>
        <tr><td style="padding:12px 32px 24px;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:#64748B;line-height:1.6;">Na próxima tela você poderá:</p>
          <p style="margin:0;font-size:12px;color:#64748B;line-height:1.8;">• entrar com Google<br>• criar sua senha<br>• ou acessar uma conta já existente</p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <div style="border-top:1px solid #F1F5F9;padding-top:16px;font-size:11px;color:#94A3B8;line-height:1.6;text-align:center;">
            Use sempre <strong style="color:#0F172A;">${escapeHtml(email)}</strong> para entrar.<br>
            Se você não criou esta conta, ignore este email.
          </div>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#94A3B8;">© O CORTE · Plataforma de gestão para barbearias</p>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    let { company_id, to } = payload || {};
    let ownerName = '';
    let planName = 'Pro';
    let email = to;

    if (company_id) {
      const company = await base44.asServiceRole.entities.Company.get(company_id).catch(() => null);
      if (!company) return Response.json({ ok: false, error: 'company_not_found' }, { status: 404 });
      email = (company.owner_email || '').trim().toLowerCase();
      ownerName = company.owner_name || '';
      planName = company.plan_name || 'Pro';
    }

    if (!email) {
      return Response.json({ ok: false, error: 'recipient_required' }, { status: 400 });
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'O CORTE <acesso@contato.ocorte.app>';
    if (!apiKey) return Response.json({ ok: false, error: 'resend_api_key_missing' }, { status: 500 });

    const appUrl = Deno.env.get('APP_URL') || 'https://ocorte.app';
    const accessUrl = buildAccessUrl(appUrl, email, String(planName).toLowerCase());
    const html = buildEmailHtml({ ownerName, planName, accessUrl, email });
    const subject = '[TESTE] Sua barbearia já está pronta — O CORTE';

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
      }),
    });

    const body = await response.json().catch(() => ({}));
    console.log('[testResendEmail] response', { status: response.status, body });

    if (!response.ok) {
      return Response.json({
        ok: false,
        error: 'resend_error',
        status: response.status,
        details: body,
        from: fromEmail,
        to: email,
      }, { status: 502 });
    }

    return Response.json({
      ok: true,
      resend_id: body?.id,
      from: fromEmail,
      to: email,
    });
  } catch (err) {
    console.error('[testResendEmail] internal', err?.message, err?.stack);
    return Response.json({ ok: false, error: 'internal_error', message: err?.message }, { status: 500 });
  }
});