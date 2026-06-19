// resetBarberPassword — Consome token de reset e atualiza a senha (Fase 2).
//
// Fluxo:
//   1. Recebe { token, new_password }.
//   2. Valida senha (mínimo 8, letra + número).
//   3. Calcula SHA-256(token) e busca BarberCredential com reset_token_hash igual.
//   4. Valida expiração.
//   5. Gera novo salt + hash da nova senha.
//   6. Atualiza credencial e invalida token + lock + tentativas.
//   7. Retorna ok:true.
//
// IMPORTANTE: NÃO alteramos a base44_password_hint (senha técnica continua a mesma),
// porque o login Base44 é interno e transparente pro dono. Ele só conhece a senha pública.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PEPPER = Deno.env.get('BARBER_AUTH_PEPPER') || '';
const ITERATIONS = 310000;

function isStrongPassword(p) {
  return typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
}

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
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

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    if (!PEPPER) {
      console.error(`[resetBarberPassword ${rid}] missing_pepper`);
      return Response.json({ ok: false, error: 'server_misconfigured' }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const token = String(payload?.token || '').trim();
    const newPassword = String(payload?.new_password || '');

    if (!token) {
      return Response.json({ ok: false, error: 'invalid_token' }, { status: 400 });
    }
    if (!isStrongPassword(newPassword)) {
      return Response.json({ ok: false, error: 'weak_password' }, { status: 400 });
    }

    const tokenHash = await sha256Hex(token);

    // Busca credencial pelo hash do token.
    const creds = await sdk.entities.BarberCredential.filter(
      { reset_token_hash: tokenHash },
      '-created_date',
      1,
    ).catch(() => []);
    const credential = creds?.[0];
    if (!credential) {
      return Response.json({ ok: false, error: 'invalid_token' }, { status: 400 });
    }

    // Valida expiração.
    if (!credential.reset_expires_at || new Date(credential.reset_expires_at).getTime() < Date.now()) {
      return Response.json({ ok: false, error: 'token_expired' }, { status: 400 });
    }

    // Gera novo salt + hash.
    const newSalt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const newHash = await pbkdf2(newPassword, newSalt);

    await sdk.entities.BarberCredential.update(credential.id, {
      password_hash: newHash,
      password_salt: newSalt,
      password_algo: `pbkdf2-sha256-${ITERATIONS}`,
      reset_token_hash: null,
      reset_expires_at: null,
      failed_attempts: 0,
      locked_until: null,
    });

    console.log(`[resetBarberPassword ${rid}] password_reset`, { email: credential.email });

    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[resetBarberPassword ${rid}] INTERNAL`, err?.message, err?.stack);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
});