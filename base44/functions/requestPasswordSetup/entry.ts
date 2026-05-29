// requestPasswordSetup — Endpoint público chamado pela tela /acessar-conta.
//
// Objetivo: garantir que o usuário receba um email para definir/redefinir senha,
// mesmo que ele ainda não exista como membro do app Base44 (caso comum
// pós-checkout — o registro de Company existe, mas o User ainda não foi convidado).
//
// Fluxo:
//   1) Verifica se existe Company com owner_email == email (proteção mínima
//      contra abuso: só enviamos para emails realmente cadastrados no produto).
//   2) Tenta inviteUser(email, 'user'):
//        - Sucesso → Base44 dispara email nativo com link "definir senha".
//        - Já existe → cai no resetPasswordRequest (envia link de reset).
//   3) Registra EmailLog para auditoria.
//
// SEM autenticação: a rota é deliberadamente pública (o usuário ainda não
// conseguiu logar). Rate-limit é feito por email (1 envio a cada 60s).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const COOLDOWN_SECONDS = 60;

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
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

    // 1) Confirma que existe Company com esse owner_email. Sem isso, o pedido
    //    é ignorado silenciosamente (resposta genérica para não vazar info).
    const companies = await sdk.entities.Company.filter({ owner_email: email }, '-created_date', 1).catch(() => []);
    if (!companies?.length) {
      console.warn(`[requestPasswordSetup ${rid}] no_company_for_email`, { email });
      // Resposta neutra: não revelamos se o email existe ou não.
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

    // 3) Cria log pendente.
    let log = null;
    try {
      log = await sdk.entities.EmailLog.create({
        company_id: company.id,
        recipient: email,
        subject: 'Definir / redefinir senha — O CORTE',
        type: 'password_reset',
        status: 'pending',
        provider: 'base44_native',
        metadata: { source: 'acessar_conta', rid },
      });
    } catch (logErr) {
      console.warn(`[requestPasswordSetup ${rid}] log_create_failed`, logErr.message);
    }

    // 4) Estratégia:
    //   a) inviteUser primeiro — se o usuário ainda não é membro, isso o cria
    //      e a Base44 envia o email de boas-vindas com link de senha.
    //   b) Se já existe, dispara resetPasswordRequest.
    let mode = null;
    try {
      await base44.users.inviteUser(email, 'user');
      mode = 'invite';
      console.log(`[requestPasswordSetup ${rid}] invited`, { email });
    } catch (inviteErr) {
      const msg = inviteErr?.message || '';
      const alreadyMember = /already|exists|duplicate/i.test(msg);
      if (alreadyMember) {
        // Usuário já existe — pedimos reset oficial.
        try {
          await base44.auth.resetPasswordRequest(email);
          mode = 'reset';
          console.log(`[requestPasswordSetup ${rid}] reset_sent`, { email });
        } catch (resetErr) {
          const rmsg = (resetErr?.message || String(resetErr)).slice(0, 400);
          console.error(`[requestPasswordSetup ${rid}] reset_failed`, rmsg);
          if (log) {
            await sdk.entities.EmailLog.update(log.id, {
              status: 'failed',
              error_message: rmsg,
              sent_at: new Date().toISOString(),
            }).catch(() => {});
          }
          return Response.json({ ok: false, error: 'reset_failed' }, { status: 502 });
        }
      } else {
        const errMsg = msg.slice(0, 400);
        console.error(`[requestPasswordSetup ${rid}] invite_failed`, errMsg);
        if (log) {
          await sdk.entities.EmailLog.update(log.id, {
            status: 'failed',
            error_message: errMsg,
            sent_at: new Date().toISOString(),
          }).catch(() => {});
        }
        return Response.json({ ok: false, error: 'invite_failed' }, { status: 502 });
      }
    }

    if (log) {
      await sdk.entities.EmailLog.update(log.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: { ...(log.metadata || {}), mode },
      }).catch(() => {});
    }

    return Response.json({ ok: true, dispatched: true, mode });
  } catch (err) {
    console.error(`[requestPasswordSetup ${rid}] INTERNAL`, err?.message, err?.stack);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
});