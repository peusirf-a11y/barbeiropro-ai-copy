// verifyTotp — Verifica código TOTP do super admin e cria TotpSession (12h).
// Também ativa totp_enabled na primeira verificação bem-sucedida.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { authenticator } from 'npm:otplib@12.0.1';

const buckets = new Map();
function rateLimit(key, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

Deno.serve(async (req) => {
  console.log('JOB START: verifyTotp');
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Super Admin only' }, { status: 403 });
    }

    if (!rateLimit(`totp_${user.email}`)) {
      return Response.json({ success: false, error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429 });
    }

    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return Response.json({ success: false, error: 'Código inválido' }, { status: 400 });
    }

    if (!user.totp_secret) {
      return Response.json({ success: false, error: 'TOTP não configurado. Faça setup primeiro.' }, { status: 400 });
    }

    authenticator.options = { window: 1 };
    const cleanCode = code.replace(/\s/g, '');
    const isValid = authenticator.check(cleanCode, user.totp_secret);
    if (!isValid) {
      return Response.json({ success: false, error: 'Código inválido' }, { status: 401 });
    }

    // Anti-replay: rejeita reuso do mesmo código (cobre janela de ~30s)
    if (user.totp_last_code && user.totp_last_code === cleanCode) {
      return Response.json({ success: false, error: 'Código já utilizado. Aguarde o próximo.' }, { status: 401 });
    }

    // Marca código como usado + ativa no primeiro sucesso
    const userUpdates = { totp_last_code: cleanCode };
    if (!user.totp_enabled) userUpdates.totp_enabled = true;
    await base44.asServiceRole.entities.User.update(user.id, userUpdates);

    // Cria sessão 12h
    const token = crypto.randomUUID() + '.' + crypto.randomUUID();
    const expires_at = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.TotpSession.create({
      token,
      user_email: user.email,
      expires_at,
      ip,
    });

    console.log(`JOB END: verifyTotp success for ${user.email}`);
    return Response.json({ success: true, token, expires_at });
  } catch (error) {
    console.error('JOB ERROR: verifyTotp:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});