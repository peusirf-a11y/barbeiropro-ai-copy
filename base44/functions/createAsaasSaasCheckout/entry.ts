// createAsaasSaasCheckout — substitui createCheckoutSession (Stripe) na assinatura SaaS.
//
// Fluxo:
//   1. Recebe { plan: starter|pro|enterprise, business_name, owner_name, email, phone, cpf_cnpj, referral_code, referral_fingerprint, payment_method? }
//   2. Cria/recupera Customer na conta master Asaas (idempotência via externalReference = email)
//   3. Cria Subscription recorrente mensal (PIX/BOLETO/CREDIT_CARD/UNDEFINED)
//   4. Cria/atualiza Company local com plano + asaas_customer_id + asaas_subscription_id (trial 7 dias)
//   5. Devolve URL da invoice (página de pagamento Asaas) — frontend redireciona
//
// IMPORTANTE: como cada function é deploy isolado, o cliente HTTP Asaas é inlinado aqui.
// Espelha lib/asaas/client.js — manter os dois em sync se mudar protocolo.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLANS = {
  starter:    { name: 'Starter',    price: 97 },
  pro:        { name: 'Pro',        price: 197 },
  enterprise: { name: 'Enterprise', price: 397 },
};

const TRIAL_DAYS = 7;

// ─── Asaas HTTP client (inline) ──────────────────────────────────────
function getAsaasConfig() {
  const apiKey = Deno.env.get('ASAAS_API_KEY');
  const environment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
  const baseUrl = Deno.env.get('ASAAS_BASE_URL')
    || (environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
  return { apiKey, baseUrl, environment, isConfigured: !!apiKey };
}

function digitsOnly(v) { return String(v || '').replace(/\D+/g, ''); }
function sanitizeCpfCnpj(v) {
  const d = digitsOnly(v);
  return (d.length === 11 || d.length === 14) ? d : null;
}
function sanitizePhone(v) {
  const d = digitsOnly(v);
  return (d.length >= 10 && d.length <= 13) ? d : null;
}

function genCorrId() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

async function asaasFetch(method, path, { body, query, idempotencyKey } = {}) {
  const cfg = getAsaasConfig();
  if (!cfg.isConfigured) {
    const err = new Error('ASAAS_API_KEY not configured');
    err.code = 'asaas_not_configured';
    err.status = 503;
    throw err;
  }
  let url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (query && typeof query === 'object') {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const corrId = genCorrId();
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'access_token': cfg.apiKey,
    'User-Agent': 'OCorte-SaaS/1.0 (+saas-checkout)',
    'X-Correlation-Id': corrId,
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const txt = await res.text();
    let data = null;
    if (txt) { try { data = JSON.parse(txt); } catch { data = txt; } }
    const latency = Date.now() - startedAt;
    if (!res.ok) {
      const msg = extractErr(data) || `HTTP ${res.status}`;
      console.error('[createAsaasSaasCheckout] asaas error', { method, path, status: res.status, corr: corrId, msg, body_sample: body ? Object.keys(body) : null });
      const err = new Error(msg);
      err.code = res.status === 401 ? 'asaas_unauthorized' : res.status === 400 ? 'asaas_bad_request' : 'asaas_error';
      err.status = res.status;
      err.details = data;
      throw err;
    }
    console.log('[createAsaasSaasCheckout] asaas ok', { method, path, latency_ms: latency, corr: corrId });
    return data;
  } catch (err) {
    clearTimeout(t);
    if (err.code) throw err;
    if (err.name === 'AbortError') {
      const e = new Error('asaas timeout');
      e.code = 'asaas_timeout';
      e.status = 504;
      throw e;
    }
    const e = new Error(err.message || 'network error');
    e.code = 'asaas_network';
    e.status = 502;
    throw e;
  }
}

function extractErr(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.slice(0, 200);
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.map(e => e?.description || e?.code).filter(Boolean).join('; ');
  }
  return data?.message || data?.error || null;
}

function nextBillingDate(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 86400_000);
  // Asaas espera YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const {
      plan,
      business_name,
      owner_name,
      email,
      phone,
      cpf_cnpj,
      payment_method, // PIX | BOLETO | CREDIT_CARD | UNDEFINED (cliente escolhe na invoice)
      referral_code,
      referral_fingerprint,
    } = body;

    // Validações
    if (!plan || !PLANS[plan]) {
      return Response.json({ error: 'invalid_plan', message: 'Plano inválido' }, { status: 400 });
    }
    if (!business_name?.trim()) return Response.json({ error: 'business_name_required' }, { status: 400 });
    if (!owner_name?.trim()) return Response.json({ error: 'owner_name_required' }, { status: 400 });
    if (!email?.trim() || !email.includes('@')) return Response.json({ error: 'invalid_email' }, { status: 400 });
    const phoneNorm = sanitizePhone(phone);
    if (!phoneNorm) return Response.json({ error: 'invalid_phone', message: 'Telefone inválido' }, { status: 400 });
    const cpfNorm = sanitizeCpfCnpj(cpf_cnpj);
    if (!cpfNorm) return Response.json({ error: 'invalid_cpf_cnpj', message: 'CNPJ inválido' }, { status: 400 });
    const emailLcEarly = (email || '').trim().toLowerCase();
    // PJ-first policy (docs/PJ_ONLY_POLICY.md): cadastro automatizado bloqueado para CPF.
    if (cpfNorm.length === 11) {
      console.warn('[createAsaasSaasCheckout] blocked_pf_attempt', { email: emailLcEarly });
      return Response.json({
        error: 'pf_not_allowed',
        message: 'No momento, o cadastro automático está disponível apenas para empresas com CNPJ ou MEI. Fale com nossa equipe para avaliarmos sua ativação.',
      }, { status: 403 });
    }

    const allowedMethods = ['PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED'];
    const billingType = allowedMethods.includes(String(payment_method).toUpperCase())
      ? String(payment_method).toUpperCase()
      : 'UNDEFINED'; // default: cliente escolhe na página da fatura

    const planMeta = PLANS[plan];
    const emailLc = email.trim().toLowerCase();

    // ─── Step 1: Customer no Asaas ────────────────────────────────────
    // Usa externalReference = email pra idempotência. Se já existe, busca por GET.
    let asaasCustomerId = null;
    try {
      const found = await asaasFetch('GET', '/customers', {
        query: { externalReference: emailLc, limit: 1 },
      });
      if (found?.data?.[0]?.id) asaasCustomerId = found.data[0].id;
    } catch (err) {
      console.warn('[createAsaasSaasCheckout] customer lookup failed (will create):', err.message);
    }

    if (!asaasCustomerId) {
      const created = await asaasFetch('POST', '/customers', {
        idempotencyKey: `cust:${emailLc}`,
        body: {
          name: business_name.trim(),
          email: emailLc,
          cpfCnpj: cpfNorm,
          mobilePhone: phoneNorm,
          externalReference: emailLc,
          notificationDisabled: false,
        },
      });
      asaasCustomerId = created?.id;
      if (!asaasCustomerId) {
        return Response.json({ error: 'asaas_customer_error', message: 'Falha ao criar cliente no Asaas' }, { status: 502 });
      }
    }

    // ─── Step 2: Subscription mensal ────────────────────────────────
    // nextDueDate = hoje + 7 dias (cobre o trial). Asaas só gera a primeira invoice
    // nessa data, então o cliente NÃO paga hoje. O Customer entra em trial localmente
    // até a primeira invoice ser paga (webhook PAYMENT_CONFIRMED → status=active).
    const nextDue = nextBillingDate(TRIAL_DAYS);
    let subscription;
    try {
      subscription = await asaasFetch('POST', '/subscriptions', {
        idempotencyKey: `sub:${emailLc}:${plan}`,
        body: {
          customer: asaasCustomerId,
          billingType,
          cycle: 'MONTHLY',
          value: planMeta.price,
          nextDueDate: nextDue,
          description: `O CORTE — ${planMeta.name} (assinatura mensal)`,
          externalReference: `saas:${emailLc}:${plan}`,
        },
      });
    } catch (err) {
      // Asaas devolve 409 quando já existe subscription com a mesma externalReference
      // (ou mesma Idempotency-Key). Nesse caso, recuperamos a subscription existente
      // em vez de falhar — o cliente está apenas retomando um checkout iniciado antes.
      if (err.status === 409 || err.code === 'asaas_bad_request') {
        try {
          const existingSub = await asaasFetch('GET', '/subscriptions', {
            query: { customer: asaasCustomerId, limit: 10 },
          });
          const match = existingSub?.data?.find(s => s.externalReference === `saas:${emailLc}:${plan}`)
            || existingSub?.data?.[0];
          if (match?.id) {
            console.log('[createAsaasSaasCheckout] recovered existing subscription:', match.id);
            subscription = match;
          } else {
            throw err;
          }
        } catch (lookupErr) {
          console.error('[createAsaasSaasCheckout] lookup after 409 failed:', lookupErr.message);
          throw err;
        }
      } else {
        throw err;
      }
    }

    if (!subscription?.id) {
      return Response.json({ error: 'asaas_subscription_error', message: 'Falha ao criar assinatura no Asaas' }, { status: 502 });
    }

    // ─── Step 3: Busca a primeira invoice (para devolver invoiceUrl) ──
    // Asaas cria a primeira cobrança ao montar a Subscription. Buscar via /payments.
    let firstInvoiceUrl = null;
    let firstInvoiceId = null;
    try {
      const payments = await asaasFetch('GET', `/subscriptions/${subscription.id}/payments`, {
        query: { limit: 1 },
      });
      const p = payments?.data?.[0];
      if (p) {
        firstInvoiceUrl = p.invoiceUrl || p.bankSlipUrl || null;
        firstInvoiceId = p.id;
      }
    } catch (err) {
      console.warn('[createAsaasSaasCheckout] could not fetch first invoice (ok, cliente acessa via email):', err.message);
    }

    // ─── Step 4: Atualiza Company local ────────────────────────────
    // Procura company pelo owner_email. Se já existe (cliente refez checkout), atualiza.
    // Se não, cria com onboarding pendente — onboarding completa o resto.
    const existing = await sdk.entities.Company.filter({ owner_email: emailLc }, '-created_date', 1).catch(() => []);
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400_000).toISOString();
    const companyPayload = {
      name: business_name.trim(),
      slug: undefined, // onboarding define
      owner_email: emailLc,
      owner_name: owner_name.trim(),
      owner_cpf_cnpj: cpfNorm,
      phone: phoneNorm,
      plan_name: planMeta.name,
      status: 'trial',
      onboarding_completed: false,
      onboarding_step: 1,
      billing_provider: 'asaas',
      asaas_customer_id: asaasCustomerId,
      asaas_subscription_id: subscription.id,
      asaas_payment_link_url: firstInvoiceUrl || undefined,
      asaas_account_status: 'pending',
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt,
    };

    let company = existing?.[0];
    if (company) {
      await sdk.entities.Company.update(company.id, companyPayload).catch(err => {
        console.error('[createAsaasSaasCheckout] company update failed:', err.message);
      });
    } else {
      company = await sdk.entities.Company.create(companyPayload).catch(err => {
        console.error('[createAsaasSaasCheckout] company create failed:', err.message);
        return null;
      });
    }

    // ─── Step 5: Atribui referral (se vier do partner program) ─────
    if (referral_code && company?.id) {
      try {
        await base44.functions.invoke('partnerAttribute', {
          referral_code,
          referral_fingerprint: referral_fingerprint || '',
          company_id: company.id,
          email: emailLc,
        });
      } catch (err) {
        console.warn('[createAsaasSaasCheckout] partnerAttribute non-fatal:', err.message);
      }
    }

    // ─── Step 6: Email transacional de boas-vindas (fire-and-forget) ────
    // Não bloqueia a resposta do checkout. Idempotência, retry e EmailLog ficam
    // dentro de sendOnboardingWelcomeEmail.
    if (company?.id) {
      base44.asServiceRole.functions.invoke('sendOnboardingWelcomeEmail', { company_id: company.id })
        .catch(err => console.warn('[createAsaasSaasCheckout] welcome email dispatch failed:', err.message));
    }

    return Response.json({
      success: true,
      url: firstInvoiceUrl,
      invoice_id: firstInvoiceId,
      asaas_customer_id: asaasCustomerId,
      asaas_subscription_id: subscription.id,
      company_id: company?.id || null,
      trial_ends_at: trialEndsAt,
      plan_name: planMeta.name,
      message: firstInvoiceUrl
        ? 'Redirecionando para o pagamento'
        : 'Assinatura criada. Você receberá a fatura por email.',
    });
  } catch (err) {
    console.error('[createAsaasSaasCheckout] error:', err?.code, err?.message);
    return Response.json({
      error: err?.code || 'internal_error',
      message: err?.message || 'Erro ao criar assinatura',
    }, { status: err?.status || 500 });
  }
});