// createAsaasCustomerPlanCheckout — Etapa 2C
// Substitui createCustomerPlanCheckout (Stripe) para assinaturas de planos do cliente final.
//
// Modelo atual (sem split): recebimento concentrado na conta master Asaas da O CORTE.
// Repasse à barbearia é manual nesta fase.
//
// Preparação para split automático: se a Company tiver `asaas_subaccount_id` definido,
// o payload `split` é incluído na subscription. Quando subaccount Asaas estiver habilitada
// por barbearia (próxima sub-etapa), basta popular esse campo — código já lê.
//
// Método aceito: CREDIT_CARD apenas. Cliente preenche cartão na invoiceUrl do Asaas.
// Asaas tokeniza e cobra automaticamente nos próximos ciclos.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Asaas client (inline) ─────────────────────────────────────────
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
  if (!cfg.isConfigured) {
    const e = new Error('ASAAS_API_KEY not configured');
    e.code = 'asaas_not_configured'; e.status = 503; throw e;
  }
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
    'User-Agent': 'OCorte-SaaS/1.0 (+customer-plan)',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
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

// ─── Customer auth (espelha createCustomerPlanCheckout) ─────────────
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
    const body = await req.json().catch(() => ({}));
    const { company_id, token, plan_id, subscription_id: resumeSubId, success_url } = body;

    if (!company_id || !plan_id) return Response.json({ error: 'missing_params' }, { status: 400 });

    const customer = await authenticateCustomer(sdk, { company_id, token });
    if (!customer) return Response.json({ error: 'unauthorized', message: 'Sessão expirada. Faça login novamente.' }, { status: 401 });

    // Anti-duplicidade (exceto resume de pending_payment do mesmo plano).
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

    // Plano
    const plans = await sdk.entities.CustomerPlan.filter({ id: plan_id, company_id });
    const plan = plans[0];
    if (!plan || !plan.active) return Response.json({ error: 'plan_not_found' }, { status: 404 });
    if (!plan.price_monthly || Number(plan.price_monthly) <= 0) {
      return Response.json({ error: 'invalid_price' }, { status: 400 });
    }

    // Gate de visibilidade (igual createCustomerPlanCheckout).
    const v = plan.visibility || 'public';
    const allowed = Array.isArray(plan.allowed_customer_ids) ? plan.allowed_customer_ids : [];
    const isAllowed = v === 'public' || (v === 'private' && allowed.includes(customer.id));
    if (!isAllowed) {
      try {
        await sdk.entities.SecurityEvent.create({
          event_type: 'unauthorized_plan_access', severity: 'high',
          company_id, actor_email: customer.email || '',
          route: 'createAsaasCustomerPlanCheckout',
          details: { plan_id, plan_visibility: v }, blocked: true,
        });
      } catch {}
      return Response.json({ error: 'forbidden', message: 'Plano não disponível.' }, { status: 403 });
    }

    // Empresa
    const company = await sdk.entities.Company.get(company_id);
    if (!company) return Response.json({ error: 'company_not_found' }, { status: 404 });

    // CPF/telefone do cliente (Asaas exige cpfCnpj no Customer).
    const cpfNorm = sanitizeCpfCnpj(customer.cpf_cnpj || body.customer_cpf);
    if (!cpfNorm) {
      return Response.json({
        error: 'cpf_required',
        message: 'Para assinar pelo cartão precisamos do seu CPF. Volte ao seu perfil e cadastre.',
      }, { status: 400 });
    }
    const phoneNorm = sanitizePhone(customer.phone) || undefined;

    // ─── Customer Asaas ────────────────────────────────────────────
    const customerExtRef = `cust:${company_id}:${customer.id}`;
    let asaasCustomerId = resumeSub?.asaas_customer_id || null;
    if (!asaasCustomerId) {
      try {
        const found = await asaasFetch('GET', '/customers', { query: { externalReference: customerExtRef, limit: 1 } });
        if (found?.data?.[0]?.id) asaasCustomerId = found.data[0].id;
      } catch (err) { console.warn(`[asaasCustomerPlan ${rid}] customer lookup:`, err.message); }
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

    // ─── Asaas Subscription (cartão, mensal) ────────────────────────
    // externalReference = customerPlan:<sub_id> → webhook resolve via filter.
    const todayYmd = now.toISOString().slice(0, 10);
    const subscriptionPayload = {
      customer: asaasCustomerId,
      billingType: 'CREDIT_CARD',
      cycle: 'MONTHLY',
      value: Number(plan.price_monthly),
      nextDueDate: todayYmd,
      description: `${plan.name} — ${company.name}`,
      externalReference: `customerPlan:${sub.id}`,
    };

    // Preparação split: se a empresa já tem subaccount Asaas, repassa o valor.
    if (company.asaas_subaccount_id) {
      const pct = Number.isFinite(Number(company.asaas_split_percentage))
        ? Number(company.asaas_split_percentage) : 100;
      subscriptionPayload.split = [{
        walletId: company.asaas_subaccount_id,
        percentualValue: pct,
      }];
    }

    let asaasSub = null;
    try {
      asaasSub = await asaasFetch('POST', '/subscriptions', {
        idempotencyKey: `cp_sub:${sub.id}`,
        body: subscriptionPayload,
      });
    } catch (err) {
      // Rollback: se criou agora, marca canceled (não deixa pending fantasma).
      if (!resumeSub) {
        await sdk.entities.CustomerSubscription.update(sub.id, { status: 'canceled', canceled_at: new Date().toISOString() }).catch(() => {});
      }
      return Response.json({ error: err.code || 'asaas_error', message: err.message }, { status: err.status || 502 });
    }

    // Pega a primeira fatura para mandar o cliente preencher o cartão.
    let invoiceUrl = null;
    try {
      const pays = await asaasFetch('GET', '/payments', { query: { subscription: asaasSub.id, limit: 1 } });
      const firstPay = pays?.data?.[0];
      invoiceUrl = firstPay?.invoiceUrl || null;
    } catch (err) {
      console.warn(`[asaasCustomerPlan ${rid}] invoice fetch warn:`, err.message);
    }

    await sdk.entities.CustomerSubscription.update(sub.id, {
      asaas_subscription_id: asaasSub.id,
      asaas_customer_id: asaasCustomerId,
      asaas_invoice_url: invoiceUrl || undefined,
    }).catch(() => {});

    if (!invoiceUrl) {
      return Response.json({
        error: 'no_invoice_url',
        message: 'Assinatura criada, mas não conseguimos abrir o cartão. Tente novamente em instantes.',
      }, { status: 502 });
    }

    return Response.json({
      success: true,
      url: invoiceUrl,
      subscription_id: sub.id,
      asaas_subscription_id: asaasSub.id,
    });
  } catch (error) {
    console.error('[createAsaasCustomerPlanCheckout] INTERNAL:', error?.message, error?.stack);
    return Response.json({ error: 'INTERNAL_ERROR', message: error?.message }, { status: 500 });
  }
});