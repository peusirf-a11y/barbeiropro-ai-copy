// onboardingEmailRetry.test.js — Verifica:
//   1. Idempotência: chamadas duplicadas não reenviam.
//   2. Retry em falha: se sendAuditedEmail falhar uma vez, o handler tenta de novo.
//   3. Falha definitiva registra onboarding_email_failed e não marca a flag.

import { createMockBase44 } from '../helpers/mockBase44.js';

async function run() {
  const results = [];

  // ── Cenário 1: idempotência ─────────────────────────────────────────────
  {
    let sendCount = 0;
    const base44 = createMockBase44({
      entities: {
        Company: {
          'co_1': {
            id: 'co_1',
            owner_email: 'a@b.com',
            owner_name: 'A',
            name: 'X',
            plan_name: 'Starter',
            onboarding_email_sent_at: new Date().toISOString(),
          },
        },
        UserEvent: {},
      },
      functions: {
        sendAuditedEmail: async () => { sendCount += 1; return { data: { ok: true, log_id: 'log_x' } }; },
      },
    });

    await runHandler(base44, { company_id: 'co_1' });
    await runHandler(base44, { company_id: 'co_1' });
    await runHandler(base44, { company_id: 'co_1' });

    results.push({
      name: 'no email sent when onboarding_email_sent_at already set',
      pass: sendCount === 0,
      detail: `sendCount=${sendCount}`,
    });
  }

  // ── Cenário 2: retry transitório (falha 1x → sucesso) ───────────────────
  {
    let attempts = 0;
    const base44 = createMockBase44({
      entities: {
        Company: { 'co_2': { id: 'co_2', owner_email: 'r@b.com', owner_name: 'R', name: 'R', plan_name: 'Pro' } },
        UserEvent: {},
      },
      functions: {
        sendAuditedEmail: async () => {
          attempts += 1;
          if (attempts === 1) return { data: { ok: false, status: 'failed', error: 'transient' } };
          return { data: { ok: true, log_id: 'log_ok' } };
        },
      },
    });

    const out = await runHandler(base44, { company_id: 'co_2' });
    results.push({
      name: 'retries once after transient failure',
      pass: attempts === 2 && out?.ok === true,
      detail: `attempts=${attempts} ok=${out?.ok}`,
    });
    results.push({
      name: 'flag is set after successful retry',
      pass: !!base44.entities.Company.records['co_2'].onboarding_email_sent_at,
      detail: `flag=${base44.entities.Company.records['co_2'].onboarding_email_sent_at}`,
    });
  }

  // ── Cenário 3: 3 falhas seguidas → onboarding_email_failed, sem flag ────
  {
    let attempts = 0;
    const events = [];
    const base44 = createMockBase44({
      entities: {
        Company: { 'co_3': { id: 'co_3', owner_email: 'f@b.com', owner_name: 'F', name: 'F', plan_name: 'Starter' } },
        UserEvent: {},
      },
      functions: {
        sendAuditedEmail: async () => {
          attempts += 1;
          return { data: { ok: false, status: 'failed', error: 'down' } };
        },
      },
      onUserEventCreate: (r) => events.push(r.event_type),
    });

    const out = await runHandler(base44, { company_id: 'co_3' });

    results.push({
      name: 'tries 3 times before giving up',
      pass: attempts === 3,
      detail: `attempts=${attempts}`,
    });
    results.push({
      name: 'returns ok=false on permanent failure',
      pass: out?.ok === false,
      detail: JSON.stringify(out),
    });
    results.push({
      name: 'does NOT set onboarding_email_sent_at on failure',
      pass: !base44.entities.Company.records['co_3'].onboarding_email_sent_at,
      detail: `flag=${base44.entities.Company.records['co_3'].onboarding_email_sent_at}`,
    });
    results.push({
      name: 'logs onboarding_email_failed event',
      pass: events.includes('onboarding_email_failed'),
      detail: `events=${JSON.stringify(events)}`,
    });
  }

  return results;
}

// Replica core do handler com retry de até 3 tentativas (delays curtos no teste).
async function runHandler(base44, payload) {
  const sdk = base44.asServiceRole;
  const company = await sdk.entities.Company.get(payload.company_id).catch(() => null);
  if (!company) return { ok: false, error: 'company_not_found' };
  if (company.onboarding_email_sent_at) return { ok: true, skipped: true };
  const email = (company.owner_email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'invalid_owner_email' };

  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await sdk.functions.invoke('sendAuditedEmail', {
        to: email,
        subject: 'Sua conta O CORTE já está pronta',
        body: 'x',
        type: 'welcome',
        company_id: payload.company_id,
      });
      if (res?.data?.ok === false) throw new Error(res.data.error || 'fail');
      const sentAt = new Date().toISOString();
      await sdk.entities.Company.update(payload.company_id, { onboarding_email_sent_at: sentAt });
      await sdk.entities.UserEvent.create({ event_type: 'onboarding_email_sent', metadata: { attempt: i + 1 } });
      return { ok: true, sent_at: sentAt };
    } catch (err) {
      lastErr = err;
    }
  }
  await sdk.entities.UserEvent.create({ event_type: 'onboarding_email_failed', metadata: { reason: lastErr?.message } });
  return { ok: false, error: 'send_failed' };
}

export default run;