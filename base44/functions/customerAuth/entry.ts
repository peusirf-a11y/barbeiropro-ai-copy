// customerAuth — Autenticação de cliente (área pública).
//
// Actions suportadas:
//  check              : email → { exists, has_password, name? }
//  login              : email + password → { customer_id, token, customer }
//  signup             : name, email, phone, password → { customer_id, token, customer }
//  me                 : token → { customer }
//  request_reset      : email → envia link de reset por email
//  reset_password     : email, reset_token, password → { customer_id, token, customer }
//  activate_account   : email, phone, password → { customer_id, token, customer }
//
// Aliases retrocompatíveis:
//  register           → alias de signup
//  request_password_reset → alias de request_reset
//
// Rate limit: 5 tentativas / 5 min (login/signup) + 3 tentativas / 15 min (reset)
// Hash: PBKDF2-SHA256 (crypto.subtle)
// Token: 256-bit hex (64 chars)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { timingSafeEqual } from 'node:crypto';

const HASH_CONFIG = { name: 'PBKDF2', hash: 'SHA-256', iterations: 100000, saltLength: 16 };
const TOKEN_LENGTH = 32; // 256 bits = 32 bytes
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

// ──────────────────────────────────────
// UTILITIES
// ──────────────────────────────────────

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(HASH_CONFIG.saltLength));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, hash: HASH_CONFIG.hash, iterations: HASH_CONFIG.iterations },
    keyMaterial, 256,
  );
  const derivedArray = new Uint8Array(derivedBits);
  const combined = new Uint8Array(salt.length + derivedArray.length);
  combined.set(salt);
  combined.set(derivedArray, salt.length);
  return Array.from(combined).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hashHex) {
  const hashBytes = new Uint8Array(hashHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const salt = hashBytes.slice(0, HASH_CONFIG.saltLength);
  const storedHash = hashBytes.slice(HASH_CONFIG.saltLength);
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, hash: HASH_CONFIG.hash, iterations: HASH_CONFIG.iterations },
    keyMaterial, 256,
  );
  const derivedArray = new Uint8Array(derivedBits);
  // Buffers de tamanhos diferentes causam exceção no timingSafeEqual — retorna false em vez de quebrar
  if (storedHash.length !== derivedArray.length) return false;
  return timingSafeEqual(storedHash, derivedArray);
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeCustomer(c) {
  // Remove campos sensíveis antes de retornar ao cliente
  const { password_hash, auth_token, reset_token, ...safe } = c;
  return safe;
}

async function checkRateLimit(sdk, key, maxAttempts, windowMinutes) {
  const now = new Date();
  const records = await sdk.entities.SecurityRateLimit.filter({ key }, '-created_date', 1).catch(() => []);
  const record = records?.[0];
  const windowEnd = record?.window_end ? new Date(record.window_end) : null;

  if (record?.is_blocked && record?.blocked_until && new Date(record.blocked_until) > now) {
    return { blocked: true, remaining: 0 };
  }
  if (record && windowEnd && windowEnd > now) {
    const attempts = (record.attempts || 0) + 1;
    if (attempts >= maxAttempts) {
      const blockedUntil = new Date(now.getTime() + 10 * 60 * 1000);
      await sdk.entities.SecurityRateLimit.update(record.id, { attempts, is_blocked: true, blocked_until: blockedUntil.toISOString() }).catch(() => {});
      return { blocked: true, remaining: 0 };
    }
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts }).catch(() => {});
    return { blocked: false, remaining: maxAttempts - attempts };
  }

  const windowStart = now.toISOString();
  const windowEnd2 = new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString();
  if (record) {
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: 1, window_start: windowStart, window_end: windowEnd2, is_blocked: false }).catch(() => {});
  } else {
    await sdk.entities.SecurityRateLimit.create({
      key,
      route: 'customerAuth',
      ip: 'unknown',
      identifier: key.split(':')[1] || 'unknown',
      attempts: 1,
      window_start: windowStart,
      window_end: windowEnd2,
      is_blocked: false,
    }).catch(() => {});
  }
  return { blocked: false, remaining: maxAttempts - 1 };
}

// ──────────────────────────────────────
// HANDLERS
// ──────────────────────────────────────

// check: verifica se email existe e tem senha
async function handleCheck(sdk, { company_id, email }) {
  if (!email) throw new Error('email obrigatório');
  const customers = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const customer = customers?.[0];
  if (!customer) {
    return { exists: false, has_password: false };
  }
  return {
    exists: true,
    has_password: !!customer.password_hash,
    name: customer.name || null,
  };
}

// me: valida token e retorna dados do customer
async function handleMe(sdk, { company_id, token }) {
  if (!token) throw new Error('token obrigatório');
  const customers = await sdk.entities.Customer.filter({ company_id, auth_token: token });
  const customer = customers?.[0];
  if (!customer) return { customer: null };
  if (customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) < new Date()) {
    return { customer: null };
  }
  return { customer: safeCustomer(customer) };
}

// login: email + password
async function handleLogin(sdk, { company_id, email, password }) {
  if (!email || !password) throw new Error('email e password obrigatórios');
  const key = `customerAuth:login:${email}:${company_id}`;
  const { blocked } = await checkRateLimit(sdk, key, 5, 5);
  if (blocked) throw new Error('RATE_LIMIT — Muitas tentativas. Tente novamente em 10 minutos.');

  const customers = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const customer = customers?.[0];
  if (!customer || !customer.password_hash) throw new Error('E-mail ou senha incorretos');

  // Detecta hash bcrypt legado (começa com $2b$ ou $2a$) — não suportado pelo novo verificador PBKDF2
  if (customer.password_hash.startsWith('$2b$') || customer.password_hash.startsWith('$2a$')) {
    throw new Error('Sua senha precisa ser redefinida. Use "Esqueceu a senha?" para criar uma nova.');
  }
  const valid = await verifyPassword(password, customer.password_hash);
  if (!valid) throw new Error('E-mail ou senha incorretos');

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await sdk.entities.Customer.update(customer.id, { auth_token: token, auth_token_expires_at: expiresAt });

  console.log('[customerAuth] login sucesso', { customer_id: customer.id });
  return { success: true, customer_id: customer.id, token, customer: safeCustomer({ ...customer, auth_token: token }) };
}

// signup (alias: register): cria novo customer
async function handleSignup(sdk, { company_id, name, email, phone, password }) {
  if (!email || !password || !name || !phone) throw new Error('name, email, phone e password obrigatórios');
  if (password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres');

  const key = `customerAuth:signup:${email}:${company_id}`;
  const { blocked } = await checkRateLimit(sdk, key, 5, 5);
  if (blocked) throw new Error('RATE_LIMIT — Muitas tentativas. Tente novamente em 10 minutos.');

  const existing = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  if (existing?.length > 0) {
    // Se o cliente existe mas não tem senha, oferece ativação
    const c = existing[0];
    if (!c.password_hash) {
      throw new Error('Este e-mail já está cadastrado mas sem senha. Use a opção "Tenho agendamentos antigos".');
    }
    throw new Error('Este e-mail já está cadastrado. Faça login ou recupere sua senha.');
  }

  const passwordHash = await hashPassword(password);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const newCustomer = await sdk.entities.Customer.create({
    company_id,
    name: name.trim(),
    email: email.toLowerCase(),
    phone: String(phone).replace(/\D/g, ''),
    password_hash: passwordHash,
    auth_token: token,
    auth_token_expires_at: expiresAt,
    status: 'active',
  });

  console.log('[customerAuth] signup sucesso', { customer_id: newCustomer.id });
  return { success: true, customer_id: newCustomer.id, token, customer: safeCustomer({ ...newCustomer, auth_token: token }) };
}

// request_reset (alias: request_password_reset): envia link por email
async function handleRequestReset(sdk, { company_id, email }) {
  if (!email) throw new Error('email obrigatório');

  const key = `customerAuth:reset_request:${email}:${company_id}`;
  const { blocked } = await checkRateLimit(sdk, key, 3, 15);
  if (blocked) throw new Error('RATE_LIMIT — Muitas tentativas. Tente novamente em 15 minutos.');

  const customers = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const customer = customers?.[0];

  // Anti-enumeração: sempre retorna sucesso mesmo quando email não existe
  if (!customer) {
    console.log('[customerAuth] reset_request email desconhecido:', email);
    return { success: true, message: 'Se este e-mail estiver cadastrado, um link de redefinição será enviado.' };
  }

  const resetToken = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora
  await sdk.entities.Customer.update(customer.id, { reset_token: resetToken, reset_token_expires_at: expiresAt });

  // Busca empresa para construir a URL e obter o nome
  const companies = await sdk.entities.Company.filter({ id: company_id }).catch(() => []);
  const company = companies?.[0];
  const companySlug = company?.slug || company_id;
  const companyName = company?.name || 'Barbearia';
  const resetUrl = `${Deno.env.get('APP_URL') || 'https://ocorte.com.br'}/cliente/${companySlug}/login?reset_token=${resetToken}&email=${encodeURIComponent(email.toLowerCase())}`;

  // Enviar email de reset via SDK integrations
  try {
    await sdk.integrations.Core.SendEmail({
      to: email.toLowerCase(),
      subject: `Redefinir senha — ${companyName}`,
      body: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px">
          <h2 style="font-size:22px;font-weight:900;color:#1B1C1E;margin-bottom:8px">Redefinir sua senha</h2>
          <p style="color:#6B7280;font-size:14px;margin-bottom:24px">
            Olá, ${customer.name?.split(' ')[0] || 'cliente'}! Recebemos uma solicitação para redefinir a senha da sua conta em <strong>${companyName}</strong>.
          </p>
          <a href="${resetUrl}"
            style="display:inline-block;background:#2563EB;color:#fff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;text-decoration:none;">
            Redefinir senha
          </a>
          <p style="color:#9CA3AF;font-size:12px;margin-top:24px">
            Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail com segurança.
          </p>
          <p style="color:#D1D5DB;font-size:11px;margin-top:8px">
            Ou copie e cole no navegador: ${resetUrl}
          </p>
        </div>
      `,
    });
    console.log('[customerAuth] email de reset enviado', { customer_id: customer.id });
  } catch (emailErr) {
    console.error('[customerAuth] falha ao enviar email de reset:', emailErr.message);
    // Não falha o request — token já foi salvo, admin pode recuperar via support
  }

  return { success: true, message: 'Se este e-mail estiver cadastrado, um link de redefinição será enviado.' };
}

// reset_password: troca senha usando token do email
async function handleResetPassword(sdk, { company_id, email, reset_token, password }) {
  if (!email || !reset_token || !password) throw new Error('email, reset_token e password obrigatórios');
  if (password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres');

  const customers = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const customer = customers?.[0];
  if (!customer) throw new Error('Usuário não encontrado');

  if (!customer.reset_token) throw new Error('Nenhuma solicitação de reset ativa');
  if (new Date(customer.reset_token_expires_at) < new Date()) throw new Error('Link expirou. Solicite um novo.');

  // Comparação segura (constant-time)
  let tokensMatch = false;
  try {
    tokensMatch = timingSafeEqual(Buffer.from(reset_token), Buffer.from(customer.reset_token));
  } catch {
    tokensMatch = false;
  }
  if (!tokensMatch) throw new Error('Token inválido ou já utilizado');

  const passwordHash = await hashPassword(password);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const updated = await sdk.entities.Customer.update(customer.id, {
    password_hash: passwordHash,
    reset_token: null,
    reset_token_expires_at: null,
    auth_token: token,
    auth_token_expires_at: expiresAt,
    token_version: (customer.token_version || 0) + 1,
  });

  console.log('[customerAuth] reset_password sucesso', { customer_id: customer.id });
  return { success: true, customer_id: customer.id, token, customer: safeCustomer({ ...customer, ...updated, auth_token: token }) };
}

// activate_account: clientes legados (sem senha) ativam via email + telefone
async function handleActivateAccount(sdk, { company_id, email, phone, password }) {
  if (!email || !phone || !password) throw new Error('email, phone e password obrigatórios');
  if (password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres');

  const phoneNorm = String(phone).replace(/\D/g, '');
  const emailLower = email.toLowerCase();

  const customers = await sdk.entities.Customer.filter({ company_id, email: emailLower });
  const customer = customers?.find(c => String(c.phone).replace(/\D/g, '') === phoneNorm);

  if (!customer) throw new Error('Nenhum cadastro encontrado com este e-mail e telefone');
  if (customer.password_hash) throw new Error('Esta conta já foi ativada. Faça login normalmente.');

  const passwordHash = await hashPassword(password);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await sdk.entities.Customer.update(customer.id, {
    password_hash: passwordHash,
    auth_token: token,
    auth_token_expires_at: expiresAt,
  });

  console.log('[customerAuth] activate_account sucesso', { customer_id: customer.id });
  return { success: true, customer_id: customer.id, token, customer: safeCustomer({ ...customer, auth_token: token }) };
}

// ──────────────────────────────────────
// MAIN HANDLER
// ──────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, company_id, ...payload } = body;

    if (!action || !company_id) {
      return Response.json({ success: false, error: 'action e company_id obrigatórios' }, { status: 400 });
    }

    // Normaliza aliases retrocompatíveis
    const normalizedAction = action === 'register' ? 'signup'
      : action === 'request_password_reset' ? 'request_reset'
      : action;

    let result;
    switch (normalizedAction) {
      case 'check':
        result = await handleCheck(base44.asServiceRole, { company_id, ...payload });
        break;
      case 'me':
        result = await handleMe(base44.asServiceRole, { company_id, ...payload });
        break;
      case 'login':
        result = await handleLogin(base44.asServiceRole, { company_id, ...payload });
        break;
      case 'signup':
        result = await handleSignup(base44.asServiceRole, { company_id, ...payload });
        break;
      case 'request_reset':
        result = await handleRequestReset(base44.asServiceRole, { company_id, ...payload });
        break;
      case 'reset_password':
        result = await handleResetPassword(base44.asServiceRole, { company_id, ...payload });
        break;
      case 'activate_account':
        result = await handleActivateAccount(base44.asServiceRole, { company_id, ...payload });
        break;
      default:
        return Response.json({ success: false, error: `action desconhecida: ${action}` }, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    console.error('[customerAuth] erro:', error.message);
    return Response.json({
      success: false,
      error: error.message || 'Erro ao processar autenticação',
    }, { status: 400 });
  }
});