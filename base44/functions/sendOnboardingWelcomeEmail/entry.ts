// sendOnboardingWelcomeEmail — Email transacional pós-checkout.
//
// Disparado em fire-and-forget por createAsaasSaasCheckout e chargeAsaasSaasWithCard
// após a Company ser criada com sucesso.
//
// COMO FUNCIONA NA BASE44:
//   A integration Core.SendEmail recusa enviar para destinatários fora do app
//   ("Cannot send emails to users outside the app"). A maneira correta de
//   notificar o novo dono é convidá-lo como usuário do app via base44.auth.inviteUser —
//   isso DISPARA O EMAIL DE BOAS-VINDAS NATIVO DA BASE44 com link de acesso.
//   Assim a barbearia recebe seu convite oficial e cai direto no fluxo de login.
//
// Características:
//   • Idempotente: usa Company.onboarding_email_sent_at como flag de "já enviou".
//     Se reinvocado para a mesma company_id, devolve { ok: true, skipped: true }.
//   • Retry automático: até 3 tentativas com backoff curto (0s, 1s, 3s).
//   • EmailLog: registra cada tentativa (pending → sent/failed) para auditoria.
//   • Segurança: tenant isolation (só envia para owner_email da Company), valida
//     formato de email, nunca expõe IDs internos.
//   • Observabilidade: emite UserEvent onboarding_email_sent | onboarding_email_failed.
//
// Payload: { company_id: string }
// Resposta: { ok, log_id?, sent_at?, skipped?, error?, attempts? }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(s) {
  if (!s || typeof s !== 'string') return false;
  const v = s.trim().toLowerCase();
  if (v.length < 5 || v.length > 254) return false;
  return EMAIL_FORMAT.test(v);
}

function isValidPlanName(name) {
  return ['Starter', 'Pro', 'Enterprise'].includes(String(name));
}

async function attemptSend(base44, { to, company_id, planName }) {
  // Convida o dono como usuário do app → dispara email de boas-vindas nativo Base44
  // com link de acesso. Auditamos via EmailLog para reproduzir o padrão transacional.
  const sdk = base44.asServiceRole;
  let log = null;
  try {
    log = await sdk.entities.EmailLog.create({
      company_id: company_id || null,
      recipient: to,
      subject: 'Sua conta O CORTE já está pronta',
      type: 'welcome',
      status: 'pending',
      provider: 'base44_invite',
      metadata: { plan_name: planName, source: 'onboarding_welcome' },
    });
  } catch (logErr) {
    console.warn('[sendOnboardingWelcomeEmail] EmailLog create failed:', logErr.message);
  }

  try {
    // inviteUser dispara o email de convite oficial Base44 com link de acesso.
    // Role 'user' é o default (admin do tenant). É idempotente do lado da plataforma:
    // convidar um email já convidado não duplica o usuário.
    await base44.users.inviteUser(to, 'user');
    if (log) {
      await sdk.entities.EmailLog.update(log.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).catch(() => {});
    }
    return { ok: true, log_id: log?.id || null };
  } catch (sendErr) {
    const errMsg = (sendErr?.message || String(sendErr)).slice(0, 500);
    // Se o usuário já existe, não é falha — ele já tem acesso. Tratamos como sucesso.
    const alreadyExists = /already|exists|duplicate/i.test(errMsg);
    if (alreadyExists) {
      if (log) {
        await sdk.entities.EmailLog.update(log.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: 'already_member',
        }).catch(() => {});
      }
      return { ok: true, log_id: log?.id || null, already_member: true };
    }
    if (log) {
      await sdk.entities.EmailLog.update(log.id, {
        status: 'failed',
        error_message: errMsg,
        sent_at: new Date().toISOString(),
      }).catch(() => {});
    }
    const err = new Error(errMsg);
    err.log_id = log?.id || null;
    throw err;
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function recordEvent(base44, type, metadata) {
  try {
    await base44.asServiceRole.entities.UserEvent.create({
      event_type: type,
      company_id: metadata?.company_id || null,
      metadata: metadata || {},
    });
  } catch (err) {
    console.warn('[sendOnboardingWelcomeEmail] UserEvent record failed:', err.message);
  }
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const { company_id } = payload;

    if (!company_id) {
      return Response.json({ ok: false, error: 'company_id_required' }, { status: 400 });
    }

    // 1) Carrega Company (fonte da verdade — tenant isolation)
    const company = await sdk.entities.Company.get(company_id).catch(() => null);
    if (!company) {
      console.warn(`[onboardingEmail ${rid}] company_not_found`, { company_id });
      return Response.json({ ok: false, error: 'company_not_found' }, { status: 404 });
    }

    // 2) Idempotência: se já enviou, não reenvia
    if (company.onboarding_email_sent_at) {
      console.log(`[onboardingEmail ${rid}] already_sent`, { company_id, at: company.onboarding_email_sent_at });
      return Response.json({
        ok: true,
        skipped: true,
        sent_at: company.onboarding_email_sent_at,
      });
    }

    // 3) Valida dados mínimos
    const email = (company.owner_email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      console.warn(`[onboardingEmail ${rid}] invalid_owner_email`, { company_id });
      return Response.json({ ok: false, error: 'invalid_owner_email' }, { status: 400 });
    }
    const planName = isValidPlanName(company.plan_name) ? company.plan_name : 'Starter';

    // 4) Convite + retry (até 3 tentativas: 0s, 1s, 3s)
    const delays = [0, 1000, 3000];
    let lastErr = null;
    let logId = null;
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) await sleep(delays[i]);
      try {
        const res = await attemptSend(base44, {
          to: email,
          company_id,
          planName,
        });
        logId = res?.log_id || logId;
        // Marca timestamp na Company
        const sentAt = new Date().toISOString();
        await sdk.entities.Company.update(company_id, { onboarding_email_sent_at: sentAt })
          .catch(err => console.error(`[onboardingEmail ${rid}] flag_update_failed`, err.message));
        await recordEvent(base44, 'onboarding_email_sent', { company_id, attempt: i + 1, log_id: logId });
        console.log(`[onboardingEmail ${rid}] sent`, { company_id, attempt: i + 1 });
        return Response.json({ ok: true, log_id: logId, sent_at: sentAt });
      } catch (err) {
        lastErr = err;
        logId = err?.log_id || logId;
        console.warn(`[onboardingEmail ${rid}] attempt_${i + 1}_failed`, err.message);
      }
    }

    // 6) Todas as tentativas falharam — registra evento e devolve 502 (sem expor stack)
    await recordEvent(base44, 'onboarding_email_failed', {
      company_id,
      attempts: delays.length,
      reason: (lastErr?.message || 'unknown').slice(0, 200),
      log_id: logId,
    });
    console.error(`[onboardingEmail ${rid}] all_attempts_failed`, { company_id, error: lastErr?.message });
    return Response.json({
      ok: false,
      error: 'send_failed',
      attempts: delays.length,
      log_id: logId,
    }, { status: 502 });
  } catch (err) {
    console.error(`[sendOnboardingWelcomeEmail ${rid}] INTERNAL`, err?.message, err?.stack);
    return Response.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
});