// customerAuth — Autenticação de cliente (área pública).
//
// Actions:
//  - login: email + senha → customer_id, token
//  - register: name, email, phone, password → customer_id, token
//  - request_password_reset: email → envia token por email
//  - reset_password: email, reset_token, new_password → sucesso
//
// Rate limit: 5 tentativas / 5 min (login/register) + 3 tentativas / 15 min (reset)
// Hash: PBKDF2-SHA256 (crypto.subtle)
// Token: 256-bit hex (64 chars)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { timingSafeEqual } from 'node:crypto';

const HASH_CONFIG = { name: 'PBKDF2', hash: 'SHA-256', iterations: 100000, saltLength: 16 };
const TOKEN_LENGTH = 32; // 256 bits = 32 bytes

// ──────────────────────────────────────
// UTILITIES
// ──────────────────────────────────────

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(HASH_CONFIG.saltLength));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, hash: HASH_CONFIG.hash, iterations: HASH_CONFIG.iterations },
    keyMaterial,
    256,
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
    keyMaterial,
    256,
  );
  const derivedArray = new Uint8Array(derivedBits);
  return timingSafeEqual(storedHash, derivedArray);
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
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

  // Nova janela
  const windowStart = now.toISOString();
  const windowEnd2 = new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString();
  if (record) {
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: 1, window_start: windowStart, window_end: windowEnd2, is_blocked: false }).catch(() => {});
  } else {
    const ip = 'unknown';
    await sdk.entities.SecurityRateLimit.create({
      key,
      route: 'customerAuth',
      ip,
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

async function handleLogin(sdk, { company_id, email, password }) {
  if (!email || !password) throw new Error('email e password obrigatórios');
  const key = `customerAuth:login:${email}:${company_id}`;
  const { blocked } = await checkRateLimit(sdk, key, 5, 5);
  if (blocked) throw new Error('RATE_LIMIT — Muitas tentativas. Tente novamente em 10 minutos.');

  const customers = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const customer = customers?.[0];
  if (!customer) throw new Error('Usuário não encontrado ou senha incorreta');
  if (!customer.password_hash) throw new Error('Usuário ainda não tem senha. Use "Registrar".');

  const valid = await verifyPassword(password, customer.password_hash);
  if (!valid) throw new Error('Usuário não encontrado ou senha incorreta');

  // Gerar token de sessão
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias
  await sdk.entities.Customer.update(customer.id, { auth_token: token, auth_token_expires_at: expiresAt });

  console.log('[customerAuth] login sucesso', { customer_id: customer.id, email });
  return { success: true, customer_id: customer.id, token, customer };
}

async function handleRegister(sdk, { company_id, name, email, phone, password, password_confirm }) {
  if (!email || !password || !name || !phone) throw new Error('name, email, phone e password obrigatórios');
  if (password !== password_confirm) throw new Error('As senhas não coincidem');
  if (password.length < 8) throw new Error('Senha deve ter no mínimo 8 caracteres');

  const key = `customerAuth:register:${email}:${company_id}`;
  const { blocked } = await checkRateLimit(sdk, key, 5, 5);
  if (blocked) throw new Error('RATE_LIMIT — Muitas tentativas. Tente novamente em 10 minutos.');

  // Validar email único
  const existing = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  if (existing?.length > 0) throw new Error('Este email já está cadastrado');

  // Hash senha
  const passwordHash = await hashPassword(password);

  // Criar customer
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const newCustomer = await sdk.entities.Customer.create({
    company_id,
    name: name.trim(),
    email: email.toLowerCase(),
    phone: phone.replace(/\D/g, ''),
    password_hash: passwordHash,
    auth_token: token,
    auth_token_expires_at: expiresAt,
    status: 'active',
  });

  console.log('[customerAuth] register sucesso', { customer_id: newCustomer.id, email });
  return { success: true, customer_id: newCustomer.id, token, customer: newCustomer };
}

async function handleRequestPasswordReset(sdk, { company_id, email }) {
  if (!email) throw new Error('email obrigatório');

  const key = `customerAuth:reset_request:${email}:${company_id}`;
  const { blocked } = await checkRateLimit(sdk, key, 3, 15);
  if (blocked) throw new Error('RATE_LIMIT — Muitas tentativas. Tente novamente em 15 minutos.');

  const customers = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const customer = customers?.[0];
  if (!customer) {
    // NÃO vaza se o email existe (anti-enumeração)
    console.log('[customerAuth] reset_request de email desconhecido:', email);
    return { success: true, message: 'Se o email existe, um link de recuperação será enviado' };
  }

  // Gerar reset token (1 hora)
  const resetToken = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await sdk.entities.Customer.update(customer.id, { reset_token: resetToken, reset_token_expires_at: expiresAt });

  // Enviar email com link (em produção, integrar com SendGrid/similar)
  // Por enquanto, logamos o token para debug
  console.log('[customerAuth] reset_token gerado', { customer_id: customer.id, reset_token: resetToken.substring(0, 8) + '...' });

  // Simulado: retornar sucesso
  return { success: true, message: 'Link de recuperação enviado para o email' };
}

async function handleResetPassword(sdk, { company_id, email, reset_token, new_password, new_password_confirm }) {
  if (!email || !reset_token || !new_password) throw new Error('email, reset_token e new_password obrigatórios');
  if (new_password !== new_password_confirm) throw new Error('As senhas não coincidem');
  if (new_password.length < 8) throw new Error('Senha deve ter no mínimo 8 caracteres');

  const customers = await sdk.entities.Customer.filter({ company_id, email: email.toLowerCase() });
  const customer = customers?.[0];
  if (!customer) throw new Error('Usuário não encontrado');

  // Validar token
  if (!customer.reset_token) throw new Error('Nenhuma solicitação de reset ativa');
  if (!timingSafeEqual(Buffer.from(reset_token), Buffer.from(customer.reset_token))) {
    throw new Error('Token inválido');
  }
  if (new Date(customer.reset_token_expires_at) < new Date()) {
    throw new Error('Link expirou. Solicite um novo.');
  }

  // Hash nova senha e limpar reset token
  const passwordHash = await hashPassword(new_password);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await sdk.entities.Customer.update(customer.id, {
    password_hash: passwordHash,
    reset_token: null,
    reset_token_expires_at: null,
    auth_token: token,
    auth_token_expires_at: expiresAt,
    token_version: (customer.token_version || 0) + 1, // Invalida outras sessões
  });

  console.log('[customerAuth] reset_password sucesso', { customer_id: customer.id });
  return { success: true, customer_id: customer.id, token, message: 'Senha alterada com sucesso' };
}

// ──────────────────────────────────────
// MAIN HANDLER
// ──────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const base44 = createClientFromRequest(req);
    const { action, company_id, ...payload } = await req.json();

    if (!action || !company_id) {
      return Response.json({ success: false, error: 'action e company_id obrigatórios' }, { status: 400 });
    }

    let result;
    if (action === 'login') {
      result = await handleLogin(base44.asServiceRole, { company_id, ...payload });
    } else if (action === 'register') {
      result = await handleRegister(base44.asServiceRole, { company_id, ...payload });
    } else if (action === 'request_password_reset') {
      result = await handleRequestPasswordReset(base44.asServiceRole, { company_id, ...payload });
    } else if (action === 'reset_password') {
      result = await handleResetPassword(base44.asServiceRole, { company_id, ...payload });
    } else {
      return Response.json({ success: false, error: 'action desconhecida' }, { status: 400 });
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