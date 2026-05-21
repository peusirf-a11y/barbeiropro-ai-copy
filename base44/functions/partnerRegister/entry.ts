// partnerRegister — endpoint PÚBLICO de cadastro de novos parceiros.
//
// Fluxo:
//  1. Recebe { name, email, phone, cpf_cnpj, pix_key, fingerprint }.
//  2. Sanitiza + valida.
//  3. Rate limit por IP (5 cadastros/hora).
//  4. Bloqueia duplicidade por email.
//  5. Gera referral_code único (8 chars alfanuméricos).
//  6. Cria Partner com status='pending'.
//  7. Loga AuditLog + envia email ao Master.
//
// Aprovação acontece manualmente em /master/partners (function partnerAdminAction).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RATE_LIMIT_HOUR = 5;

function _sanitize(v, max) {
  if (v == null) return '';
  return String(v).trim().replace(/<[^>]*>/g, '').replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max);
}
function _digits(v) {
  return String(v || '').replace(/\D/g, '');
}
function _isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function _generateCode() {
  // 8 chars alfanuméricos (sem 0/O/1/I para evitar confusão).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 8; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

async function _checkIpRateLimit(sdk, ip) {
  if (!ip || ip === 'unknown') return { allowed: true };
  const key = `partnerRegister:ip:${ip}`;
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
        attempts: newAttempts,
        is_blocked: true,
        blocked_until: new Date(now.getTime() + windowMs).toISOString(),
      }).catch(() => {});
      return { allowed: false };
    }
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts }).catch(() => {});
    return { allowed: true };
  }
  await sdk.entities.SecurityRateLimit.create({
    key, route: 'partnerRegister', ip, identifier: ip,
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

    const rl = await _checkIpRateLimit(sdk, ip);
    if (!rl.allowed) {
      return Response.json({ error: 'rate_limited', message: 'Muitas tentativas. Tente mais tarde.' }, { status: 429 });
    }

    const name = _sanitize(body.name, 100);
    const email = _sanitize(body.email, 200).toLowerCase();
    const phone = _digits(body.phone);
    const cpf_cnpj = _digits(body.cpf_cnpj);
    const pix_key = _sanitize(body.pix_key, 100);
    const fingerprint = _sanitize(body.fingerprint, 64);

    if (!name) return Response.json({ error: 'name_required' }, { status: 400 });
    if (!_isEmail(email)) return Response.json({ error: 'invalid_email' }, { status: 400 });
    if (phone.length < 10) return Response.json({ error: 'invalid_phone' }, { status: 400 });
    if (cpf_cnpj.length < 11) return Response.json({ error: 'cpf_cnpj_required' }, { status: 400 });

    // Duplicidade por email
    const existing = await sdk.entities.Partner.filter({ email }, '-created_date', 1);
    if (existing?.length) {
      return Response.json({ error: 'email_already_registered', message: 'Já existe um cadastro com este email.' }, { status: 409 });
    }

    // Gera código único (tenta até 5 vezes)
    let referral_code = null;
    for (let i = 0; i < 5; i++) {
      const candidate = _generateCode();
      const dup = await sdk.entities.Partner.filter({ referral_code: candidate }, '-created_date', 1);
      if (!dup?.length) { referral_code = candidate; break; }
    }
    if (!referral_code) {
      return Response.json({ error: 'code_generation_failed' }, { status: 500 });
    }

    const partner = await sdk.entities.Partner.create({
      name, email, phone, cpf_cnpj, pix_key,
      referral_code,
      status: 'pending',
      commission_percentage: 20,
      fingerprint_seen: fingerprint ? [fingerprint] : [],
    });

    // AuditLog
    try {
      await sdk.entities.AuditLog.create({
        actor_email: email,
        actor_type: 'system',
        action: 'PARTNER_CREATED',
        target_type: 'Partner',
        target_id: partner.id,
        severity: 'info',
        ip_address: ip,
        user_agent: userAgent,
        metadata: { referral_code, source: 'public_register' },
      });
    } catch (err) { console.warn('[partnerRegister] audit failed:', err.message); }

    // Notifica Master (best-effort)
    try {
      const masterEmail = Deno.env.get('MASTER_NOTIFICATION_EMAIL') || '';
      if (masterEmail) {
        await sdk.functions.invoke('sendAuditedEmail', {
          to: masterEmail,
          subject: `Novo parceiro aguardando aprovação: ${name}`,
          body: `<p>Novo cadastro de parceiro:</p><ul><li><b>${name}</b> · ${email}</li><li>Telefone: ${phone}</li><li>Código: ${referral_code}</li></ul><p>Acesse /master/partners para aprovar.</p>`,
          from_name: 'O CORTE',
          type: 'partner_registration',
        });
      }
    } catch (_) { /* silencioso */ }

    console.log(`[partnerRegister] new partner ${partner.id} (${email}) code=${referral_code}`);
    return Response.json({
      success: true,
      partner: { id: partner.id, name, email, referral_code, status: 'pending' },
    });
  } catch (err) {
    console.error('[partnerRegister] error:', err.message);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});