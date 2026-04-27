// setupTotp — Gera segredo TOTP para super admin e retorna otpauth URL para QR.
// Não ativa o TOTP — só ativa após primeira verificação bem-sucedida em verifyTotp.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { authenticator } from 'npm:otplib@12.0.1';

Deno.serve(async (req) => {
  console.log('JOB START: setupTotp');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Super Admin only' }, { status: 403 });
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'BarberTrimly Master', secret);

    // Salva o segredo mas mantém totp_enabled=false até verificação
    await base44.asServiceRole.entities.User.update(user.id, {
      totp_secret: secret,
      totp_enabled: false,
    });

    console.log(`JOB END: setupTotp for ${user.email}`);
    return Response.json({ success: true, secret, otpauth_url: otpauthUrl });
  } catch (error) {
    console.error('JOB ERROR: setupTotp:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});