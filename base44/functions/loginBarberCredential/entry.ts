// loginBarberCredential — Login com email + senha (auth própria O CORTE).
//
// Fluxo:
//   1. Busca BarberCredential pelo email.
//   2. Aplica rate limit / lock (5 falhas → 15min de bloqueio).
//   3. Valida o hash da senha (PBKDF2 + pepper).
//   4. Usa base44.auth.loginViaEmailPassword(email, base44_password_hint) para emitir
//      um access_token da Base44 (que o frontend vai setar via setToken).
//   5. Atualiza last_login_at / last_login_ip e zera failed_attempts.
//   6. Retorna { ok: true, access_token, user }.
//
// Erros (status 401 com error code estável):
//   - invalid_credentials  → email não encontrado OU senha errada
//   - account_locked       → bloqueado até X
//   - base44_login_failed  → senha técnica inválida (User da Base44 foi alterado fora do nosso fluxo)
//   - legacy_account       → credencial marcada como is_legacy: hash da senha bate, mas
//                            não temos senha técnica conhecida pra User antigo da Base44.
//                            Frontend deve cair no redirectToLogin (OTP nativo Base44) só dessa vez.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PEPPER = Deno.env.get('BARBER_AUTH_PEPPER') || '';
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(password, saltB64, iterations) {
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
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    256,
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

function parseIterations(algo) {
  const m = /pbkdf2-sha256-(\d+)/.exec(algo || '');
  return m ? parseInt(m[1], 10) : 310000;
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    if (!PEPPER) {
      console.error(`[loginBarberCredential ${rid}] missing_pepper`);
      return Response.json({ ok: false, error: 'server_misconfigured' }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const email = String(payload?.email || '').trim().toLowerCase();
    const password = String(payload?.password || '');
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';

    if (!isValidEmail(email) || !password) {
      return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
    }

    // 1) Busca credencial.
    const creds = await sdk.entities.BarberCredential.filter({ email }, '-created_date', 1).catch(() => []);
    const credential = creds?.[0];
    if (!credential) {
      // Resposta neutra (não vazamos se o email existe).
      return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
    }

    // 2) Lock?
    if (credential.locked_until && new Date(credential.locked_until).getTime() > Date.now()) {
      return Response.json(
        { ok: false, error: 'account_locked', locked_until: credential.locked_until },
        { status: 423 },
      );
    }

    // 3) Valida hash.
    const iterations = parseIterations(credential.password_algo);
    const computed = await pbkdf2(password, credential.password_salt, iterations);
    if (!timingSafeEqual(computed, credential.password_hash)) {
      const attempts = (credential.failed_attempts || 0) + 1;
      const patch = { failed_attempts: attempts };
      if (attempts >= MAX_ATTEMPTS) {
        patch.locked_until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
        patch.failed_attempts = 0;
      }
      await sdk.entities.BarberCredential.update(credential.id, patch).catch(() => {});
      console.warn(`[loginBarberCredential ${rid}] invalid_password`, { email, attempts });
      return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
    }

    // 4) Login na Base44 com a senha técnica → emite access_token.
    let loginRes;
    let loginErrMsg = '';
    try {
      loginRes = await base44.auth.loginViaEmailPassword(email, credential.base44_password_hint || '');
    } catch (err) {
      loginErrMsg = err?.message || '';
      console.warn(`[loginBarberCredential ${rid}] base44_login_attempt_failed`, loginErrMsg);
    }

    const accessToken = loginRes?.access_token;
    const user = loginRes?.user;

    if (!accessToken) {
      // Fase 4 — Fallback de migração:
      // Credencial legacy (sem base44_password_hint conhecido) OU senha técnica
      // rejeitada. Devolvemos legacy_account pro frontend disparar redirectToLogin
      // (OTP nativo Base44) e o dono entrar dessa vez por OTP.
      if (credential.is_legacy || !credential.base44_password_hint) {
        console.log(`[loginBarberCredential ${rid}] legacy_fallback`, { email });
        return Response.json({ ok: false, error: 'legacy_account' }, { status: 200 });
      }
      return Response.json({ ok: false, error: 'base44_login_failed' }, { status: 502 });
    }

    // 5) Sucesso — atualiza credencial. Se era legacy, desmarcamos.
    await sdk.entities.BarberCredential.update(credential.id, {
      failed_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
      is_legacy: false,
    }).catch(() => {});

    console.log(`[loginBarberCredential ${rid}] login_ok`, { email });

    return Response.json({
      ok: true,
      access_token: accessToken,
      user,
    });
  } catch (err) {
    console.error(`[loginBarberCredential ${rid}] INTERNAL`, err?.message, err?.stack);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
});