// partnerAuth — autenticação passwordless (magic link) para o painel /parceiro.
//
// Actions:
//  • request_magic_link  → envia email com link contendo magic_token (15min).
//  • verify_magic_link   → consome magic_token, devolve auth_token de sessão (7d).
//  • me                  → valida auth_token e devolve dados do parceiro.
//  • logout              → invalida auth_token atual.
//
// Não usa senha — fricção zero, alinhado com customerAuth.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MAGIC_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function _sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function _token() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();

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