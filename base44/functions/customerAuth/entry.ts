// Autenticação do cliente final na área pública (/cliente/:slug).
// Endpoint sem autenticação Base44 — usa asServiceRole + token próprio salvo
// em Customer.auth_token. Suporta 4 ações: check, signup, login, me.
//
// Hash de senha: PBKDF2-SHA256 (Web Crypto, nativo no Deno).
// Token de sessão: 32 bytes aleatórios em hex, validade de 30 dias.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;

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
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hash = bytesToHex(new Uint8Array(bits));
  return `${bytesToHex(salt)}:${hash}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex] = stored.split(':');
  const recomputed = await hashPassword(password, saltHex);
  return recomputed === stored;
}

function generateToken() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

function expiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DAYS);
  return d.toISOString();
}

function publicCustomer(c) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    company_id: c.company_id,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, company_id, email, password, name, phone, token } = body;

    if (!company_id) {
      return Response.json({ error: 'company_id obrigatório' }, { status: 400 });
    }

    // ─── ACTION: CHECK — verifica se e-mail já tem cadastro ─────────────────
    if (action === 'check') {
      if (!email) return Response.json({ error: 'E-mail obrigatório' }, { status: 400 });
      const list = await base44.asServiceRole.entities.Customer.filter({
        company_id, email: email.toLowerCase(),
      });
      const found = list[0];
      return Response.json({
        exists: !!found,
        has_password: !!(found && found.password_hash),
        name: found?.name || null,
      });
    }

    // ─── ACTION: SIGNUP — cria conta ou adiciona senha em cliente existente ─
    if (action === 'signup') {
      if (!email || !password || !name) {
        return Response.json({ error: 'Dados incompletos' }, { status: 400 });
      }
      if (password.length < 6) {
        return Response.json({ error: 'Senha precisa ter no mínimo 6 caracteres' }, { status: 400 });
      }
      const emailLc = email.toLowerCase();
      const phoneNorm = (phone || '').replace(/\D/g, '');

      const existingByEmail = await base44.asServiceRole.entities.Customer.filter({
        company_id, email: emailLc,
      });
      const passwordHash = await hashPassword(password);
      const newToken = generateToken();
      let customer;

      if (existingByEmail.length > 0) {
        const existing = existingByEmail[0];
        if (existing.password_hash) {
          return Response.json({ error: 'Já existe uma conta com este e-mail. Faça login.' }, { status: 409 });
        }
        customer = await base44.asServiceRole.entities.Customer.update(existing.id, {
          name: existing.name || name,
          phone: existing.phone || phoneNorm,
          password_hash: passwordHash,
          auth_token: newToken,
          auth_token_expires_at: expiryDate(),
        });
      } else {
        customer = await base44.asServiceRole.entities.Customer.create({
          company_id,
          name,
          email: emailLc,
          phone: phoneNorm,
          status: 'active',
          password_hash: passwordHash,
          auth_token: newToken,
          auth_token_expires_at: expiryDate(),
        });
      }

      return Response.json({
        success: true,
        token: newToken,
        customer: publicCustomer(customer),
      });
    }

    // ─── ACTION: LOGIN — valida senha, gera novo token ──────────────────────
    if (action === 'login') {
      if (!email || !password) {
        return Response.json({ error: 'Dados incompletos' }, { status: 400 });
      }
      const list = await base44.asServiceRole.entities.Customer.filter({
        company_id, email: email.toLowerCase(),
      });
      const customer = list[0];
      if (!customer || !customer.password_hash) {
        return Response.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
      }
      const ok = await verifyPassword(password, customer.password_hash);
      if (!ok) {
        return Response.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
      }
      const newToken = generateToken();
      const updated = await base44.asServiceRole.entities.Customer.update(customer.id, {
        auth_token: newToken,
        auth_token_expires_at: expiryDate(),
      });
      return Response.json({
        success: true,
        token: newToken,
        customer: publicCustomer(updated),
      });
    }

    // ─── ACTION: ME — valida token e retorna cliente ────────────────────────
    if (action === 'me') {
      if (!token) return Response.json({ customer: null });
      const list = await base44.asServiceRole.entities.Customer.filter({
        company_id, auth_token: token,
      });
      const customer = list[0];
      if (!customer) return Response.json({ customer: null });
      if (customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) < new Date()) {
        return Response.json({ customer: null });
      }
      return Response.json({ customer: publicCustomer(customer) });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('[customerAuth] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});