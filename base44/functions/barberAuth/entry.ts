// barberAuth — Auth pr\u00f3pria do O CORTE para donos/gestores de barbearia.
//
// Independente do Base44 Auth. Token opaco rotativo. Pepper extra no hash.
// Inspirado em customerAuth, adaptado para owner/manager + ativa\u00e7\u00e3o p\u00f3s-checkout.
//
// Actions:
//   me                : { token }                           \u2192 { account, company }
//   login             : { email, password }                 \u2192 { token, account, company }
//   logout            : { token, all? }                     \u2192 { success } (all=true derruba todas as sess\u00f5es)
//   request_reset     : { email }                           \u2192 { success } (sempre neutro)
//   reset_password    : { token, password }                 \u2192 { token, account, company }
//   activate_account  : { token, password, name? }          \u2192 { token, account, company }
//   create_account    : { company_id, email, name, role }   \u2192 { account_id, activation_token } (server-to-server)
//
// Segurança:
//   - PBKDF2-SHA256 600k iter + pepper (BARBER_AUTH_PEPPER)
//   - Token opaco 32 bytes random
//   - Rate limit por email + IP (reuso de SecurityRateLimit)
//   - Resposta neutra ("E-mail ou senha inv\u00e1lidos") sempre
//   - Expira\u00e7\u00e3o por inatividade (30d owner / 7d manager)
//   - Reset incrementa token_version \u2192 invalida tudo

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { timingSafeEqual } from 'node:crypto';

const HASH_CONFIG = { iterations: 600_000, saltLength: 16, keyLength: 32 };
const TOKEN_BYTES = 32;
const ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000;   // 24h
const RESET_TTL_MS      = 60 * 60 * 1000;        // 1h
const SESSION_TTL_OWNER_MS   = 30 * 24 * 60 * 60 * 1000;
const SESSION_TTL_MANAGER_MS = 7  * 24 * 60 * 60 * 1000;

const RESEND_API_URL = 'https://api.resend.com/emails';
const GENERIC_INVALID_CREDENTIALS = 'Email ou senha inv\u00e1lidos';
const APP_URL = () => (Deno.env.get('APP_URL') || 'https://ocorte.app').replace(/\/+$/, '');

// ─── Crypto helpers ──────────────────────────────────────────────────

function normalizeEmail(s) { return String(s || '').trim().toLowerCase(); }
function bytesToHex(b) { return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(h) { return new Uint8Array(h.match(/.{1,2}/g).map(b => parseInt(b, 16))); }

async function hashPassword(password) {
  const pepper = Deno.env.get('BARBER_AUTH_PEPPER') || '';
  const peppered = new TextEncoder().encode(password + pepper);
  const salt = crypto.getRandomValues(new Uint8Array(HASH_CONFIG.saltLength));
  const key = await crypto.subtle.importKey('raw', peppered, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: HASH_CONFIG.iterations },
    key,
    HASH_CONFIG.keyLength * 8,
  );
  const derived = new Uint8Array(bits);
  const combined = new Uint8Array(salt.length + derived.length);
  combined.set(salt);
  combined.set(derived, salt.length);
  return bytesToHex(combined);
}

async function verifyPassword(password, hashHex) {
  try {
    const pepper = Deno.env.get('BARBER_AUTH_PEPPER') || '';
    const peppered = new TextEncoder().encode(password + pepper);
    const bytes = hexToBytes(hashHex);
    const salt = bytes.slice(0, HASH_CONFIG.saltLength);
    const stored = bytes.slice(HASH_CONFIG.saltLength);
    const key = await crypto.subtle.importKey('raw', peppered, 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: HASH_CONFIG.iterations },
      key,
      HASH_CONFIG.keyLength * 8,
    );
    const derived = new Uint8Array(bits);
    if (stored.length !== derived.length) return false;
    return timingSafeEqual(stored, derived);
  } catch {
    return false;
  }
}

function generateToken() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

function safeAccount(acc) {
  if (!acc) return null;
  const {
    password_hash, session_token, activation_token, reset_token,
    activation_token_expires_at, reset_token_expires_at,
    ...rest
  } = acc;
  return rest;
}

function safeCompany(c) {
  if (!c) return null;
  // Devolve só o que o frontend precisa.
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    logo_url: c.logo_url,
    plan_name: c.plan_name,
    status: c.status,
    onboarding_completed: c.onboarding_completed,
    owner_email: c.owner_email,
  };
}

function sessionTtlMs(role) {
  return role === 'manager' ? SESSION_TTL_MANAGER_MS : SESSION_TTL_OWNER_MS;
}

function nowIso() { return new Date().toISOString(); }
function plusMs(ms) { return new Date(Date.now() + ms).toISOString(); }

// ─── Rate limit (reuso de SecurityRateLimit) ────────────────────────

async function rateLimit(sdk, { key, route, maxAttempts, windowMin, blockMin, ip, identifier }) {
  const now = new Date();
  const records = await sdk.entities.SecurityRateLimit.filter({ key }, '-created_date', 1).catch(() => []);
  const record = records?.[0];

  if (record?.is_blocked && record?.blocked_until && new Date(record.blocked_until) > now) {
    return { blocked: true };
  }
  if (record?.window_end && new Date(record.window_end) > now) {
    const attempts = (record.attempts || 0) + 1;
    if (attempts >= maxAttempts) {
      await sdk.entities.SecurityRateLimit.update(record.id, {
        attempts,
        is_blocked: true,
        blocked_until: plusMs(blockMin * 60 * 1000),
      }).catch(() => {});
      return { blocked: true };
    }
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts }).catch(() => {});
    return { blocked: false, remaining: maxAttempts - attempts };
  }

  const payload = {
    key,
    route,
    ip: ip || 'unknown',
    identifier: identifier || 'unknown',
    attempts: 1,
    window_start: nowIso(),
    window_end: plusMs(windowMin * 60 * 1000),
    is_blocked: false,
  };
  if (record) {
    await sdk.entities.SecurityRateLimit.update(record.id, payload).catch(() => {});
  } else {
    await sdk.entities.SecurityRateLimit.create(payload).catch(() => {});
  }
  return { blocked: false, remaining: maxAttempts - 1 };
}

// ─── Email helpers (Resend) ─────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function sendResendEmail({ to, subject, html, text, type, companyId, sdk }) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') || 'O CORTE <acesso@contato.ocorte.app>';
  if (!apiKey) {
    console.error('[barberAuth] RESEND_API_KEY missing');
    return { ok: false, error: 'email_provider_missing' };
  }

  let log = null;
  try {
    log = await sdk.entities.EmailLog.create({
      company_id: companyId || null,
      recipient: to,
      subject,
      type,
      status: 'pending',
      provider: 'resend',
      metadata: { source: 'barberAuth' },
    });
  } catch { /* log é best-effort */ }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = `Resend ${res.status}: ${body?.message || body?.error || 'unknown'}`;
      if (log) await sdk.entities.EmailLog.update(log.id, { status: 'failed', error_message: msg.slice(0, 500), sent_at: nowIso() }).catch(() => {});
      console.error('[barberAuth] resend failed:', msg);
      return { ok: false, error: 'send_failed' };
    }
    if (log) await sdk.entities.EmailLog.update(log.id, { status: 'sent', sent_at: nowIso() }).catch(() => {});
    return { ok: true, resend_id: body?.id };
  } catch (err) {
    const msg = (err?.message || String(err)).slice(0, 400);
    if (log) await sdk.entities.EmailLog.update(log.id, { status: 'failed', error_message: msg, sent_at: nowIso() }).catch(() => {});
    return { ok: false, error: 'send_failed' };
  }
}

function buildActivationEmail({ name, email, activationUrl, companyName }) {
  const greet = name ? `Ol\u00e1, ${escapeHtml(name.split(' ')[0])}!` : 'Ol\u00e1!';
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Ative seu acesso O CORTE</title></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;color:#0F172A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;box-shadow:0 4px 24px rgba(15,23,42,0.06);overflow:hidden;">
<tr><td style="padding:32px 32px 8px;text-align:center;"><div style="display:inline-block;font-weight:900;font-size:18px;letter-spacing:-0.02em;color:#0F172A;">O CORTE</div></td></tr>
<tr><td style="padding:8px 32px 0;text-align:center;"><div style="display:inline-block;padding:6px 14px;border-radius:999px;background:#EFF6FF;color:#1D4ED8;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Defina sua senha</div></td></tr>
<tr><td style="padding:16px 32px 8px;text-align:center;"><h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:-0.02em;color:#0F172A;">Ative seu acesso \ud83d\udd10</h1>
<p style="margin:10px 0 0;font-size:14px;color:#64748B;line-height:1.6;">${greet} Clique no bot\u00e3o abaixo para criar a sua senha e entrar direto no painel da <strong>${escapeHtml(companyName || 'sua barbearia')}</strong>.</p></td></tr>
<tr><td style="padding:24px 32px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;"><tr><td style="padding:14px 16px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8;margin-bottom:4px;">Email de acesso</div><div style="font-size:14px;font-weight:700;color:#0F172A;word-break:break-all;">${escapeHtml(email)}</div></td></tr></table></td></tr>
<tr><td style="padding:24px 32px 8px;text-align:center;"><a href="${activationUrl}" style="display:inline-block;background:#0F172A;color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;padding:16px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(15,23,42,0.18);">Definir minha senha</a></td></tr>
<tr><td style="padding:12px 32px 24px;text-align:center;"><p style="margin:0;font-size:12px;color:#64748B;line-height:1.6;">Este link expira em 24 horas e s\u00f3 pode ser usado uma vez.</p></td></tr>
<tr><td style="padding:0 32px 32px;"><div style="border-top:1px solid #F1F5F9;padding-top:16px;font-size:11px;color:#94A3B8;line-height:1.6;text-align:center;">Se voc\u00ea n\u00e3o reconhece este email, pode ignor\u00e1-lo com seguran\u00e7a.</div></td></tr>
</table><p style="margin:16px 0 0;font-size:11px;color:#94A3B8;">\u00a9 O CORTE \u00b7 Plataforma de gest\u00e3o para barbearias</p>
</td></tr></table></body></html>`;
  const text = `${greet}\n\nAtive seu acesso ao O CORTE definindo sua senha:\n${activationUrl}\n\nEmail de acesso: ${email}\nO link expira em 24h.\n\nSe voc\u00ea n\u00e3o reconhece este email, ignore-o.`;
  return { html, text };
}

function buildResetEmail({ name, email, resetUrl }) {
  const greet = name ? `Ol\u00e1, ${escapeHtml(name.split(' ')[0])}!` : 'Ol\u00e1!';
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Redefinir senha \u2014 O CORTE</title></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;color:#0F172A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;box-shadow:0 4px 24px rgba(15,23,42,0.06);overflow:hidden;">
<tr><td style="padding:32px 32px 8px;text-align:center;"><div style="display:inline-block;font-weight:900;font-size:18px;letter-spacing:-0.02em;color:#0F172A;">O CORTE</div></td></tr>
<tr><td style="padding:16px 32px 8px;text-align:center;"><h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:-0.02em;color:#0F172A;">Redefinir sua senha</h1>
<p style="margin:10px 0 0;font-size:14px;color:#64748B;line-height:1.6;">${greet} Recebemos uma solicita\u00e7\u00e3o para redefinir a senha da sua conta O CORTE.</p></td></tr>
<tr><td style="padding:24px 32px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;"><tr><td style="padding:14px 16px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8;margin-bottom:4px;">Conta</div><div style="font-size:14px;font-weight:700;color:#0F172A;word-break:break-all;">${escapeHtml(email)}</div></td></tr></table></td></tr>
<tr><td style="padding:24px 32px 8px;text-align:center;"><a href="${resetUrl}" style="display:inline-block;background:#0F172A;color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;padding:16px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(15,23,42,0.18);">Redefinir senha</a></td></tr>
<tr><td style="padding:12px 32px 24px;text-align:center;"><p style="margin:0;font-size:12px;color:#64748B;line-height:1.6;">Este link expira em 1 hora. Ao redefinir, <strong>todas as sess\u00f5es ativas ser\u00e3o encerradas</strong>.</p></td></tr>
<tr><td style="padding:0 32px 32px;"><div style="border-top:1px solid #F1F5F9;padding-top:16px;font-size:11px;color:#94A3B8;line-height:1.6;text-align:center;">Se voc\u00ea n\u00e3o solicitou essa redefini\u00e7\u00e3o, ignore este email com seguran\u00e7a.</div></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${greet}\n\nRedefina sua senha do O CORTE:\n${resetUrl}\n\nO link expira em 1h. Todas as sess\u00f5es ativas ser\u00e3o encerradas.\n\nSe voc\u00ea n\u00e3o solicitou, ignore este email.`;
  return { html, text };
}

// ─── Handlers ────────────────────────────────────────────────────────

async function loadAccountByEmail(sdk, email) {
  const list = await sdk.entities.BarberAccount.filter({ email: normalizeEmail(email) }, '-created_date', 1).catch(() => []);
  return list?.[0] || null;
}

async function loadAccountById(sdk, id) {
  return await sdk.entities.BarberAccount.get(id).catch(() => null);
}

async function loadCompany(sdk, companyId) {
  if (!companyId) return null;
  return await sdk.entities.Company.get(companyId).catch(() => null);
}

// me: valida sess\u00e3o + renova last_activity
async function handleMe(sdk, { token }) {
  if (!token) return { account: null, company: null };
  const found = await sdk.entities.BarberAccount.filter({ session_token: token }, '-created_date', 1).catch(() => []);
  const acc = found?.[0];
  if (!acc || !acc.is_active) return { account: null, company: null };
  if (acc.session_expires_at && new Date(acc.session_expires_at) < new Date()) return { account: null, company: null };

  // Renova last_activity + estende sess\u00e3o
  const ttl = sessionTtlMs(acc.role);
  await sdk.entities.BarberAccount.update(acc.id, {
    last_activity_at: nowIso(),
    session_expires_at: plusMs(ttl),
  }).catch(() => {});

  const company = await loadCompany(sdk, acc.company_id);
  return { account: safeAccount(acc), company: safeCompany(company) };
}

async function handleLogin(sdk, { email, password, ip, userAgent }) {
  if (!email || !password) {
    const e = new Error(GENERIC_INVALID_CREDENTIALS); e.status = 401; throw e;
  }
  const emailLc = normalizeEmail(email);

  // Rate-limit por email
  const rlEmail = await rateLimit(sdk, {
    key: `barberAuth:login:email:${emailLc}`, route: 'barberAuth:login',
    maxAttempts: 5, windowMin: 5, blockMin: 10, ip, identifier: emailLc,
  });
  if (rlEmail.blocked) { const e = new Error('Muitas tentativas. Tente novamente em alguns minutos.'); e.status = 429; throw e; }

  // Rate-limit por IP
  if (ip && ip !== 'unknown') {
    const rlIp = await rateLimit(sdk, {
      key: `barberAuth:login:ip:${ip}`, route: 'barberAuth:login',
      maxAttempts: 15, windowMin: 60, blockMin: 60, ip, identifier: ip,
    });
    if (rlIp.blocked) { const e = new Error('Muitas tentativas deste dispositivo. Tente novamente mais tarde.'); e.status = 429; throw e; }
  }

  const acc = await loadAccountByEmail(sdk, emailLc);
  if (!acc || !acc.is_active || !acc.password_hash) {
    const e = new Error(GENERIC_INVALID_CREDENTIALS); e.status = 401; throw e;
  }
  const ok = await verifyPassword(password, acc.password_hash);
  if (!ok) { const e = new Error(GENERIC_INVALID_CREDENTIALS); e.status = 401; throw e; }

  const sessionToken = generateToken();
  const ttl = sessionTtlMs(acc.role);
  const updated = await sdk.entities.BarberAccount.update(acc.id, {
    session_token: sessionToken,
    session_expires_at: plusMs(ttl),
    last_login_at: nowIso(),
    last_login_ip: ip || '',
    last_user_agent: (userAgent || '').slice(0, 300),
    last_activity_at: nowIso(),
  });
  const company = await loadCompany(sdk, acc.company_id);
  console.log('[barberAuth] login ok', { account_id: acc.id });
  return { token: sessionToken, account: safeAccount({ ...acc, ...updated }), company: safeCompany(company) };
}

async function handleLogout(sdk, { token, all }) {
  if (!token) return { success: true };
  const found = await sdk.entities.BarberAccount.filter({ session_token: token }, '-created_date', 1).catch(() => []);
  const acc = found?.[0];
  if (!acc) return { success: true };
  const patch = { session_token: null, session_expires_at: null };
  if (all) patch.token_version = (acc.token_version || 0) + 1;
  await sdk.entities.BarberAccount.update(acc.id, patch).catch(() => {});
  return { success: true };
}

async function handleRequestReset(sdk, { email, ip }) {
  if (!email) return { success: true }; // neutro
  const emailLc = normalizeEmail(email);

  // Rate-limit por email + IP (3 tentativas / 15min)
  const rl = await rateLimit(sdk, {
    key: `barberAuth:reset:email:${emailLc}`, route: 'barberAuth:request_reset',
    maxAttempts: 3, windowMin: 15, blockMin: 30, ip, identifier: emailLc,
  });
  if (rl.blocked) {
    // Mantemos resposta neutra para n\u00e3o vazar exist\u00eancia de conta.
    return { success: true };
  }

  const acc = await loadAccountByEmail(sdk, emailLc);
  if (!acc || !acc.is_active) return { success: true };

  const resetToken = generateToken();
  await sdk.entities.BarberAccount.update(acc.id, {
    reset_token: resetToken,
    reset_token_expires_at: plusMs(RESET_TTL_MS),
  }).catch(() => {});

  const resetUrl = `${APP_URL()}/redefinir-senha?token=${resetToken}`;
  const { html, text } = buildResetEmail({ name: acc.name, email: emailLc, resetUrl });
  await sendResendEmail({
    to: emailLc, subject: 'Redefinir senha \u2014 O CORTE',
    html, text, type: 'password_reset', companyId: acc.company_id, sdk,
  });
  return { success: true };
}

async function handleResetPassword(sdk, { token, password, ip, userAgent }) {
  if (!token || !password) { const e = new Error('Dados inv\u00e1lidos'); e.status = 400; throw e; }
  if (password.length < 8) { const e = new Error('A senha precisa ter ao menos 8 caracteres.'); e.status = 400; throw e; }

  const found = await sdk.entities.BarberAccount.filter({ reset_token: token }, '-created_date', 1).catch(() => []);
  const acc = found?.[0];
  if (!acc || !acc.is_active) { const e = new Error('Token inv\u00e1lido ou expirado.'); e.status = 400; throw e; }
  if (!acc.reset_token_expires_at || new Date(acc.reset_token_expires_at) < new Date()) {
    const e = new Error('Token inv\u00e1lido ou expirado.'); e.status = 400; throw e;
  }

  const passwordHash = await hashPassword(password);
  const sessionToken = generateToken();
  const ttl = sessionTtlMs(acc.role);
  const updated = await sdk.entities.BarberAccount.update(acc.id, {
    password_hash: passwordHash,
    reset_token: null,
    reset_token_expires_at: null,
    session_token: sessionToken,
    session_expires_at: plusMs(ttl),
    token_version: (acc.token_version || 0) + 1, // derruba todas as sess\u00f5es antigas
    last_login_at: nowIso(),
    last_login_ip: ip || '',
    last_user_agent: (userAgent || '').slice(0, 300),
    last_activity_at: nowIso(),
    password_changed_at: nowIso(),
  });
  const company = await loadCompany(sdk, acc.company_id);
  console.log('[barberAuth] reset_password ok', { account_id: acc.id });
  return { token: sessionToken, account: safeAccount({ ...acc, ...updated }), company: safeCompany(company) };
}

async function handleActivateAccount(sdk, { token, password, name, ip, userAgent }) {
  if (!token || !password) { const e = new Error('Dados inv\u00e1lidos'); e.status = 400; throw e; }
  if (password.length < 8) { const e = new Error('A senha precisa ter ao menos 8 caracteres.'); e.status = 400; throw e; }

  const found = await sdk.entities.BarberAccount.filter({ activation_token: token }, '-created_date', 1).catch(() => []);
  const acc = found?.[0];
  if (!acc || !acc.is_active) { const e = new Error('Link inv\u00e1lido ou j\u00e1 utilizado.'); e.status = 400; throw e; }
  if (!acc.activation_token_expires_at || new Date(acc.activation_token_expires_at) < new Date()) {
    const e = new Error('Este link expirou. Solicite um novo na tela de login.'); e.status = 400; throw e;
  }

  const passwordHash = await hashPassword(password);
  const sessionToken = generateToken();
  const ttl = sessionTtlMs(acc.role);
  const patch = {
    password_hash: passwordHash,
    activation_token: null,
    activation_token_expires_at: null,
    email_verified: true,
    session_token: sessionToken,
    session_expires_at: plusMs(ttl),
    last_login_at: nowIso(),
    last_login_ip: ip || '',
    last_user_agent: (userAgent || '').slice(0, 300),
    last_activity_at: nowIso(),
    password_changed_at: nowIso(),
  };
  if (name && !acc.name) patch.name = name.trim();

  const updated = await sdk.entities.BarberAccount.update(acc.id, patch);
  const company = await loadCompany(sdk, acc.company_id);
  console.log('[barberAuth] activate ok', { account_id: acc.id });
  return { token: sessionToken, account: safeAccount({ ...acc, ...updated }), company: safeCompany(company) };
}

// create_account: chamado server-to-server pelo checkout
async function handleCreateAccount(sdk, { company_id, email, name, role }) {
  if (!company_id || !email || !name) { const e = new Error('Dados incompletos'); e.status = 400; throw e; }
  const emailLc = normalizeEmail(email);
  const company = await loadCompany(sdk, company_id);
  if (!company) { const e = new Error('Empresa n\u00e3o encontrada'); e.status = 404; throw e; }

  // Idempot\u00eancia: se j\u00e1 existe BarberAccount com esse email, devolve sem recriar.
  const existing = await loadAccountByEmail(sdk, emailLc);
  if (existing) {
    // Se ainda n\u00e3o ativou (sem password_hash) e o token expirou, regenera o token.
    if (!existing.password_hash) {
      const activationToken = generateToken();
      await sdk.entities.BarberAccount.update(existing.id, {
        activation_token: activationToken,
        activation_token_expires_at: plusMs(ACTIVATION_TTL_MS),
      }).catch(() => {});
      const activationUrl = `${APP_URL()}/ativar-acesso?token=${activationToken}`;
      const { html, text } = buildActivationEmail({ name: existing.name || name, email: emailLc, activationUrl, companyName: company.name });
      await sendResendEmail({ to: emailLc, subject: 'Ative seu acesso ao O CORTE \ud83d\udd10', html, text, type: 'welcome', companyId: company.id, sdk });
      return { account_id: existing.id, resent: true };
    }
    return { account_id: existing.id, already_active: true };
  }

  const activationToken = generateToken();
  const created = await sdk.entities.BarberAccount.create({
    company_id,
    email: emailLc,
    name: name.trim(),
    role: role === 'manager' ? 'manager' : 'owner',
    is_active: true,
    email_verified: false,
    activation_token: activationToken,
    activation_token_expires_at: plusMs(ACTIVATION_TTL_MS),
    token_version: 0,
  });

  const activationUrl = `${APP_URL()}/ativar-acesso?token=${activationToken}`;
  const { html, text } = buildActivationEmail({ name, email: emailLc, activationUrl, companyName: company.name });
  await sendResendEmail({ to: emailLc, subject: 'Ative seu acesso ao O CORTE \ud83d\udd10', html, text, type: 'welcome', companyId: company.id, sdk });

  console.log('[barberAuth] create_account ok', { account_id: created.id, company_id });
  return { account_id: created.id, created: true };
}

// ─── Main ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const body = await req.json().catch(() => ({}));
    const { action, ...payload } = body || {};

    if (!action) return Response.json({ success: false, error: 'action obrigat\u00f3ria' }, { status: 400 });

    let result;
    switch (action) {
      case 'me':                result = await handleMe(sdk, payload); break;
      case 'login':             result = await handleLogin(sdk, { ...payload, ip, userAgent }); break;
      case 'logout':            result = await handleLogout(sdk, payload); break;
      case 'request_reset':     result = await handleRequestReset(sdk, { ...payload, ip }); break;
      case 'reset_password':    result = await handleResetPassword(sdk, { ...payload, ip, userAgent }); break;
      case 'activate_account':  result = await handleActivateAccount(sdk, { ...payload, ip, userAgent }); break;
      case 'create_account':    result = await handleCreateAccount(sdk, payload); break;
      default:
        return Response.json({ success: false, error: `action desconhecida: ${action}` }, { status: 400 });
    }
    return Response.json({ success: true, ...result });
  } catch (err) {
    const status = err?.status || 500;
    if (status >= 500) console.error(`[barberAuth ${rid}] INTERNAL`, err?.message, err?.stack);
    return Response.json({ success: false, error: err?.message || 'erro' }, { status });
  }
});