// chargeAsaasSaasWithCard — checkout NATIVO da assinatura SaaS da barbearia.
//
// Substitui o redirecionamento para a tela hospedada do Asaas (invoiceUrl) por
// uma tokenização inline: o formulário do app envia os dados do cartão →
// criamos/buscamos Customer no Asaas → criamos Subscription mensal com
// creditCard + creditCardHolderInfo (Asaas tokeniza, guarda token e cobra
// automaticamente nos próximos ciclos).
//
// Reusa toda a lógica de createAsaasSaasCheckout (customer dedup, criação da
// Company local, atribuição de referral). A única diferença é o billingType
// fixo em CREDIT_CARD + payload com dados do cartão.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLANS = {
  starter:    { name: 'Starter',    price: 97 },
  pro:        { name: 'Pro',        price: 197 },
  enterprise: { name: 'Enterprise', price: 397 },
};

const TRIAL_DAYS = 7;

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

function extractErr(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.slice(0, 200);
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.map(e => e?.description || e?.code).filter(Boolean).join('; ');
  }
  return data?.message || data?.error || null;
}

async function asaasFetch(method, path, { body, query, idempotencyKey } = {}) {
  const cfg = getAsaasConfig();
  if (!cfg.isConfigured) {
    const err = new Error('ASAAS_API_KEY not configured');
    err.code = 'asaas_not_configured'; err.status = 503; throw err;
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
    'User-Agent': 'OCorte-SaaS/1.0 (+saas-card-native)',
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
    if (err.name === 'AbortError') {
      const e = new Error('Tempo esgotado ao contatar o Asaas. Tente novamente.');
      e.code = 'asaas_timeout'; e.status = 504; throw e;
    }
    const e = new Error(err.message || 'network'); e.code = 'asaas_network'; e.status = 502; throw e;
  }
}

function nextBillingDate(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 86400_000);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const body = await req.json().catch(() => ({}));
    const {
      plan,
      business_name,
      owner_name,
      email,
      phone,
      cpf_cnpj,
      card,
      referral_code,
      referral_fingerprint,
    } = body;

    // ─── Validação ──
    if (!plan || !PLANS[plan]) return Response.json({ error: 'invalid_plan', message: 'Plano inválido' }, { status: 400 });
    if (!business_name?.trim()) return Response.json({ error: 'business_name_required', message: 'Nome da barbearia obrigatório' }, { status: 400 });
    if (!owner_name?.trim()) return Response.json({ error: 'owner_name_required', message: 'Nome do responsável obrigatório' }, { status: 400 });
    if (!email?.trim() || !email.includes('@')) return Response.json({ error: 'invalid_email', message: 'Email inválido' }, { status: 400 });
    const phoneNorm = sanitizePhone(phone);
    if (!phoneNorm) return Response.json({ error: 'invalid_phone', message: 'Telefone inválido' }, { status: 400 });
    const cpfNorm = sanitizeCpfCnpj(cpf_cnpj);
    if (!cpfNorm) return Response.json({ error: 'invalid_cpf_cnpj', message: 'CPF ou CNPJ inválido' }, { status: 400 });

    if (!card?.number || !card?.holderName || !card?.expiryMonth || !card?.expiryYear || !card?.ccv) {
      return Response.json({ error: 'invalid_card', message: 'Dados do cartão incompletos.' }, { status: 400 });
    }
    if (!card.postalCode || !card.addressNumber) {
      return Response.json({ error: 'invalid_holder', message: 'Informe CEP e número do endereço.' }, { status: 400 });
    }

    const planMeta = PLANS[plan];
    const emailLc = email.trim().toLowerCase();

    // ─── 1. Customer Asaas (dedup por externalReference=email) ──
    let asaasCustomerId = null;
    try {
      const found = await asaasFetch('GET', '/customers', { query: { externalReference: emailLc, limit: 1 } });
      if (found?.data?.[0]?.id) asaasCustomerId = found.data[0].id;
    } catch (err) {
      console.warn(`[saasCard ${rid}] customer lookup failed:`, err.message);
    }
    if (!asaasCustomerId) {
      try {
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
      } catch (err) {
        return Response.json({ error: err.code || 'asaas_error', message: err.message }, { status: err.status || 502 });
      }
    }
    if (!asaasCustomerId) {
      return Response.json({ error: 'asaas_customer_error', message: 'Falha ao criar cliente no Asaas' }, { status: 502 });
    }

    // ─── 2. Subscription mensal com cartão tokenizado ──
    // nextDueDate = hoje + 7 dias → trial 7 dias (não cobra hoje, primeira fatura
    // sai no dia 7). Como mandamos creditCard + creditCardHolderInfo, o Asaas
    // tokeniza o cartão agora e cobra automaticamente nos próximos ciclos.
    const nextDue = nextBillingDate(TRIAL_DAYS);
    const subscriptionPayload = {
      customer: asaasCustomerId,
      billingType: 'CREDIT_CARD',
      cycle: 'MONTHLY',
      value: planMeta.price,
      nextDueDate: nextDue,
      description: `O CORTE — ${planMeta.name} (assinatura mensal)`,
      externalReference: `saas:${emailLc}:${plan}`,
      creditCard: {
        holderName: card.holderName,
        number: digitsOnly(card.number),
        expiryMonth: String(card.expiryMonth).padStart(2, '0'),
        expiryYear: String(card.expiryYear),
        ccv: String(card.ccv),
      },
      creditCardHolderInfo: {
        name: card.holderName,
        email: card.email || emailLc,
        cpfCnpj: digitsOnly(card.cpfCnpj || cpfNorm),
        postalCode: digitsOnly(card.postalCode),
        addressNumber: String(card.addressNumber),
        phone: phoneNorm,
      },
      remoteIp: ip,
    };

    let subscription;
    try {
      subscription = await asaasFetch('POST', '/subscriptions', {
        idempotencyKey: `sub_card:${emailLc}:${plan}`,
        body: subscriptionPayload,
      });
    } catch (err) {
      // 409 = já existe subscription com mesma externalReference (cliente já iniciou
      // checkout antes, p.ex. tentou PIX e agora está tentando cartão). Recuperamos
      // a assinatura existente em vez de falhar.
      if (err.status === 409) {
        try {
          const existingSub = await asaasFetch('GET', '/subscriptions', {
            query: { customer: asaasCustomerId, limit: 10 },
          });
          const match = existingSub?.data?.find(s => s.externalReference === `saas:${emailLc}:${plan}`)
            || existingSub?.data?.[0];
          if (match?.id) {
            console.log(`[saasCard ${rid}] recovered existing subscription:`, match.id);
            subscription = match;
          } else {
            throw err;
          }
        } catch (lookupErr) {
          console.error(`[saasCard ${rid}] lookup after 409 failed:`, lookupErr.message);
          throw err;
        }
      } else {
        const detailMsg = extractErr(err.details);
        console.warn(`[saasCard ${rid}] subscription failed:`, err.message, JSON.stringify(err.details || {}));
        return Response.json({
          error: err.code || 'card_declined',
          message: detailMsg || err.message || 'Cartão recusado. Verifique os dados ou tente outro.',
        }, { status: 402 });
      }
    }

    if (!subscription?.id) {
      return Response.json({ error: 'asaas_subscription_error', message: 'Falha ao criar assinatura no Asaas' }, { status: 502 });
    }

    // ─── 3. Cria/atualiza Company local ──
    const existing = await sdk.entities.Company.filter({ owner_email: emailLc }, '-created_date', 1).catch(() => []);
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400_000).toISOString();
    const companyPayload = {
      name: business_name.trim(),
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
      asaas_account_status: 'active', // cartão validado
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt,
    };

    let company = existing?.[0];
    if (company) {
      await sdk.entities.Company.update(company.id, companyPayload).catch(err => {
        console.error(`[saasCard ${rid}] company update failed:`, err.message);
      });
    } else {
      company = await sdk.entities.Company.create(companyPayload).catch(err => {
        console.error(`[saasCard ${rid}] company create failed:`, err.message);
        return null;
      });
    }

    // ─── 4. Atribui referral (se vier do partner program) ──
    if (referral_code && company?.id) {
      try {
        await base44.functions.invoke('partnerAttribute', {
          referral_code,
          referral_fingerprint: referral_fingerprint || '',
          company_id: company.id,
          email: emailLc,
        });
      } catch (err) {
        console.warn(`[saasCard ${rid}] partnerAttribute non-fatal:`, err.message);
      }
    }

    return Response.json({
      success: true,
      asaas_customer_id: asaasCustomerId,
      asaas_subscription_id: subscription.id,
      company_id: company?.id || null,
      trial_ends_at: trialEndsAt,
      plan_name: planMeta.name,
      message: 'Assinatura criada com sucesso. 7 dias grátis começam agora.',
    });
  } catch (err) {
    console.error(`[chargeAsaasSaasWithCard ${rid}] INTERNAL:`, err?.message, err?.stack);
    return Response.json({
      error: err?.code || 'internal_error',
      message: err?.message || 'Erro ao processar pagamento',
    }, { status: err?.status || 500 });
  }
});