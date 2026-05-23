// migrateCompanySaasToAsaas — Etapa 4 da migração Stripe→Asaas.
//
// Estratégia: SOFT migrate. NÃO cancela Stripe. Cria Customer+Subscription Asaas em
// paralelo, persiste asaas_* na Company com billing_provider='asaas_pending' e
// migration_status='pending_first_payment'. Stripe segue cobrando até o webhook
// asaasWebhook confirmar o 1º PAYMENT_RECEIVED da nova subscription — só ali o
// Stripe é cancelado.
//
// Garantias:
//   - Master-only (TOTP gate na rota).
//   - Idempotente: chamar 2x não cria 2 subscriptions Asaas.
//   - Nunca cancela Stripe nesta function. Só o webhook cancela.
//   - AuditLog + SecurityEvent registrados.
//   - Email transacional ao owner via SendEmail.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLAN_NAME_TO_KEY = {
  'starter': 'starter', 'Starter': 'starter',
  'pro': 'pro', 'Pro': 'pro',
  'enterprise': 'enterprise', 'Enterprise': 'enterprise',
};
const PLANS = {
  starter:    { name: 'Starter',    price: 97 },
  pro:        { name: 'Pro',        price: 197 },
  enterprise: { name: 'Enterprise', price: 397 },
};

// ─── Asaas client (inline, espelha lib/asaas/client.js) ──────────────
function getAsaasConfig() {
  const apiKey = Deno.env.get('ASAAS_API_KEY');
  const environment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
  const baseUrl = Deno.env.get('ASAAS_BASE_URL')
    || (environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
  return { apiKey, baseUrl, isConfigured: !!apiKey };
}
function digitsOnly(v) { return String(v || '').replace(/\D+/g, ''); }
function sanitizeCpfCnpj(v) { const d = digitsOnly(v); return (d.length === 11 || d.length === 14) ? d : null; }
function sanitizePhone(v) { const d = digitsOnly(v); return (d.length >= 10 && d.length <= 13) ? d : null; }

async function asaasFetch(method, path, { body, query, idempotencyKey, corrId } = {}) {
  const cfg = getAsaasConfig();
  if (!cfg.isConfigured) { const e = new Error('ASAAS_API_KEY not configured'); e.code = 'asaas_not_configured'; e.status = 503; throw e; }
  let url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v != null) qs.append(k, String(v));
    const s = qs.toString(); if (s) url += `?${s}`;
  }
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'access_token': cfg.apiKey,
    'User-Agent': 'OCorte-SaaS/1.0 (+saas-migration)',
    'X-Correlation-Id': corrId || '',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    clearTimeout(t);
    const txt = await res.text();
    let data = null;
    if (txt) { try { data = JSON.parse(txt); } catch { data = txt; } }
    const latency = Date.now() - startedAt;
    if (!res.ok) {
      const msg = extractErr(data) || `HTTP ${res.status}`;
      console.error('[migrateCompanySaasToAsaas] asaas error', { corrId, method, path, status: res.status, latency_ms: latency, msg });
      const e = new Error(msg);
      e.code = res.status === 401 ? 'asaas_unauthorized' : res.status === 400 ? 'asaas_bad_request' : 'asaas_error';
      e.status = res.status; e.details = data;
      throw e;
    }
    console.log('[migrateCompanySaasToAsaas] asaas ok', { corrId, method, path, latency_ms: latency });
    return data;
  } catch (err) {
    clearTimeout(t);
    if (err.code) throw err;
    if (err.name === 'AbortError') { const e = new Error('asaas timeout'); e.code = 'asaas_timeout'; e.status = 504; throw e; }
    const e = new Error(err.message || 'network'); e.code = 'asaas_network'; e.status = 502; throw e;
  }
}
function extractErr(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.slice(0, 200);
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors.map(e => e?.description || e?.code).filter(Boolean).join('; ');
  return data?.message || data?.error || null;
}

function nextBillingDate(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 86400_000);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const corrId = crypto.randomUUID().split('-')[0];
  const startedAt = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const user = await base44.auth.me().catch(() => null);
    const sdk = base44.asServiceRole;

    // ─── Auth: super_admin only ─────────────────────────────────────
    if (!user) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (user.role !== 'super_admin' && user.role !== 'admin') {
      // Log tentativa não autorizada
      await sdk.entities.SecurityEvent.create({
        event_type: 'privilege_escalation_attempt',
        severity: 'high',
        actor_email: user.email,
        ip_address: ip,
        route: 'migrateCompanySaasToAsaas',
        details: { attempted_role: user.role },
        blocked: true,
      }).catch(() => {});
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { company_id, send_email = true } = body;
    if (!company_id) return Response.json({ error: 'company_id_required' }, { status: 400 });

    // ─── Carrega Company ─────────────────────────────────────────────
    const company = await sdk.entities.Company.get(company_id).catch(() => null);
    if (!company) return Response.json({ error: 'company_not_found' }, { status: 404 });

    // ─── Validações idempotentes ────────────────────────────────────
    // Se já migrada ou em curso, retorna estado atual sem refazer.
    if (company.migration_status === 'migrated') {
      console.log('[migrateCompanySaasToAsaas] already migrated', { corrId, company_id });
      return Response.json({
        success: true, replay: true,
        migration_status: 'migrated',
        asaas_subscription_id: company.asaas_subscription_id,
      });
    }
    if (company.migration_status === 'pending_first_payment' && company.asaas_subscription_id) {
      console.log('[migrateCompanySaasToAsaas] already pending', { corrId, company_id });
      return Response.json({
        success: true, replay: true,
        migration_status: 'pending_first_payment',
        asaas_subscription_id: company.asaas_subscription_id,
        asaas_payment_link_url: company.asaas_payment_link_url,
      });
    }

    // Precisa estar no Stripe pra migrar
    if (company.billing_provider !== 'stripe') {
      return Response.json({
        error: 'not_on_stripe',
        message: 'Esta empresa não está no Stripe. Migração não aplicável.',
        billing_provider: company.billing_provider,
      }, { status: 400 });
    }
    if (!company.stripe_subscription_id) {
      return Response.json({
        error: 'no_stripe_subscription',
        message: 'Empresa marcada como Stripe mas sem stripe_subscription_id.',
      }, { status: 400 });
    }

    // Plano precisa ser conhecido
    const planKey = PLAN_NAME_TO_KEY[company.plan_name] || PLAN_NAME_TO_KEY[String(company.plan_name).toLowerCase()];
    if (!planKey || !PLANS[planKey]) {
      return Response.json({
        error: 'unknown_plan',
        message: `Plano "${company.plan_name}" não reconhecido na migração.`,
      }, { status: 400 });
    }
    const planMeta = PLANS[planKey];

    // Dados mínimos do owner
    const emailLc = String(company.owner_email || '').trim().toLowerCase();
    if (!emailLc.includes('@')) return Response.json({ error: 'invalid_owner_email' }, { status: 400 });
    const phoneNorm = sanitizePhone(company.phone) || sanitizePhone(company.whatsapp);
    if (!phoneNorm) return Response.json({ error: 'invalid_owner_phone', message: 'Owner sem telefone válido (Asaas exige).' }, { status: 400 });
    const cpfNorm = sanitizeCpfCnpj(company.owner_cpf_cnpj);
    if (!cpfNorm) return Response.json({ error: 'invalid_cpf_cnpj', message: 'Owner sem CPF/CNPJ. Peça pro dono completar antes de migrar.' }, { status: 400 });

    // ─── Step 1: Customer Asaas (idempotente por email) ─────────────
    let asaasCustomerId = company.asaas_customer_id || null;
    if (!asaasCustomerId) {
      try {
        const found = await asaasFetch('GET', '/customers', { query: { externalReference: emailLc, limit: 1 }, corrId });
        if (found?.data?.[0]?.id) asaasCustomerId = found.data[0].id;
      } catch (err) { console.warn('[migrateCompanySaasToAsaas] customer lookup non-fatal', err.message); }
    }
    if (!asaasCustomerId) {
      try {
        const created = await asaasFetch('POST', '/customers', {
          idempotencyKey: `mig_cust:${emailLc}`,
          corrId,
          body: {
            name: company.name || company.owner_name || emailLc,
            email: emailLc,
            cpfCnpj: cpfNorm,
            mobilePhone: phoneNorm,
            externalReference: emailLc,
            notificationDisabled: false,
          },
        });
        asaasCustomerId = created?.id;
      } catch (err) {
        return markFailedAndRespond(sdk, company, user, corrId, ip, err, 'asaas_customer_failed');
      }
    }

    // ─── Step 2: Subscription Asaas ─────────────────────────────────
    // nextDueDate = D+5 (cliente recebe email com fatura e tem tempo de configurar).
    // ATENÇÃO: idempotencyKey contém company_id pra não colidir com checkout original.
    let subscription = null;
    try {
      subscription = await asaasFetch('POST', '/subscriptions', {
        idempotencyKey: `mig_sub:${company.id}:${planKey}`,
        corrId,
        body: {
          customer: asaasCustomerId,
          billingType: 'UNDEFINED', // cliente escolhe PIX/Boleto/Cartão na invoice
          cycle: 'MONTHLY',
          value: planMeta.price,
          nextDueDate: nextBillingDate(5),
          description: `O CORTE — ${planMeta.name} (migração Stripe→Asaas)`,
          externalReference: `saas:${emailLc}:${planKey}`,
        },
      });
    } catch (err) {
      return markFailedAndRespond(sdk, company, user, corrId, ip, err, 'asaas_subscription_failed');
    }
    if (!subscription?.id) {
      return markFailedAndRespond(sdk, company, user, corrId, ip, new Error('no subscription id'), 'asaas_subscription_failed');
    }

    // ─── Step 3: Busca a primeira invoice (link para owner) ─────────
    let firstInvoiceUrl = null;
    try {
      const payments = await asaasFetch('GET', `/subscriptions/${subscription.id}/payments`, { query: { limit: 1 }, corrId });
      const p = payments?.data?.[0];
      if (p) firstInvoiceUrl = p.invoiceUrl || p.bankSlipUrl || null;
    } catch (err) { console.warn('[migrateCompanySaasToAsaas] first invoice non-fatal', err.message); }

    // ─── Step 4: Atualiza Company (NÃO cancela Stripe ainda) ────────
    const now = new Date().toISOString();
    // Janela máxima de coexistência: 14 dias. Webhook cancela Stripe assim que pagar.
    const pendingCancellationAt = new Date(Date.now() + 14 * 86400_000).toISOString();
    await sdk.entities.Company.update(company.id, {
      billing_provider: 'asaas_pending',
      asaas_customer_id: asaasCustomerId,
      asaas_subscription_id: subscription.id,
      asaas_payment_link_url: firstInvoiceUrl || undefined,
      migration_status: 'pending_first_payment',
      asaas_migration_started_at: now,
      stripe_pending_cancellation_at: pendingCancellationAt,
    });

    // ─── Step 5: AuditLog ──────────────────────────────────────────
    await sdk.entities.AdminAuditLog.create({
      actor: user.email,
      actor_role: user.role === 'super_admin' ? 'super_admin' : 'admin',
      company_id: company.id,
      target_entity: 'Company', target_id: company.id,
      action: 'SUBSCRIPTION_CHANGED',
      before: {
        billing_provider: company.billing_provider,
        stripe_subscription_id: company.stripe_subscription_id,
        migration_status: company.migration_status || 'not_migrated',
      },
      after: {
        billing_provider: 'asaas_pending',
        asaas_subscription_id: subscription.id,
        migration_status: 'pending_first_payment',
      },
      severity: 'warning',
      metadata: { corrId, plan: planKey, action_subtype: 'saas_migration_started' },
      ip, request_id: corrId,
    }).catch(() => {});

    // ─── Step 6: Email transacional ao owner ────────────────────────
    if (send_email !== false && emailLc) {
      try {
        await base44.integrations.Core.SendEmail({
          to: emailLc,
          subject: 'Atualização importante na sua assinatura O CORTE',
          body: buildMigrationEmail({
            ownerName: company.owner_name || 'Cliente',
            businessName: company.name,
            planName: planMeta.name,
            invoiceUrl: firstInvoiceUrl,
            appUrl: Deno.env.get('APP_URL') || '',
          }),
        });
      } catch (err) { console.warn('[migrateCompanySaasToAsaas] email non-fatal', err.message); }
    }

    console.log('[migrateCompanySaasToAsaas] migration started', { corrId, company_id, asaas_sub: subscription.id, latency_ms: Date.now() - startedAt });
    return Response.json({
      success: true,
      migration_status: 'pending_first_payment',
      asaas_customer_id: asaasCustomerId,
      asaas_subscription_id: subscription.id,
      asaas_payment_link_url: firstInvoiceUrl,
      stripe_pending_cancellation_at: pendingCancellationAt,
      message: 'Migração iniciada. Stripe continua ativo até o primeiro pagamento Asaas ser confirmado.',
    });
  } catch (err) {
    console.error('[migrateCompanySaasToAsaas] fatal', { corrId, msg: err.message, stack: err.stack });
    return Response.json({ error: err?.code || 'internal_error', message: err?.message }, { status: err?.status || 500 });
  }
});

async function markFailedAndRespond(sdk, company, user, corrId, ip, err, errorCode) {
  try {
    await sdk.entities.Company.update(company.id, {
      migration_status: 'failed',
    });
  } catch {}
  try {
    await sdk.entities.AdminAuditLog.create({
      actor: user?.email || 'system',
      actor_role: user?.role === 'super_admin' ? 'super_admin' : 'admin',
      company_id: company.id,
      target_entity: 'Company', target_id: company.id,
      action: 'SUBSCRIPTION_CHANGED',
      before: { migration_status: company.migration_status || 'not_migrated' },
      after: { migration_status: 'failed' },
      severity: 'critical',
      metadata: { corrId, error_code: errorCode, error_message: err?.message, action_subtype: 'saas_migration_failed' },
      ip, request_id: corrId,
    });
  } catch {}
  return Response.json({
    error: errorCode,
    message: err?.message || 'Falha durante a migração. Stripe permanece intacto.',
    migration_status: 'failed',
  }, { status: err?.status || 502 });
}

function buildMigrationEmail({ ownerName, businessName, planName, invoiceUrl, appUrl }) {
  return `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width:560px; margin:0 auto; padding:24px; color:#0F172A;">
      <h1 style="font-size:22px; margin:0 0 16px;">Olá, ${escape(ownerName)} 👋</h1>
      <p style="font-size:15px; line-height:1.6; color:#334155;">
        Estamos atualizando o sistema de cobrança do <strong>${escape(businessName || 'O CORTE')}</strong> para nossa nova plataforma <strong>Asaas</strong> — mais flexibilidade de pagamento (PIX, boleto e cartão na mesma fatura) e menos taxas.
      </p>
      <div style="background:#F1F5F9; border-radius:12px; padding:16px; margin:20px 0;">
        <p style="margin:0 0 6px; font-size:13px; color:#64748B; text-transform:uppercase; letter-spacing:0.5px;"><strong>O que muda</strong></p>
        <ul style="margin:0; padding-left:20px; font-size:14px; line-height:1.7; color:#0F172A;">
          <li>Plano: <strong>${escape(planName)}</strong> — mesmo valor, mesmo benefício.</li>
          <li>Sua próxima fatura virá pelo Asaas, com link para pagar via PIX, boleto ou cartão.</li>
          <li><strong>O sistema continua funcionando normalmente.</strong> Você não precisa fazer nada agora.</li>
          <li>Sua cobrança atual no Stripe será encerrada automaticamente assim que recebermos seu primeiro pagamento pelo Asaas — sem cobrança em duplicidade.</li>
        </ul>
      </div>
      ${invoiceUrl ? `
        <p style="font-size:15px; line-height:1.6; color:#334155;">Quer adiantar e já configurar sua próxima cobrança?</p>
        <p style="margin:16px 0;">
          <a href="${escape(invoiceUrl)}" style="display:inline-block; background:#2563EB; color:#fff; padding:12px 24px; border-radius:10px; text-decoration:none; font-weight:600; font-size:14px;">
            Configurar pagamento Asaas
          </a>
        </p>
      ` : ''}
      <p style="font-size:13px; color:#64748B; line-height:1.6; margin-top:24px;">
        Em caso de dúvidas, responda este email — estamos por aqui.
        ${appUrl ? `<br><a href="${escape(appUrl)}" style="color:#2563EB;">${escape(appUrl)}</a>` : ''}
      </p>
      <p style="font-size:12px; color:#94A3B8; margin-top:32px; border-top:1px solid #E2E8F0; padding-top:16px;">
        O CORTE — Sistema de gestão para barbearias.
      </p>
    </div>
  `;
}

function escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}