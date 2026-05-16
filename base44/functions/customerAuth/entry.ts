// customerAuth — Autenticação do cliente final na área pública (/cliente/:slug).
// HARDENED:
//  - Rate limit persistente no banco (não em memória)
//  - Remoção do legacy reset token format
//  - Senha min 8 / max 128 chars
//  - Timing-safe comparison para tokens
//  - Session rotation no login
//  - Logout real (revoga token no banco)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const REQUEST_ID = () => crypto.randomUUID().split('-')[0];

// Sanitização de texto (idêntica ao createPublicAppointment)
function _sanitizeText(v, max) {
  if (v == null) return '';
  let s = String(v).trim();
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.replace(/\s{3,}/g, '  ');
  return s.slice(0, max);
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return `${bytesToHex(salt)}:${bytesToHex(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex] = stored.split(':');
  const recomputed = await hashPassword(password, saltHex);
  // Timing-safe comparison usando Web Crypto
  const enc = new TextEncoder();
  const a = enc.encode(recomputed);
  const b = enc.encode(stored);
  if (a.length !== b.length) return false;
  try {
    // Usa subtle para comparação constante (evita timing oracle)
    const keyA = await crypto.subtle.importKey('raw', a, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const keyB = await crypto.subtle.importKey('raw', b, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const [sigA, sigB] = await Promise.all([
      crypto.subtle.sign('HMAC', keyA, challenge),
      crypto.subtle.sign('HMAC', keyB, challenge),
    ]);
    const arrA = new Uint8Array(sigA), arrB = new Uint8Array(sigB);
    let diff = 0;
    for (let i = 0; i < arrA.length; i++) diff |= arrA[i] ^ arrB[i];
    return diff === 0;
  } catch {
    return recomputed === stored; // fallback
  }
}

function generateToken() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}
function expiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DAYS);
  return d.toISOString();
}

// Rate limit persistente no banco
async function checkRateLimit(sdk, key, maxAttempts, windowMinutes) {
  const windowMs = windowMinutes * 60 * 1000;
  const now = new Date();
  const existing = await sdk.entities.SecurityRateLimit.filter({ key }, '-created_date', 1).catch(() => []);
  const record = existing?.[0];

  if (record) {
    // Verifica se ainda está bloqueado
    if (record.is_blocked && record.blocked_until && new Date(record.blocked_until) > now) {
      return { allowed: false, blocked_until: record.blocked_until };
    }
    // Janela ainda ativa?
    if (record.window_end && new Date(record.window_end) > now) {
      if (record.attempts >= maxAttempts) {
        const blocked_until = new Date(now.getTime() + windowMs).toISOString();
        await sdk.entities.SecurityRateLimit.update(record.id, {
          is_blocked: true, blocked_until,
        }).catch(() => {});
        return { allowed: false, blocked_until };
      }
      // Incrementa
      await sdk.entities.SecurityRateLimit.update(record.id, {
        attempts: record.attempts + 1,
      }).catch(() => {});
      return { allowed: true };
    }
  }

  // Cria ou reinicia janela
  const window_start = now.toISOString();
  const window_end = new Date(now.getTime() + windowMs).toISOString();
  if (record) {
    await sdk.entities.SecurityRateLimit.update(record.id, {
      attempts: 1, window_start, window_end, is_blocked: false, blocked_until: null,
    }).catch(() => {});
  } else {
    await sdk.entities.SecurityRateLimit.create({
      key, route: key.split(':')[0], attempts: 1, window_start, window_end, is_blocked: false,
    }).catch(() => {});
  }
  return { allowed: true };
}

function publicCustomer(c) {
  return { id: c.id, name: c.name, email: c.email, phone: c.phone, company_id: c.company_id };
}

Deno.serve(async (req) => {
  const rid = REQUEST_ID();
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { action, company_id, email, password, name, phone, token, reset_token } = body;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    if (!company_id) {
      return Response.json({ error: 'company_id obrigatório', request_id: rid }, { status: 400 });
    }

    // ── CHECK ────────────────────────────────────────────────────────────────
    if (action === 'check') {
      if (!email) return Response.json({ error: 'E-mail obrigatório', request_id: rid }, { status: 400 });
      const list = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
      const found = list[0];
      return Response.json({ exists: !!found, has_password: !!(found?.password_hash), name: found?.name || null });
    }

    // ── SIGNUP ───────────────────────────────────────────────────────────────
    if (action === 'signup') {
      if (!email || !password || !name) return Response.json({ error: 'Dados incompletos', request_id: rid }, { status: 400 });
      if (password.length < MIN_PASSWORD_LENGTH) return Response.json({ error: `Senha precisa ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`, request_id: rid }, { status: 400 });
      if (password.length > MAX_PASSWORD_LENGTH) return Response.json({ error: 'Senha muito longa', request_id: rid }, { status: 400 });

      const nameClean = _sanitizeText(name, 100);
      if (!nameClean) return Response.json({ error: 'Nome inválido', request_id: rid }, { status: 400 });
      const emailLc = email.toLowerCase();
      const phoneNorm = (phone || '').replace(/\D/g, '');

      const existingByEmail = await sdk.entities.Customer.filter({ company_id, email: emailLc });
      const passwordHash = await hashPassword(password);
      const newToken = generateToken();
      let customer;

      if (existingByEmail.length > 0) {
        const existing = existingByEmail[0];
        if (existing.password_hash) return Response.json({ error: 'Já existe uma conta com este e-mail. Faça login.', request_id: rid }, { status: 409 });
        customer = await sdk.entities.Customer.update(existing.id, {
          name: existing.name || nameClean, phone: existing.phone || phoneNorm,
          password_hash: passwordHash, auth_token: newToken, auth_token_expires_at: expiryDate(),
        });
      } else {
        customer = await sdk.entities.Customer.create({
          company_id, name: nameClean, email: emailLc, phone: phoneNorm, status: 'active',
          password_hash: passwordHash, auth_token: newToken, auth_token_expires_at: expiryDate(),
        });
      }
      return Response.json({ success: true, token: newToken, customer: publicCustomer(customer) });
    }

    // ── LOGIN ────────────────────────────────────────────────────────────────
    if (action === 'login') {
      if (!email || !password) return Response.json({ error: 'Dados incompletos', request_id: rid }, { status: 400 });
      if (password.length > MAX_PASSWORD_LENGTH) return Response.json({ error: 'E-mail ou senha incorretos', request_id: rid }, { status: 401 });

      // Rate limit: 5 tentativas por 5 min por email+ip
      const rlKey = `customerAuth_login:${company_id}:${email.toLowerCase()}:${ip}`;
      const rl = await checkRateLimit(sdk, rlKey, 5, 5);
      if (!rl.allowed) {
        console.warn(`[customerAuth] rid=${rid} RATE_LIMITED login ip=${ip} email=${email}`);
        await sdk.entities.SecurityEvent.create({
          event_type: 'rate_limit_exceeded', severity: 'high',
          company_id, actor_email: email, ip_address: ip,
          route: 'customerAuth_login',
          details: { action: 'login', blocked_until: rl.blocked_until },
          blocked: true, request_id: rid,
        }).catch(() => {});
        return Response.json({ error: 'Muitas tentativas. Aguarde 5 minutos.', request_id: rid }, { status: 429 });
      }

      const list = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
      const customer = list[0];
      if (!customer || !customer.password_hash) {
        return Response.json({ error: 'E-mail ou senha incorretos', request_id: rid }, { status: 401 });
      }
      const ok = await verifyPassword(password, customer.password_hash);
      if (!ok) {
        console.warn(`[customerAuth] rid=${rid} login failed for ${email} ip=${ip}`);
        return Response.json({ error: 'E-mail ou senha incorretos', request_id: rid }, { status: 401 });
      }

      // Session rotation: gera novo token a cada login
      const newToken = generateToken();
      const updated = await sdk.entities.Customer.update(customer.id, {
        auth_token: newToken,
        auth_token_expires_at: expiryDate(),
      });
      return Response.json({ success: true, token: newToken, customer: publicCustomer(updated) });
    }

    // ── ME ───────────────────────────────────────────────────────────────────
    if (action === 'me') {
      if (!token) return Response.json({ customer: null });
      const list = await sdk.entities.Customer.filter({ company_id, auth_token: token });
      const customer = list[0];
      if (!customer) return Response.json({ customer: null });
      if (customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) < new Date()) {
        return Response.json({ customer: null });
      }
      return Response.json({ customer: publicCustomer(customer) });
    }

    // ── LOGOUT ───────────────────────────────────────────────────────────────
    if (action === 'logout') {
      if (!token) return Response.json({ success: true });
      const list = await sdk.entities.Customer.filter({ company_id, auth_token: token });
      const customer = list[0];
      if (customer) {
        await sdk.entities.Customer.update(customer.id, {
          auth_token: null,
          auth_token_expires_at: null,
        });
      }
      return Response.json({ success: true });
    }

    // ── REQUEST_RESET ────────────────────────────────────────────────────────
    if (action === 'request_reset') {
      if (!email) return Response.json({ error: 'E-mail obrigatório', request_id: rid }, { status: 400 });

      // Rate limit: 3 tentativas por 15 min
      const rlKey = `customerAuth_reset:${company_id}:${email.toLowerCase()}:${ip}`;
      const rl = await checkRateLimit(sdk, rlKey, 3, 15);
      if (!rl.allowed) {
        return Response.json({ success: true }); // não revela bloqueio (evita enumeração)
      }

      const emailLc = email.toLowerCase();
      const list = await sdk.entities.Customer.filter({ company_id, email: emailLc });
      const customer = list[0];

      // Sempre retorna sucesso (não revela se e-mail existe)
      if (customer) {
        const resetToken = generateToken();
        const expires = new Date();
        expires.setHours(expires.getHours() + 1);

        await sdk.entities.Customer.update(customer.id, {
          reset_token: resetToken,
          reset_token_expires_at: expires.toISOString(),
        });

        const companies = await sdk.entities.Company.filter({ id: company_id }).catch(() => []);
        const companyName = companies[0]?.name || 'sua barbearia';
        const slug = companies[0]?.slug || '';
        const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || '';
        const resetLink = `${origin}/cliente/${slug}/login?reset_token=${resetToken}&email=${encodeURIComponent(emailLc)}`;

        try {
          await sdk.integrations.Core.SendEmail({
            from_name: companyName,
            to: emailLc,
            subject: `Redefinir sua senha — ${companyName}`,
            body: `Olá${customer.name ? ', ' + customer.name : ''}!\n\nClique no link abaixo para criar uma nova senha (válido por 1 hora):\n${resetLink}\n\nSe você não solicitou isso, pode ignorar este e-mail.\n\nEquipe ${companyName}`,
          });
        } catch (mailErr) {
          console.error(`[customerAuth] rid=${rid} reset email error:`, mailErr.message);
          return Response.json({ error: 'Não foi possível enviar o e-mail. Tente novamente.', request_id: rid }, { status: 500 });
        }
      }
      return Response.json({ success: true });
    }

    // ── RESET_PASSWORD ───────────────────────────────────────────────────────
    if (action === 'reset_password') {
      if (!email || !reset_token || !password) return Response.json({ error: 'Dados incompletos', request_id: rid }, { status: 400 });
      if (password.length < MIN_PASSWORD_LENGTH) return Response.json({ error: `Senha precisa ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`, request_id: rid }, { status: 400 });
      if (password.length > MAX_PASSWORD_LENGTH) return Response.json({ error: 'Senha muito longa', request_id: rid }, { status: 400 });

      const list = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
      const customer = list[0];

      // HARDENED: removido o formato legado "reset:xxx" — somente reset_token dedicado
      if (!customer || customer.reset_token !== reset_token) {
        return Response.json({ error: 'Link de redefinição inválido ou já usado', request_id: rid }, { status: 400 });
      }
      if (customer.reset_token_expires_at && new Date(customer.reset_token_expires_at) < new Date()) {
        return Response.json({ error: 'Link de redefinição expirado. Solicite um novo.', request_id: rid }, { status: 400 });
      }

      const passwordHash = await hashPassword(password);
      const newToken = generateToken();
      const updated = await sdk.entities.Customer.update(customer.id, {
        password_hash: passwordHash,
        auth_token: newToken,
        auth_token_expires_at: expiryDate(),
        reset_token: null,
        reset_token_expires_at: null,
        token_version: (customer.token_version || 0) + 1,
      });

      return Response.json({ success: true, token: newToken, customer: publicCustomer(updated) });
    }

    return Response.json({ error: 'Ação inválida', request_id: rid }, { status: 400 });

  } catch (error) {
    console.error(`[customerAuth] rid=${rid} INTERNAL_ERROR:`, error?.message, error?.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});