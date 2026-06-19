// requestBarberPasswordReset — Solicita reset de senha (Fase 2 da auth própria).
//
// Fluxo:
//   1. Recebe { email }.
//   2. Busca BarberCredential. Se não existe, retorna resposta NEUTRA
//      (não vazamos se o email está cadastrado).
//   3. Rate limit: cooldown de 60s entre solicitações pro mesmo email.
//   4. Gera token aleatório (32 bytes URL-safe), salva apenas o SHA-256.
//   5. Envia email via Resend com link /resetar-senha?token=...
//   6. Atualiza credencial: reset_token_hash, reset_expires_at (1h), reset_requested_at.
//   7. Loga em EmailLog para auditoria.
//
// Resposta sempre genérica → impede enumeração de emails.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'O CORTE <no-reply@ocorte.app>';
const APP_URL = Deno.env.get('APP_URL') || 'https://ocorte.app';

const COOLDOWN_SECONDS = 60;
const TOKEN_TTL_MINUTES = 60;

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function toBase64Url(buf) {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function emailHtml({ ownerName, resetUrl }) {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#FFFFFF;border-radius:16px;padding:32px;box-shadow:0 4px 16px rgba(15,23,42,0.06);">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;border-radius:14px;background:#2563EB;color:#FFFFFF;font-size:24px;font-weight:900;line-height:56px;text-align:center;">OC</div>
    </div>
    <h1 style="font-size:22px;font-weight:800;color:#0F172A;margin:0 0 12px;text-align:center;">Redefinir sua senha</h1>
    <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 24px;text-align:center;">
      Olá${ownerName ? `, ${ownerName}` : ''}! Você pediu para redefinir a senha do seu painel O CORTE.
      Clique no botão abaixo para criar uma nova senha.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:#2563EB;color:#FFFFFF;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600;">
        Redefinir senha
      </a>
    </div>
    <p style="font-size:13px;color:#94A3B8;line-height:1.6;margin:0;text-align:center;">
      Este link expira em 1 hora. Se você não solicitou esta redefinição, pode ignorar este email com segurança.
    </p>
    <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0 16px;">
    <p style="font-size:11px;color:#94A3B8;text-align:center;margin:0;">
      O CORTE · sistema de gestão para barbearias
    </p>
  </div>
</body></html>`;
}

async function sendResetEmail({ to, ownerName, resetUrl }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject: 'Redefinir senha — O CORTE',
      html: emailHtml({ ownerName, resetUrl }),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`resend_failed: ${res.status} ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    if (!RESEND_API_KEY) {
      console.error(`[requestBarberPasswordReset ${rid}] missing_resend_key`);
      return Response.json({ ok: false, error: 'server_misconfigured' }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const email = String(payload?.email || '').trim().toLowerCase();

    if (!isValidEmail(email)) {
      return Response.json({ ok: false, error: 'invalid_email' }, { status: 400 });
    }

    // 1) Busca credencial. Resposta neutra se não existir.
    const creds = await sdk.entities.BarberCredential.filter({ email }, '-created_date', 1).catch(() => []);
    const credential = creds?.[0];
    if (!credential) {
      console.log(`[requestBarberPasswordReset ${rid}] no_credential_neutral`, { email });
      return Response.json({ ok: true }); // neutro
    }

    // 2) Rate-limit por cooldown.
    if (credential.reset_requested_at) {
      const elapsed = (Date.now() - new Date(credential.reset_requested_at).getTime()) / 1000;
      if (elapsed < COOLDOWN_SECONDS) {
        return Response.json({
          ok: true,
          cooldown: true,
          wait_seconds: Math.ceil(COOLDOWN_SECONDS - elapsed),
        });
      }
    }

    // 3) Gera token cru + hash.
    const rawToken = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
    const requestedAt = new Date().toISOString();

    // 4) Persiste hash do token.
    await sdk.entities.BarberCredential.update(credential.id, {
      reset_token_hash: tokenHash,
      reset_expires_at: expiresAt,
      reset_requested_at: requestedAt,
    });

    // 5) Busca nome do dono pra personalizar o email.
    let ownerName = '';
    if (credential.company_id) {
      const company = await sdk.entities.Company.filter({ id: credential.company_id }, '-created_date', 1).catch(() => []);
      ownerName = company?.[0]?.owner_name?.split(' ')?.[0] || '';
    }

    const resetUrl = `${APP_URL.replace(/\/$/, '')}/resetar-senha?token=${encodeURIComponent(rawToken)}`;

    // 6) Envia email + loga.
    let log = null;
    try {
      log = await sdk.entities.EmailLog.create({
        company_id: credential.company_id || '',
        recipient: email,
        subject: 'Redefinir senha — O CORTE',
        type: 'password_reset',
        status: 'pending',
        provider: 'resend',
        metadata: { source: 'barber_auth_reset', rid },
      });
    } catch { /* não bloqueia */ }

    try {
      await sendResetEmail({ to: email, ownerName, resetUrl });
      if (log) {
        await sdk.entities.EmailLog.update(log.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
        }).catch(() => {});
      }
      console.log(`[requestBarberPasswordReset ${rid}] sent`, { email });
    } catch (sendErr) {
      console.error(`[requestBarberPasswordReset ${rid}] send_failed`, sendErr?.message);
      if (log) {
        await sdk.entities.EmailLog.update(log.id, {
          status: 'failed',
          error_message: sendErr?.message || 'send_failed',
        }).catch(() => {});
      }
      // Mantemos resposta neutra (ok:true) — não vazamos falha de envio.
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[requestBarberPasswordReset ${rid}] INTERNAL`, err?.message, err?.stack);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
});