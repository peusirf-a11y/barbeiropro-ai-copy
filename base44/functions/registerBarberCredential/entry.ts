// registerBarberCredential — Cria a credencial de senha do dono.
//
// Fluxo (Fase 1 da auth própria por cima do Base44):
//   1. Valida email + senha.
//   2. Confirma que existe Company com owner_email == email (só donos podem criar).
//   3. Gera password_hash (PBKDF2 + pepper) e base44_password_hint (random forte).
//   4. Tenta base44.auth.register({ email, full_name, password: base44_password_hint }).
//      - Se "already exists", ignora e segue (User já existe na plataforma).
//   5. Cria BarberCredential com email único.
//   6. Retorna { ok: true } — frontend redireciona pro /login.
//
// Esta função NÃO faz login automático. Login é responsabilidade do
// loginBarberCredential (próximo passo do fluxo).
//
// Idempotência: se já existe BarberCredential para o email, retorna conflict (409).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PEPPER = Deno.env.get('BARBER_AUTH_PEPPER') || '';
const ITERATIONS = 310000;

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function isStrongPassword(p) {
  // Mínimo: 8 chars, ao menos 1 letra e 1 número. Sem barra alta — UX prioridade.
  return typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
}

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function pbkdf2(password, saltB64) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password + PEPPER),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    256,
  );
  return toBase64(bits);
}

function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

function randomTechnicalPassword() {
  // 32 bytes aleatórios → base64 + sufixo que garante regras da Base44.
  return toBase64(randomBytes(32)) + 'Aa1!';
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    if (!PEPPER) {
      console.error(`[registerBarberCredential ${rid}] missing_pepper`);
      return Response.json({ ok: false, error: 'server_misconfigured' }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const email = String(payload?.email || '').trim().toLowerCase();
    const password = String(payload?.password || '');
    const fullName = String(payload?.full_name || '').trim();

    if (!isValidEmail(email)) {
      return Response.json({ ok: false, error: 'invalid_email' }, { status: 400 });
    }
    if (!isStrongPassword(password)) {
      return Response.json({ ok: false, error: 'weak_password' }, { status: 400 });
    }

    // 1) Confirma que existe Company para esse email (proteção: só donos).
    const companies = await sdk.entities.Company.filter(
      { owner_email: email },
      '-created_date',
      1,
    ).catch(() => []);
    if (!companies?.length) {
      console.warn(`[registerBarberCredential ${rid}] no_company`, { email });
      return Response.json({ ok: false, error: 'no_company_for_email' }, { status: 404 });
    }
    const company = companies[0];

    // 2) Checa se já existe BarberCredential para este email.
    const existing = await sdk.entities.BarberCredential.filter({ email }, '-created_date', 1).catch(() => []);
    if (existing?.length) {
      return Response.json({ ok: false, error: 'credential_already_exists' }, { status: 409 });
    }

    // 3) Gera salt + hash da senha pública (do dono).
    const saltB64 = toBase64(randomBytes(16));
    const passwordHash = await pbkdf2(password, saltB64);

    // 4) Gera senha técnica aleatória usada para autenticar contra Base44.
    const base44Password = randomTechnicalPassword();

    // 5) Tenta registrar o User na Base44. Se já existe, ok — seguimos.
    let base44Registered = false;
    try {
      await base44.auth.register({
        email,
        full_name: fullName || company.owner_name || email.split('@')[0],
        password: base44Password,
      });
      base44Registered = true;
    } catch (regErr) {
      const msg = (regErr?.message || JSON.stringify(regErr) || '').toLowerCase();
      const alreadyExists = /already|exists|registered|duplicate/.test(msg);
      if (!alreadyExists) {
        console.error(`[registerBarberCredential ${rid}] base44_register_failed`, regErr?.message);
        return Response.json({ ok: false, error: 'base44_register_failed' }, { status: 502 });
      }
      // User já existia na Base44 — nesse caso, NÃO conseguimos sobrescrever a senha
      // técnica (a Base44 não expõe API admin pra isso). O loginBarberCredential vai
      // detectar e cair no fluxo de OTP/reset por dentro. Por ora, marcamos.
      console.warn(`[registerBarberCredential ${rid}] base44_user_pre_existing`, { email });
    }

    // 6) Persiste a credencial.
    const credential = await sdk.entities.BarberCredential.create({
      email,
      company_id: company.id,
      password_hash: passwordHash,
      password_salt: saltB64,
      password_algo: `pbkdf2-sha256-${ITERATIONS}`,
      base44_password_hint: base44Password,
      failed_attempts: 0,
    });

    console.log(`[registerBarberCredential ${rid}] created`, {
      email,
      credential_id: credential.id,
      base44_registered: base44Registered,
    });

    return Response.json({ ok: true, base44_registered: base44Registered });
  } catch (err) {
    console.error(`[registerBarberCredential ${rid}] INTERNAL`, err?.message, err?.stack);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
});