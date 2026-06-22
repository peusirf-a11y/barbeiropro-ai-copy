// partnerAuth — autenticação do parceiro com email + senha (e magic link como fallback).
//
// Actions:
//  • login_password         → email + senha → auth_token de sessão (7d).
//  • set_password           → define/troca senha autenticado (com senha atual ou via magic link).
//  • request_password_reset → envia email com reset_token (1h).
//  • reset_password         → consome reset_token, define nova senha.
//  • request_magic_link     → fallback passwordless (15min).
//  • verify_magic_link      → consome magic_token, devolve auth_token de sessão (7d).
//  • me                     → valida auth_token e devolve dados do parceiro.
//  • logout                 → invalida auth_token atual.
//  • update_profile         → atualiza dados básicos.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MAGIC_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const PBKDF2_ITERATIONS = 310000;

async function _sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function _token() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}
function _b64(arr) {
  let s = '';
  const bytes = new Uint8Array(arr);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function _b64decode(str) {
  const s = atob(str);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}
async function _hashPassword(password, saltB64) {
  const pepper = Deno.env.get('BARBER_AUTH_PEPPER') || '';
  const enc = new TextEncoder();
  const salt = _b64decode(saltB64);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password + pepper), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return _b64(bits);
}
function _newSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return _b64(arr);
}
function _validPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 200;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();

    if (action === 'login_password') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!email || !password) return Response.json({ error: 'missing_credentials' }, { status: 400 });

      const list = await sdk.entities.Partner.filter({ email }, '-created_date', 1);
      const partner = list?.[0];
      // Resposta uniforme (anti-enum)
      if (!partner || !partner.password_hash || !partner.password_salt) {
        return Response.json({ error: 'invalid_credentials' }, { status: 401 });
      }
      if (partner.status === 'suspended') {
        return Response.json({ error: 'partner_suspended' }, { status: 403 });
      }
      // Lock por tentativas
      if (partner.locked_until && new Date(partner.locked_until) > new Date()) {
        return Response.json({ error: 'account_locked', message: 'Conta bloqueada por excesso de tentativas. Tente novamente em 15 minutos.' }, { status: 423 });
      }

      const hash = await _hashPassword(password, partner.password_salt);
      if (hash !== partner.password_hash) {
        const newAttempts = (partner.failed_attempts || 0) + 1;
        const patch = { failed_attempts: newAttempts };
        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
          patch.locked_until = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
        }
        await sdk.entities.Partner.update(partner.id, patch).catch(() => {});
        return Response.json({ error: 'invalid_credentials' }, { status: 401 });
      }

      // Sucesso — emite sessão
      const sessionToken = _token();
      const tokenHash = await _sha256(sessionToken);
      await sdk.entities.Partner.update(partner.id, {
        auth_token: tokenHash,
        auth_token_expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        failed_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        last_login_ip: ip,
      });

      try {
        await sdk.entities.AuditLog.create({
          actor_email: partner.email, actor_type: 'system', action: 'PARTNER_LOGIN',
          target_type: 'Partner', target_id: partner.id, severity: 'info', ip_address: ip,
          metadata: { method: 'password' },
        });
      } catch (_) {}

      return Response.json({
        success: true, token: sessionToken,
        partner: {
          id: partner.id, name: partner.name, email: partner.email,
          referral_code: partner.referral_code, status: partner.status,
          commission_percentage: partner.commission_percentage,
        },
      });
    }

    if (action === 'set_password') {
      const token = String(body.token || '').trim();
      const newPassword = String(body.new_password || '');
      if (!token) return Response.json({ error: 'token_required' }, { status: 401 });
      if (!_validPassword(newPassword)) return Response.json({ error: 'invalid_password', message: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 });

      const hash = await _sha256(token);
      const list = await sdk.entities.Partner.filter({ auth_token: hash }, '-created_date', 1);
      const partner = list?.[0];
      if (!partner || !partner.auth_token_expires_at || new Date(partner.auth_token_expires_at) < new Date()) {
        return Response.json({ error: 'invalid_token' }, { status: 401 });
      }

      // Se já existe senha, exige a senha atual
      if (partner.password_hash) {
        const currentPassword = String(body.current_password || '');
        if (!currentPassword) return Response.json({ error: 'current_password_required' }, { status: 400 });
        const currentHash = await _hashPassword(currentPassword, partner.password_salt);
        if (currentHash !== partner.password_hash) {
          return Response.json({ error: 'invalid_current_password' }, { status: 401 });
        }
      }

      const salt = _newSalt();
      const newHash = await _hashPassword(newPassword, salt);
      await sdk.entities.Partner.update(partner.id, {
        password_hash: newHash, password_salt: salt,
        password_algo: `pbkdf2-sha256-${PBKDF2_ITERATIONS}`,
        failed_attempts: 0, locked_until: null,
      });
      try {
        await sdk.entities.AuditLog.create({
          actor_email: partner.email, actor_type: 'system', action: 'PARTNER_PASSWORD_SET',
          target_type: 'Partner', target_id: partner.id, severity: 'info', ip_address: ip,
        });
      } catch (_) {}
      return Response.json({ success: true });
    }

    if (action === 'request_password_reset') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return Response.json({ error: 'email_required' }, { status: 400 });

      const list = await sdk.entities.Partner.filter({ email }, '-created_date', 1);
      const partner = list?.[0];
      // Resposta uniforme (anti-enum)
      if (!partner) return Response.json({ success: true, sent: true });
      if (partner.status === 'suspended') return Response.json({ success: true, sent: true });

      // Rate-limit por parceiro (1 envio a cada 2 minutos)
      if (partner.reset_requested_at && Date.now() - new Date(partner.reset_requested_at).getTime() < 2 * 60 * 1000) {
        return Response.json({ success: true, sent: true });
      }

      const rawToken = _token();
      const tokenHash = await _sha256(rawToken);
      await sdk.entities.Partner.update(partner.id, {
        reset_token_hash: tokenHash,
        reset_expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString(),
        reset_requested_at: new Date().toISOString(),
      });

      const appUrl = Deno.env.get('APP_URL') || 'https://ocorte.base44.app';
      const link = `${appUrl}/parceiro/resetar-senha?token=${encodeURIComponent(rawToken)}`;
      try {
        await sdk.functions.invoke('sendAuditedEmail', {
          to: email,
          subject: 'Redefinir senha — Painel de Parceiros O CORTE',
          body: `<p>Olá ${partner.name},</p><p>Clique no link abaixo para criar uma nova senha (expira em 1 hora):</p><p><a href="${link}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Redefinir senha</a></p><p>Se você não solicitou, ignore este email.</p>`,
          from_name: 'O CORTE', type: 'partner_password_reset',
        });
      } catch (err) { console.warn('[partnerAuth] reset email failed:', err.message); }

      return Response.json({ success: true, sent: true });
    }

    if (action === 'reset_password') {
      const rawToken = String(body.token || '').trim();
      const newPassword = String(body.new_password || '');
      if (!rawToken) return Response.json({ error: 'token_required' }, { status: 400 });
      if (!_validPassword(newPassword)) return Response.json({ error: 'invalid_password', message: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 });

      const tokenHash = await _sha256(rawToken);
      const list = await sdk.entities.Partner.filter({ reset_token_hash: tokenHash }, '-created_date', 1);
      const partner = list?.[0];
      if (!partner || !partner.reset_expires_at || new Date(partner.reset_expires_at) < new Date()) {
        return Response.json({ error: 'invalid_or_expired_token' }, { status: 401 });
      }
      if (partner.status === 'suspended') {
        return Response.json({ error: 'partner_suspended' }, { status: 403 });
      }

      const salt = _newSalt();
      const newHash = await _hashPassword(newPassword, salt);
      // Limpa reset + emite nova sessão (auto-login após reset)
      const sessionToken = _token();
      const sessionHash = await _sha256(sessionToken);
      await sdk.entities.Partner.update(partner.id, {
        password_hash: newHash, password_salt: salt,
        password_algo: `pbkdf2-sha256-${PBKDF2_ITERATIONS}`,
        failed_attempts: 0, locked_until: null,
        reset_token_hash: null, reset_expires_at: null, reset_requested_at: null,
        auth_token: sessionHash,
        auth_token_expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        last_login_at: new Date().toISOString(), last_login_ip: ip,
      });

      try {
        await sdk.entities.AuditLog.create({
          actor_email: partner.email, actor_type: 'system', action: 'PARTNER_PASSWORD_RESET',
          target_type: 'Partner', target_id: partner.id, severity: 'info', ip_address: ip,
        });
      } catch (_) {}

      return Response.json({
        success: true, token: sessionToken,
        partner: {
          id: partner.id, name: partner.name, email: partner.email,
          referral_code: partner.referral_code, status: partner.status,
          commission_percentage: partner.commission_percentage,
        },
      });
    }

    if (action === 'request_magic_link') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return Response.json({ error: 'email_required' }, { status: 400 });

      const list = await sdk.entities.Partner.filter({ email }, '-created_date', 1);
      const partner = list?.[0];
      // Resposta uniforme (anti-enum): sempre responde "ok".
      if (!partner) {
        console.log('[partnerAuth] magic_link requested for unknown email:', email);
        return Response.json({ success: true, sent: true });
      }
      if (partner.status === 'suspended') {
        return Response.json({ error: 'partner_suspended' }, { status: 403 });
      }

      const magic = _token();
      await sdk.entities.Partner.update(partner.id, {
        magic_token: magic,
        magic_token_expires_at: new Date(Date.now() + MAGIC_TTL_MS).toISOString(),
      });

      const appUrl = Deno.env.get('APP_URL') || 'https://ocorte.base44.app';
      const link = `${appUrl}/parceiro/login?token=${encodeURIComponent(magic)}`;
      try {
        await sdk.functions.invoke('sendAuditedEmail', {
          to: email,
          subject: 'Acesso ao painel de parceiros — O CORTE',
          body: `<p>Olá ${partner.name},</p><p>Clique no link abaixo para acessar seu painel (expira em 15 minutos):</p><p><a href="${link}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Acessar painel</a></p><p>Se você não solicitou, ignore este email.</p>`,
          from_name: 'O CORTE',
          type: 'partner_magic_link',
        });
      } catch (err) { console.warn('[partnerAuth] email failed:', err.message); }

      return Response.json({ success: true, sent: true });
    }

    if (action === 'verify_magic_link') {
      const token = String(body.token || '').trim();
      if (!token) return Response.json({ error: 'token_required' }, { status: 400 });
      const list = await sdk.entities.Partner.filter({ magic_token: token }, '-created_date', 1);
      const partner = list?.[0];
      if (!partner) return Response.json({ error: 'invalid_token' }, { status: 401 });
      if (!partner.magic_token_expires_at || new Date(partner.magic_token_expires_at) < new Date()) {
        return Response.json({ error: 'token_expired' }, { status: 401 });
      }
      if (partner.status === 'suspended') {
        return Response.json({ error: 'partner_suspended' }, { status: 403 });
      }

      const sessionToken = _token();
      const hash = await _sha256(sessionToken);
      await sdk.entities.Partner.update(partner.id, {
        auth_token: hash,
        auth_token_expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        magic_token: null,
        magic_token_expires_at: null,
      });

      try {
        await sdk.entities.AuditLog.create({
          actor_email: partner.email,
          actor_type: 'system',
          action: 'PARTNER_LOGIN',
          target_type: 'Partner',
          target_id: partner.id,
          severity: 'info',
          ip_address: ip,
        });
      } catch (_) {}

      return Response.json({
        success: true,
        token: sessionToken,
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          referral_code: partner.referral_code,
          status: partner.status,
          commission_percentage: partner.commission_percentage,
        },
      });
    }

    if (action === 'me') {
      const token = String(body.token || '').trim();
      if (!token) return Response.json({ error: 'token_required' }, { status: 401 });
      const hash = await _sha256(token);
      const list = await sdk.entities.Partner.filter({ auth_token: hash }, '-created_date', 1);
      const partner = list?.[0];
      if (!partner) return Response.json({ error: 'invalid_token' }, { status: 401 });
      if (!partner.auth_token_expires_at || new Date(partner.auth_token_expires_at) < new Date()) {
        return Response.json({ error: 'token_expired' }, { status: 401 });
      }
      return Response.json({
        success: true,
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          phone: partner.phone,
          pix_key: partner.pix_key,
          referral_code: partner.referral_code,
          status: partner.status,
          commission_percentage: partner.commission_percentage,
          created_date: partner.created_date,
        },
      });
    }

    if (action === 'logout') {
      const token = String(body.token || '').trim();
      if (!token) return Response.json({ success: true });
      const hash = await _sha256(token);
      const list = await sdk.entities.Partner.filter({ auth_token: hash }, '-created_date', 1);
      if (list?.[0]) {
        await sdk.entities.Partner.update(list[0].id, { auth_token: null, auth_token_expires_at: null });
      }
      return Response.json({ success: true });
    }

    if (action === 'update_profile') {
      const token = String(body.token || '').trim();
      if (!token) return Response.json({ error: 'token_required' }, { status: 401 });
      const hash = await _sha256(token);
      const list = await sdk.entities.Partner.filter({ auth_token: hash }, '-created_date', 1);
      const partner = list?.[0];
      if (!partner) return Response.json({ error: 'invalid_token' }, { status: 401 });

      const patch = {};
      if (body.pix_key !== undefined) patch.pix_key = String(body.pix_key).trim().slice(0, 100);
      if (body.phone !== undefined) patch.phone = String(body.phone).replace(/\D/g, '');
      if (body.name !== undefined) patch.name = String(body.name).trim().slice(0, 100);
      if (Object.keys(patch).length === 0) return Response.json({ success: true });

      await sdk.entities.Partner.update(partner.id, patch);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err) {
    console.error('[partnerAuth] error:', err.message);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});