// sendOnboardingWelcomeEmail — Email transacional pós-checkout via Resend.
//
// Envia um email premium 100% customizado com a identidade O CORTE.
// O botão CTA leva o usuário direto para /ativar-acesso?email=...&plan=...,
// onde ele escolhe Google, criar senha, ou login existente.
//
// Provedor: Resend (https://resend.com) — domínio verificado contato.ocorte.app.
// API HTTP via fetch nativo do Deno (sem SDK).
//
// Disparado em fire-and-forget por createAsaasSaasCheckout e
// chargeAsaasSaasWithCard após a Company ser criada com sucesso.
//
// Características:
//   • Idempotente: usa Company.onboarding_email_sent_at como flag.
//   • Retry automático: até 3 tentativas (0s, 1s, 3s).
//   • EmailLog: registra cada tentativa para auditoria.
//   • Observabilidade: emite UserEvent onboarding_email_sent | _failed.
//
// Payload: { company_id: string }
// Resposta: { ok, log_id?, sent_at?, skipped?, error?, attempts? }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_API_URL = 'https://api.resend.com/emails';

function isValidEmail(s) {
  if (!s || typeof s !== 'string') return false;
  const v = s.trim().toLowerCase();
  if (v.length < 5 || v.length > 254) return false;
  return EMAIL_FORMAT.test(v);
}

function isValidPlanName(name) {
  return ['Starter', 'Pro', 'Enterprise'].includes(String(name));
}

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

function buildEmailText({ ownerName, planName, accessUrl, email }) {
  const greet = ownerName ? `Olá, ${ownerName.split(' ')[0]}!` : 'Olá!';
  return [
    'O CORTE — Sua barbearia já está pronta',
    '',
    greet,
    '',
    'Seu plano foi ativado com sucesso. Agora falta apenas acessar sua conta',
    'e definir como você quer entrar na plataforma.',
    '',
    `Email de acesso: ${email}`,
    `Plano contratado: O CORTE · ${planName}`,
    `Trial: 7 dias grátis`,
    '',
    `Ativar meu acesso: ${accessUrl}`,
    '',
    'Na próxima tela você poderá:',
    '  • entrar com Google',
    '  • criar sua senha',
    '  • ou acessar uma conta já existente',
    '',
    `Use sempre ${email} para entrar.`,
    'Se você não criou esta conta, ignore este email.',
  ].join('\n');
}

async function attemptSend(base44, { to, company_id, planName, ownerName, accessUrl }) {
  const sdk = base44.asServiceRole;
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'O CORTE <acesso@contato.ocorte.app>';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const html = buildEmailHtml({ ownerName, planName, accessUrl, email: to });
  const text = buildEmailText({ ownerName, planName, accessUrl, email: to });
  const subject = 'Sua barbearia já está pronta — ative seu acesso O CORTE';

  let log = null;
  try {
    log = await sdk.entities.EmailLog.create({
      company_id: company_id || null,
      recipient: to,
      subject,
      type: 'welcome',
      status: 'pending',
      provider: 'resend',
      metadata: { plan_name: planName, source: 'onboarding_welcome', cta_url: accessUrl, owner_name: ownerName },
    });
  } catch (logErr) {
    console.warn('[sendOnboardingWelcomeEmail] EmailLog create failed:', logErr.message);
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg = `Resend ${response.status}: ${responseBody?.message || responseBody?.error || 'unknown'}`;
      if (log) {
        await sdk.entities.EmailLog.update(log.id, {
          status: 'failed',
          error_message: errMsg.slice(0, 500),
          sent_at: new Date().toISOString(),
        }).catch(() => {});
      }
      const err = new Error(errMsg);
      err.log_id = log?.id || null;
      throw err;
    }

    if (log) {
      await sdk.entities.EmailLog.update(log.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          plan_name: planName,
          source: 'onboarding_welcome',
          cta_url: accessUrl,
          owner_name: ownerName,
          resend_id: responseBody?.id,
        },
      }).catch(() => {});
    }
    return { ok: true, log_id: log?.id || null, resend_id: responseBody?.id };
  } catch (sendErr) {
    if (sendErr.log_id !== undefined) throw sendErr;
    const errMsg = (sendErr?.message || String(sendErr)).slice(0, 500);
    if (log) {
      await sdk.entities.EmailLog.update(log.id, {
        status: 'failed',
        error_message: errMsg,
        sent_at: new Date().toISOString(),
      }).catch(() => {});
    }
    const err = new Error(errMsg);
    err.log_id = log?.id || null;
    throw err;
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function recordEvent(base44, type, metadata) {
  try {
    await base44.asServiceRole.entities.UserEvent.create({
      event_type: type,
      company_id: metadata?.company_id || null,
      metadata: metadata || {},
    });
  } catch (err) {
    console.warn('[sendOnboardingWelcomeEmail] UserEvent record failed:', err.message);
  }
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const { company_id } = payload;

    if (!company_id) {
      return Response.json({ ok: false, error: 'company_id_required' }, { status: 400 });
    }

    // 1) Carrega Company (fonte da verdade — tenant isolation)
    const company = await sdk.entities.Company.get(company_id).catch(() => null);
    if (!company) {
      console.warn(`[onboardingEmail ${rid}] company_not_found`, { company_id });
      return Response.json({ ok: false, error: 'company_not_found' }, { status: 404 });
    }

    // 2) Idempotência
    if (company.onboarding_email_sent_at) {
      console.log(`[onboardingEmail ${rid}] already_sent`, { company_id, at: company.onboarding_email_sent_at });
      return Response.json({
        ok: true,
        skipped: true,
        sent_at: company.onboarding_email_sent_at,
      });
    }

    // 3) Valida dados mínimos
    const email = (company.owner_email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      console.warn(`[onboardingEmail ${rid}] invalid_owner_email`, { company_id });
      return Response.json({ ok: false, error: 'invalid_owner_email' }, { status: 400 });
    }
    const planName = isValidPlanName(company.plan_name) ? company.plan_name : 'Starter';
    const planKey = String(planName).toLowerCase();
    const ownerName = company.owner_name || '';
    const appUrl = Deno.env.get('APP_URL') || 'https://ocorte.app';
    const accessUrl = buildAccessUrl(appUrl, email, planKey);

    // 4) Envio + retry (0s, 1s, 3s)
    const delays = [0, 1000, 3000];
    let lastErr = null;
    let logId = null;
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) await sleep(delays[i]);
      try {
        const res = await attemptSend(base44, {
          to: email,
          company_id,
          planName,
          ownerName,
          accessUrl,
        });
        logId = res?.log_id || logId;
        const sentAt = new Date().toISOString();
        await sdk.entities.Company.update(company_id, { onboarding_email_sent_at: sentAt })
          .catch(err => console.error(`[onboardingEmail ${rid}] flag_update_failed`, err.message));
        await recordEvent(base44, 'onboarding_email_sent', { company_id, attempt: i + 1, log_id: logId, provider: 'resend' });
        console.log(`[onboardingEmail ${rid}] sent`, { company_id, attempt: i + 1, resend_id: res?.resend_id });
        return Response.json({ ok: true, log_id: logId, sent_at: sentAt, resend_id: res?.resend_id });
      } catch (err) {
        lastErr = err;
        logId = err?.log_id || logId;
        console.warn(`[onboardingEmail ${rid}] attempt_${i + 1}_failed`, err.message);
      }
    }

    await recordEvent(base44, 'onboarding_email_failed', {
      company_id,
      attempts: delays.length,
      reason: (lastErr?.message || 'unknown').slice(0, 200),
      log_id: logId,
      provider: 'resend',
    });
    console.error(`[onboardingEmail ${rid}] all_attempts_failed`, { company_id, error: lastErr?.message });
    return Response.json({
      ok: false,
      error: 'send_failed',
      attempts: delays.length,
      log_id: logId,
    }, { status: 502 });
  } catch (err) {
    console.error(`[sendOnboardingWelcomeEmail ${rid}] INTERNAL`, err?.message, err?.stack);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
});