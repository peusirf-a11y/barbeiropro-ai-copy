// setupTotp — Gera segredo TOTP para super admin e retorna otpauth URL para QR.
// Não ativa o TOTP — só ativa após primeira verificação bem-sucedida em verifyTotp.
// SEGURANÇA: Se já houver TOTP ativo, exige TotpSession válido para re-setup
// (evita que um atacante com sessão sequestrada faça reenrollment).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { authenticator } from 'npm:otplib@12.0.1';

async function requireValidTotpSession(base44, totp_session_token, user_email) {
  if (!totp_session_token) return { ok: false, error: '2FA obrigatório para re-setup' };
  const sessions = await base44.asServiceRole.entities.TotpSession.filter({ token: totp_session_token });
  const s = sessions?.[0];
  if (!s) return { ok: false, error: 'Sessão 2FA inválida' };
  if (s.ended_at) return { ok: false, error: 'Sessão 2FA encerrada' };
  if (new Date(s.expires_at).getTime() <= Date.now()) return { ok: false, error: 'Sessão 2FA expirada' };
  if (s.user_email !== user_email) return { ok: false, error: 'Sessão 2FA não pertence a este usuário' };
  return { ok: true };
}

Deno.serve(async (req) => {
  console.log('JOB START: setupTotp');
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Super Admin only' }, { status: 403 });
    }

    const { totp_session_token } = await req.json().catch(() => ({}));

    // Se TOTP já está ativo, re-setup exige sessão 2FA válida (anti-reenrollment)
    if (user.totp_enabled) {
      const totpCheck = await requireValidTotpSession(base44, totp_session_token, user.email);
      if (!totpCheck.ok) {
        return Response.json({ success: false, error: totpCheck.error, totp_required: true }, { status: 401 });
      }
      // Audit log de re-setup (evento sensível)
      await base44.asServiceRole.entities.AuditLog.create({
        actor_email: user.email,
        actor_is_super_admin: true,
        action: 'TOTP_RESET',
        ip,
      });
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'BarberTrimly Master', secret);

    // Salva o segredo mas mantém totp_enabled=false até verificação
    await base44.asServiceRole.entities.User.update(user.id, {
      totp_secret: secret,
      totp_enabled: false,
      totp_last_code: null,
    });

    console.log(`JOB END: setupTotp for ${user.email}`);
    return Response.json({ success: true, secret, otpauth_url: otpauthUrl });
  } catch (error) {
    console.error('JOB ERROR: setupTotp:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});