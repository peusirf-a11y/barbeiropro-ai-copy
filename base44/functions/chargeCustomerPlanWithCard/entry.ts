// chargeCustomerPlanWithCard — substitui createAsaasCustomerPlanCheckout para
// fluxo de pagamento de plano com cartão.
//
// Em vez de mandar o cliente para o invoiceUrl hospedado do Asaas, recebemos
// os dados do cartão direto pelo formulário inline (tokenização nativa) e:
//   1. Criamos/encontramos Customer Asaas (com CPF)
//   2. Criamos a Subscription mensal com creditCardToken já vinculado
//   3. Asaas cobra a primeira fatura na hora; próximas cobranças são automáticas
//
// Reusa boa parte da lógica de createAsaasCustomerPlanCheckout.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

async function asaasFetch(method, path, { body, query, idempotencyKey } = {}) {
  const cfg = getAsaasConfig();
  if (!cfg.isConfigured) { const e = new Error('ASAAS_API_KEY not configured'); e.code = 'asaas_not_configured'; e.status = 503; throw e; }
  let url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v != null) qs.append(k, String(v));
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'access_token': cfg.apiKey,
    'User-Agent': 'OCorte-SaaS/1.0 (+plan-card-native)',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    clearTimeout(t);
    const txt = await res.text();
    let data = null;
    if (txt) { try { data = JSON.parse(txt); } catch { data = txt; } }
    if (!res.ok) {
      const e = new Error(extractErr(data) || `HTTP ${res.status}`);
      e.code = res.status === 401 ? 'asaas_unauthorized' : res.status === 400 ? 'asaas_bad_request' : 'asaas_error';
      e.status = res.status; e.details = data;
      throw e;
    }
    return data;
  } catch (err) {
    clearTimeout(t);
    if (err.code) throw err;
    if (err.name === 'AbortError') { const e = new Error('Tempo esgotado ao contatar o Asaas. Tente novamente.'); e.code = 'asaas_timeout'; e.status = 504; throw e; }
    const e = new Error(err.message || 'network'); e.code = 'asaas_network'; e.status = 502; throw e;
  }
}

function extractErr(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.slice(0, 200);
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors.map(e => e?.description || e?.code).filter(Boolean).join('; ');
  return data?.message || data?.error || null;
}

async function authenticateCustomer(sdk, { company_id, token }) {
  if (!token) return null;
  const list = await sdk.entities.Customer.filter({ company_id, auth_token: token });
  const customer = list[0];
  if (!customer) return null;
  if (customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) < new Date()) return null;
  return customer;
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const body = await req.json().catch(() => ({}));
    const { company_id, token, plan_id, subscription_id: resumeSubId, card } = body;

    if (!company_id || !plan_id) return Response.json({ error: 'missing_params' }, { status: 400 });
    if (!card?.number || !card?.holderName || !card?.expiryMonth || !card?.expiryYear || !card?.ccv) {
      return Response.json({ error: 'invalid_card', message: 'Dados do cartão incompletos.' }, { status: 400 });
    }
    if (!card.cpfCnpj || !card.postalCode || !card.addressNumber) {
      return Response.json({ error: 'invalid_holder', message: 'Informe CPF, CEP e número do endereço.' }, { status: 400 });
    }

    const customer = await authenticateCustomer(sdk, { company_id, token });
    if (!customer) return Response.json({ error: 'unauthorized', message: 'Sessão expirada. Faça login novamente.' }, { status: 401 });

    // Anti-duplicidade (exceto resume).
    const existing = await sdk.entities.CustomerSubscription.filter({ company_id, customer_id: customer.id });
    const blocking = existing.find(s => ['active', 'pending_payment', 'paused'].includes(s.status));
    let resumeSub = null;
    if (blocking) {
      const isResumable = resumeSubId && blocking.id === resumeSubId
        && blocking.status === 'pending_payment' && blocking.plan_id === plan_id;
      if (!isResumable) {
        return Response.json({ error: 'already_subscribed', message: 'Você já possui uma assinatura ativa ou pendente.' }, { status: 409 });
      }
      resumeSub = blocking;
    }

    // Plano + Empresa
    const plans = await sdk.entities.CustomerPlan.filter({ id: plan_id, company_id });
    const plan = plans[0];
    if (!plan || !plan.active) return Response.json({ error: 'plan_not_found' }, { status: 404 });
    if (!plan.price_monthly || Number(plan.price_monthly) <= 0) return Response.json({ error: 'invalid_price' }, { status: 400 });

    const v = plan.visibility || 'public';
    const allowed = Array.isArray(plan.allowed_customer_ids) ? plan.allowed_customer_ids : [];
    if (!(v === 'public' || (v === 'private' && allowed.includes(customer.id)))) {
      return Response.json({ error: 'forbidden', message: 'Plano não disponível.' }, { status: 403 });
    }

    const company = await sdk.entities.Company.get(company_id);
    if (!company) return Response.json({ error: 'company_not_found' }, { status: 404 });

    const cpfNorm = sanitizeCpfCnpj(card.cpfCnpj);
    if (!cpfNorm) return Response.json({ error: 'cpf_required', message: 'CPF inválido.' }, { status: 400 });
    const phoneNorm = sanitizePhone(card.phone || customer.phone) || undefined;

    // ─── Customer Asaas ────────────────────────────────────────────
    const customerExtRef = `cust:${company_id}:${customer.id}`;
    let asaasCustomerId = resumeSub?.asaas_customer_id || null;
    if (!asaasCustomerId) {
      try {
        const found = await asaasFetch('GET', '/customers', { query: { externalReference: customerExtRef, limit: 1 } });
        if (found?.data?.[0]?.id) asaasCustomerId = found.data[0].id;
      } catch (err) { console.warn(`[planCard ${rid}] customer lookup:`, err.message); }
    }
    if (!asaasCustomerId) {
      try {
        const created = await asaasFetch('POST', '/customers', {
          idempotencyKey: `cp_cust:${customer.id}`,
          body: {
            name: customer.name,
            email: customer.email || undefined,
            cpfCnpj: cpfNorm,
            mobilePhone: phoneNorm,
            externalReference: customerExtRef,
            notificationDisabled: false,
          },
        });
        asaasCustomerId = created?.id;
      } catch (err) {
        return Response.json({ error: err.code || 'asaas_error', message: err.message }, { status: err.status || 502 });
      }
    }

    // ─── CustomerSubscription local (reuse ou cria pending_payment) ─
    const now = new Date();
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
    const isUnlimited = plan.type === 'unlimited';

    const sub = resumeSub || await sdk.entities.CustomerSubscription.create({
      company_id,
      customer_id: customer.id,
      plan_id: plan.id,
      plan_name_snapshot: plan.name,
      plan_price_snapshot: plan.price_monthly,
      plan_type_snapshot: plan.type,
      plan_usage_limit_snapshot: isUnlimited ? 9999 : (plan.usage_limit || 0),
      status: 'pending_payment',
      started_at: now.toISOString(),
      current_cycle_start: now.toISOString(),
      current_cycle_end: cycleEnd,
      uses_remaining: isUnlimited ? 9999 : (plan.usage_limit || 0),
      uses_consumed_total: 0,
      last_payment_status: 'pendente',
      self_service_signup: true,
      asaas_customer_id: asaasCustomerId,
    });

    // ─── Asaas Subscription com cartão tokenizado ───────────────────
    // Quando passamos `creditCard` + `creditCardHolderInfo`, o Asaas tokeniza
    // o cartão, cobra a primeira fatura imediatamente e guarda o token para
    // cobranças recorrentes (mensais).
    const todayYmd = now.toISOString().slice(0, 10);
    const subscriptionPayload = {
      customer: asaasCustomerId,
      billingType: 'CREDIT_CARD',
      cycle: 'MONTHLY',
      value: Number(plan.price_monthly),
      nextDueDate: todayYmd,
      description: `${plan.name} — ${company.name}`,
      externalReference: `customerPlan:${sub.id}`,
      creditCard: {
        holderName: card.holderName,
        number: digitsOnly(card.number),
        expiryMonth: String(card.expiryMonth).padStart(2, '0'),
        expiryYear: String(card.expiryYear),
        ccv: String(card.ccv),
      },
      creditCardHolderInfo: {
        name: card.holderName,
        email: card.email || customer.email || 'cliente@semcadastro.com',
        cpfCnpj: cpfNorm,
        postalCode: digitsOnly(card.postalCode),
        addressNumber: String(card.addressNumber),
        phone: phoneNorm,
      },
      remoteIp: ip,
    };

    if (company.asaas_subaccount_id) {
      const pct = Number.isFinite(Number(company.asaas_split_percentage)) ? Number(company.asaas_split_percentage) : 100;
      subscriptionPayload.split = [{ walletId: company.asaas_subaccount_id, percentualValue: pct }];
    }

    let asaasSub;
    try {
      asaasSub = await asaasFetch('POST', '/subscriptions', {
        idempotencyKey: `cp_sub_card:${sub.id}`,
        body: subscriptionPayload,
      });
    } catch (err) {
      if (!resumeSub) {
        await sdk.entities.CustomerSubscription.update(sub.id, { status: 'canceled', canceled_at: new Date().toISOString() }).catch(() => {});
      }
      const detailMsg = extractErr(err.details);
      console.warn(`[planCard ${rid}] subscription failed:`, err.message, JSON.stringify(err.details || {}));
      return Response.json({
        error: err.code || 'card_declined',
        message: detailMsg || err.message || 'Cartão recusado. Verifique os dados ou tente outro.',
      }, { status: 402 });
    }

    // Atualiza sub local: já ativa (cartão à vista cobra imediatamente).
    await sdk.entities.CustomerSubscription.update(sub.id, {
      asaas_subscription_id: asaasSub.id,
      asaas_customer_id: asaasCustomerId,
      status: 'active',
      last_payment_status: 'pago',
      last_payment_at: now.toISOString(),
    }).catch(() => {});

    return Response.json({
      success: true,
      subscription_id: sub.id,
      asaas_subscription_id: asaasSub.id,
      status: 'active',
    });
  } catch (err) {
    console.error('[chargeCustomerPlanWithCard] INTERNAL:', err?.message, err?.stack);
    return Response.json({ error: 'INTERNAL_ERROR', message: err?.message }, { status: 500 });
  }
});