// trackReferralClick — endpoint PÚBLICO chamado quando um visitante chega
// com ?ref=CODE válido. Server-side valida o código, registra um Referral
// "pending" e devolve o partner_id para o frontend persistir.
//
// Este endpoint NÃO cria Company nem comissão — apenas registra a intenção.
// A vinculação real ocorre em `partnerAttribute` quando a barbearia se cadastra.
//
// Anti-abuso:
//  • Rate limit por IP (20 clicks/hora).
//  • Código inválido → 404 silencioso (não vaza enumeração).
//  • Idempotente por (referral_code + fingerprint) na última 1h.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RATE_LIMIT_HOUR = 20;

function _sanitize(v, max) {
  if (v == null) return '';
  return String(v).trim().replace(/<[^>]*>/g, '').replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max);
}

async function _checkIpRateLimit(sdk, ip) {
  if (!ip || ip === 'unknown') return { allowed: true };
  const key = `trackReferralClick:ip:${ip}`;
  const now = new Date();
  const windowMs = 60 * 60 * 1000;
  const existing = await sdk.entities.SecurityRateLimit.filter({ key }, '-created_date', 1).catch(() => []);
  const record = existing?.[0];
  if (record?.is_blocked && record.blocked_until && new Date(record.blocked_until) > now) {
    return { allowed: false };
  }
  if (record && record.window_end && new Date(record.window_end) > now) {
    const newAttempts = (record.attempts || 0) + 1;
    if (newAttempts >= RATE_LIMIT_HOUR) {
      await sdk.entities.SecurityRateLimit.update(record.id, {
        attempts: newAttempts, is_blocked: true,
        blocked_until: new Date(now.getTime() + windowMs).toISOString(),
      }).catch(() => {});
      return { allowed: false };
    }
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts }).catch(() => {});
    return { allowed: true };
  }
  await sdk.entities.SecurityRateLimit.create({
    key, route: 'trackReferralClick', ip, identifier: ip,
    attempts: 1,
    window_start: now.toISOString(),
    window_end: new Date(now.getTime() + windowMs).toISOString(),
    is_blocked: false,
  }).catch(() => {});
  return { allowed: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const body = await req.json().catch(() => ({}));

    const code = _sanitize(body.referral_code, 32).toUpperCase();
    const fingerprint = _sanitize(body.fingerprint, 64);
    const landing = _sanitize(body.landing, 200);

    if (!code || !/^[A-Z0-9_-]{4,32}$/.test(code)) {
      return Response.json({ error: 'invalid_code' }, { status: 400 });
    }

    const rl = await _checkIpRateLimit(sdk, ip);
    if (!rl.allowed) {
      return Response.json({ error: 'rate_limited' }, { status: 429 });
    }

    const list = await sdk.entities.Partner.filter({ referral_code: code }, '-created_date', 1);
    const partner = list?.[0];
    if (!partner || partner.status !== 'active') {
      // Silencioso: não diz "código não existe" para não enumerar.
      return Response.json({ success: false, valid: false });
    }

    // Idempotência leve: se já existe pending desse fingerprint+code na última 1h, retorna o existente.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const existing = fingerprint
      ? await sdk.entities.Referral.filter(
          { partner_id: partner.id, click_fingerprint: fingerprint, status: 'pending', created_date: { $gte: oneHourAgo } },
          '-created_date', 1,
        )
      : [];

    if (existing?.length) {
      return Response.json({
        success: true,
        valid: true,
        partner: { id: partner.id, name: partner.name, referral_code: partner.referral_code },
        referral_id: existing[0].id,
      });
    }

    const referral = await sdk.entities.Referral.create({
      partner_id: partner.id,
      attribution_type: 'link',
      status: 'pending',
      click_ip: ip,
      click_user_agent: userAgent.slice(0, 300),
      click_fingerprint: fingerprint || undefined,
      click_landing: landing || undefined,
    });

    return Response.json({
      success: true,
      valid: true,
      partner: { id: partner.id, name: partner.name, referral_code: partner.referral_code },
      referral_id: referral.id,
    });
  } catch (err) {
    console.error('[trackReferralClick] error:', err.message);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});