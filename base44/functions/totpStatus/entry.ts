// totpStatus — Retorna se o super admin tem TOTP ativo e se a sessão atual ainda é válida.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Super Admin only' }, { status: 403 });
    }

    const { totp_session_token } = (await req.json().catch(() => ({}))) || {};

    let sessionValid = false;
    let expires_at = null;
    if (totp_session_token) {
      const sessions = await base44.asServiceRole.entities.TotpSession.filter({ token: totp_session_token });
      const s = sessions?.[0];
      if (s && !s.ended_at && new Date(s.expires_at).getTime() > Date.now() && s.user_email === user.email) {
        sessionValid = true;
        expires_at = s.expires_at;
      }
    }

    return Response.json({
      success: true,
      totp_enabled: !!user.totp_enabled,
      session_valid: sessionValid,
      expires_at,
    });
  } catch (error) {
    console.error('JOB ERROR: totpStatus:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});