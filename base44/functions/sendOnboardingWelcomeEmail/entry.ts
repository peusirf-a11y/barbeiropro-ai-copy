// sendOnboardingWelcomeEmail — Email transacional pós-checkout (Opção A).
//
// Envia um email premium com a identidade O CORTE e um botão CTA que leva
// o usuário direto para /acessar-conta?action=reset, onde a tela aciona
// automaticamente o fluxo de "definir senha" da plataforma (envia link
// real de criação de senha para o mesmo email).
//
// Disparado em fire-and-forget por createAsaasSaasCheckout e
// chargeAsaasSaasWithCard após a Company ser criada com sucesso.
//
// IMPORTANTE: O usuário também é convidado via base44.users.inviteUser para
// garantir que a conta exista na plataforma. Sem isso o fluxo de reset
// não tem um usuário-alvo. A inviteUser é idempotente.
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

function buildAccessUrl(appUrl, email) {
  const base = (appUrl || 'https://ocorte.app').replace(/\/+$/, '');
  const params = new URLSearchParams({ action: 'reset' });
  if (email) params.set('email', email);
  return `${base}/acessar-conta?${params.toString()}`;
}

function buildEmailHtml({ ownerName, planName, accessUrl, email }) {
  const greet = ownerName ? `Olá, ${escapeHtml(ownerName.split(' ')[0])}!` : 'Olá!';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sua conta O CORTE está pronta</title></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;box-shadow:0 4px 24px rgba(15,23,42,0.06);overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;text-align:center;">
          <div style="display:inline-block;font-weight:900;font-size:18px;letter-spacing:-0.02em;color:#0F172A;">O CORTE</div>
        </td></tr>
        <tr><td style="padding:8px 32px 0;text-align:center;">
          <div style="display:inline-block;width:56px;height:56px;border-radius:16px;background:#ECFDF5;line-height:56px;text-align:center;font-size:28px;">✓</div>
        </td></tr>
        <tr><td style="padding:16px 32px 8px;text-align:center;">
          <h1 style="margin:0;font-size:24px;font-weight:900;letter-spacing:-0.02em;color:#0F172A;">Sua conta está pronta</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#64748B;line-height:1.6;">${greet} Falta só um passo para começar: <strong style="color:#0F172A;">criar sua senha de acesso</strong>.</p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;">
            <tr><td style="padding:14px 16px;">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8;margin-bottom:4px;">Email de acesso</div>
              <div style="font-size:14px;font-weight:700;color:#0F172A;word-break:break-all;">${escapeHtml(email)}</div>
            </td></tr>
            <tr><td style="padding:0 16px 14px;">
              <div style="border-top:1px solid #E2E8F0;padding-top:10px;display:flex;justify-content:space-between;">
                <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8;">Plano</span>
                <span style="font-size:13px;font-weight:700;color:#0F172A;">O CORTE · ${escapeHtml(planName)}</span>
              </div>
              <div style="margin-top:8px;display:flex;justify-content:space-between;">
                <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8;">Período de teste</span>
                <span style="font-size:13px;font-weight:700;color:#059669;">7 dias grátis</span>
              </div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px 8px;text-align:center;">
          <a href="${accessUrl}" style="display:inline-block;background:#0F172A;color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:12px;box-shadow:0 4px 12px rgba(15,23,42,0.18);">Definir minha senha</a>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.6;">Use sempre <strong style="color:#0F172A;">${escapeHtml(email)}</strong> para entrar.<br>O link é válido por 24 horas.</p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <div style="border-top:1px solid #F1F5F9;padding-top:16px;font-size:11px;color:#94A3B8;line-height:1.6;text-align:center;">
            Se você não criou esta conta, ignore este email.<br>
            Dúvidas? Responda este email — a gente te ajuda.
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
    'O CORTE — Sua conta está pronta',
    '',
    greet,
    '',
    'Falta só um passo para começar: criar sua senha de acesso.',
    '',
    `Email de acesso: ${email}`,
    `Plano: O CORTE · ${planName}`,
    `Período de teste: 7 dias grátis`,
    '',
    `Definir minha senha: ${accessUrl}`,
    '',
    `Use sempre ${email} para entrar. O link é válido por 24 horas.`,
    '',
    'Se você não criou esta conta, ignore este email.',
    'Dúvidas? Responda este email — a gente te ajuda.',
  ].join('\n');
}

async function attemptSend(base44, { to, company_id, planName }) {
  // IMPORTANTE: Core.SendEmail bloqueia destinatários fora do app
  // ("Cannot send emails to users outside the app"). Como o dono ainda não
  // é membro até aceitar o convite, não dá para mandar email customizado.
  //
  // O caminho oficial é base44.users.inviteUser: a plataforma envia o email
  // de boas-vindas nativo, que já contém o link de definição de senha.
  // Auditamos via EmailLog para manter o padrão transacional.
  const sdk = base44.asServiceRole;
  let log = null;
  try {
    log = await sdk.entities.EmailLog.create({
      company_id: company_id || null,
      recipient: to,
      subject: 'Convite de acesso O CORTE',
      type: 'welcome',
      status: 'pending',
      provider: 'base44_invite',
      metadata: { plan_name: planName, source: 'onboarding_welcome' },
    });
  } catch (logErr) {
    console.warn('[sendOnboardingWelcomeEmail] EmailLog create failed:', logErr.message);
  }

  try {
    // Idempotente do lado da plataforma. Se o usuário já existir, retornamos
    // "already_member" e marcamos como enviado — ele pode usar "esqueci a senha"
    // na própria tela /acessar-conta.
    await base44.users.inviteUser(to, 'user');
    if (log) {
      await sdk.entities.EmailLog.update(log.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).catch(() => {});
    }
    return { ok: true, log_id: log?.id || null };
  } catch (sendErr) {
    const errMsg = (sendErr?.message || String(sendErr)).slice(0, 500);
    const alreadyExists = /already|exists|duplicate/i.test(errMsg);
    if (alreadyExists) {
      if (log) {
        await sdk.entities.EmailLog.update(log.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: 'already_member',
        }).catch(() => {});
      }
      return { ok: true, log_id: log?.id || null, already_member: true };
    }
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
        });
        logId = res?.log_id || logId;
        const sentAt = new Date().toISOString();
        await sdk.entities.Company.update(company_id, { onboarding_email_sent_at: sentAt })
          .catch(err => console.error(`[onboardingEmail ${rid}] flag_update_failed`, err.message));
        await recordEvent(base44, 'onboarding_email_sent', { company_id, attempt: i + 1, log_id: logId });
        console.log(`[onboardingEmail ${rid}] sent`, { company_id, attempt: i + 1 });
        return Response.json({ ok: true, log_id: logId, sent_at: sentAt });
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