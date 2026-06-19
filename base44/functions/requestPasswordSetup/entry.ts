// requestPasswordSetup — Endpoint público chamado pelas telas /checkout/sucesso
// e /ativar-acesso para registrar o dono da barbearia como User no Base44.
//
// Estratégia (Opção A — OTP nativo da plataforma):
//   1) Verifica se existe Company com owner_email == email.
//   2) Aplica cooldown de 60s por email (rate-limit anti-spam).
//   3) Chama base44.auth.register({ email, full_name, password }) — a plataforma
//      cria o User e envia automaticamente um OTP de 6 dígitos por email.
//      O dono recebe o email do Base44 e cola o código em /ativar-acesso.
//   4) Em caso de "já registrado", chamamos base44.auth.resendOtp para reenviar
//      o código (idempotente para reenvios solicitados pelo dono).
//   5) Registra EmailLog para auditoria.
//
// O envio do email é feito pela plataforma Base44 — não usamos mais Resend aqui.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const COOLDOWN_SECONDS = 60;

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function randomPassword() {
  // Senha aleatória forte. O dono nunca a verá nem precisará dela —
  // o acesso é via OTP (e depois ele pode usar "Esqueci minha senha" se quiser).
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes).map((b) => b.toString(36)).join('') + 'Aa1!';
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const email = String(payload?.email || '').trim().toLowerCase();

    if (!isValidEmail(email)) {
      return Response.json({ ok: false, error: 'invalid_email' }, { status: 400 });
    }

    // 1) Confirma que existe Company com esse owner_email.
    const companies = await sdk.entities.Company.filter({ owner_email: email }, '-created_date', 1).catch(() => []);
    if (!companies?.length) {
      console.warn(`[requestPasswordSetup ${rid}] no_company_for_email`, { email });
      // Resposta neutra (não vazamos se o email existe no sistema).
      return Response.json({ ok: true, dispatched: false });
    }
    const company = companies[0];

    // 2) Rate-limit por email (cooldown de 60s entre envios).
    const recent = await sdk.entities.EmailLog.filter(
      { recipient: email, type: 'password_reset' },
      '-created_date',
      1
    ).catch(() => []);
    if (recent?.length) {
      const lastAt = new Date(recent[0].created_date || recent[0].sent_at || 0).getTime();
      const elapsed = (Date.now() - lastAt) / 1000;
      if (elapsed < COOLDOWN_SECONDS) {
        console.log(`[requestPasswordSetup ${rid}] cooldown_active`, { email, elapsed });
        return Response.json({
          ok: true,
          dispatched: true,
          cooldown: true,
          wait_seconds: Math.ceil(COOLDOWN_SECONDS - elapsed),
        });
      }
    }

    // 3) Cria log pendente (auditoria).
    let log = null;
    try {
      log = await sdk.entities.EmailLog.create({
        company_id: company.id,
        recipient: email,
        subject: 'Código de acesso — O CORTE',
        type: 'password_reset',
        status: 'pending',
        provider: 'base44_core',
        metadata: { source: 'ativar_acesso', rid },
      });
    } catch (logErr) {
      console.warn(`[requestPasswordSetup ${rid}] log_create_failed`, logErr.message);
    }

    // 4) Tenta registrar o User na plataforma Base44.
    //    Casos possíveis:
    //      a) Novo: register() dispara OTP de ativação automaticamente.
    //      b) Já existe mas não verificado: resendOtp() reenvia o OTP de ativação.
    //      c) Já existe e verificado: avisa o frontend para usar login normal
    //         (Base44 envia OTP de login automaticamente no redirectToLogin).
    let dispatched = false;
    let already = false;
    let alreadyVerified = false;
    try {
      const fullName = company.owner_name || (email.split('@')[0] || 'Dono');
      await base44.auth.register({
        email,
        full_name: fullName,
        password: randomPassword(),
      });
      dispatched = true;
      console.log(`[requestPasswordSetup ${rid}] registered`, { email });
    } catch (regErr) {
      const msg = (regErr?.message || JSON.stringify(regErr) || '').toLowerCase();
      const looksAlreadyExists = /already|exists|registered|duplicate/.test(msg);
      if (looksAlreadyExists) {
        already = true;
        try {
          await base44.auth.resendOtp(email);
          dispatched = true;
          console.log(`[requestPasswordSetup ${rid}] resent_otp`, { email });
        } catch (resendErr) {
          const rMsg = (resendErr?.message || JSON.stringify(resendErr) || '').toLowerCase();
          if (/already verified|already_verified/.test(rMsg)) {
            alreadyVerified = true;
            dispatched = true; // sinaliza ao frontend que deve usar login normal
            console.log(`[requestPasswordSetup ${rid}] already_verified`, { email });
          } else {
            console.error(`[requestPasswordSetup ${rid}] resend_otp_failed`, resendErr?.message || JSON.stringify(resendErr));
          }
        }
      } else {
        console.error(`[requestPasswordSetup ${rid}] register_failed`, regErr?.message);
      }
    }

    // 5) Atualiza log.
    if (log) {
      await sdk.entities.EmailLog.update(log.id, {
        status: dispatched ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
        metadata: { ...(log.metadata || {}), already_registered: already, already_verified: alreadyVerified },
      }).catch(() => {});
    }

    if (!dispatched) {
      return Response.json({ ok: false, error: 'send_failed' }, { status: 502 });
    }

    return Response.json({ ok: true, dispatched: true, already, already_verified: alreadyVerified });
  } catch (err) {
    console.error(`[requestPasswordSetup ${rid}] INTERNAL`, err?.message, err?.stack);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
});