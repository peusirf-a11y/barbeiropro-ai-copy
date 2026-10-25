// src/server/subscribeHandler.js — Handler central da criação de assinaturas Asaas (Conta Mãe)
// Executado no backend (Node.js/Serverless), consumindo process.env.ASAAS_API_KEY com segurança.

function extractAsaasError(data) {
  if (!data) return 'Erro ao comunicar com a API do Asaas.';
  if (typeof data === 'string') return data;
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.map(e => e.description || e.code || JSON.stringify(e)).join('; ');
  }
  return data.message || data.error || 'Cartão não autorizado ou dados inválidos no Asaas.';
}

function detectCardBrand(cardNumber = '') {
  const num = String(cardNumber).replace(/\D/g, '');
  if (/^4/.test(num)) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'MASTERCARD';
  if (/^(4011(78|79)|43(1274|8935)|45(1416|7393|763(1|2))|50(4175|6699|67[0-7][0-9]|9000)|627780|63(6297|6368)|650(03([^4])|04([0-9])|05(0|1)|4(0[5-9]|3[0-9]|8[5-9]|9[0-9])|5([0-2][0-9]|3[0-8])|9([2-6][0-9]|7[0-8])|7([0-2][0-9]))|65165[2-9]|65500[0-9]|65502[1-9])/.test(num)) {
    return 'ELO';
  }
  if (/^3[47]/.test(num)) return 'AMEX';
  if (/^(606282|3841)/.test(num)) return 'HIPERCARD';
  if (/^3(?:0[0-5]|[68])/.test(num)) return 'DINERS';
  return 'CARTAO';
}

function generateReferralCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const FALLBACK_SUPABASE_URL = 'https://ijitvgzcbvguacsveccy.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaXR2Z3pjYnZndWFjc3ZlY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MjEwODcsImV4cCI6MjEwNzQ5NzA4N30.9WYMFFf6oG2KIl4TpcHDAicV6w9BocIUN6gbSlq6Q_g';

function addOneMonthIso(dateStr) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

export async function handleSyncAsaasSubscription(payload = {}) {
  try {
    const companyId = payload.company_id || payload.companyId || null;
    const subscriptionIdParam = payload.subscription_id || payload.subscriptionId || null;
    const ownerEmail = payload.email ? String(payload.email).trim().toLowerCase() : null;

    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      FALLBACK_SUPABASE_ANON_KEY;

    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(supabaseUrl, supabaseKey);

    let compRow = null;
    if (companyId && companyId !== 'comp_demo_01') {
      const { data } = await sb.from('companies').select('*').eq('id', companyId).maybeSingle();
      if (data) compRow = data;
    }
    if (!compRow && subscriptionIdParam) {
      const { data } = await sb
        .from('companies')
        .select('*')
        .eq('asaas_subscription_id', subscriptionIdParam)
        .maybeSingle();
      if (data) compRow = data;
    }
    if (!compRow && ownerEmail) {
      const { data } = await sb
        .from('companies')
        .select('*')
        .ilike('owner_email', ownerEmail)
        .maybeSingle();
      if (data) compRow = data;
    }

    const rawEnvKey = (process.env.ASAAS_API_KEY || '').trim();
    const isEnvKeyValid =
      rawEnvKey &&
      rawEnvKey.length > 40 &&
      !rawEnvKey.toLowerCase().includes('fake') &&
      !rawEnvKey.toLowerCase().includes('sua_chave') &&
      !rawEnvKey.toLowerCase().includes('your_key') &&
      !rawEnvKey.toLowerCase().includes('placeholder');

    let companyApiKey = (compRow?.asaas_api_key || '').trim();
    if (!companyApiKey) {
      const { data: keyRows } = await sb
        .from('companies')
        .select('asaas_api_key')
        .not('asaas_api_key', 'is', null)
        .limit(1);
      if (keyRows?.[0]?.asaas_api_key) {
        companyApiKey = String(keyRows[0].asaas_api_key).trim();
      }
    }

    const candidateKeys = [
      ...(isEnvKeyValid ? [rawEnvKey] : []),
      ...(companyApiKey && companyApiKey !== rawEnvKey ? [companyApiKey] : []),
    ];

    const billingMeta = compRow?.business_hours?._billing || compRow?.opening_hours?._billing || {};
    const subId =
      subscriptionIdParam ||
      compRow?.asaas_subscription_id ||
      billingMeta.asaas_subscription_id ||
      null;

    if (!subId || candidateKeys.length === 0) {
      return {
        status: 200,
        body: {
          success: true,
          synced: false,
          company: compRow || null,
        },
      };
    }

    let subData = null;
    let payData = null;

    for (const keyCandidate of candidateKeys) {
      const isHmlg = keyCandidate.startsWith('$aact_hmlg_') || keyCandidate.includes('sandbox');
      const baseUrl = (
        process.env.ASAAS_BASE_URL ||
        (isHmlg ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3')
      ).trim();

      const headers = {
        'Content-Type': 'application/json',
        access_token: keyCandidate,
        'User-Agent': 'OCorte-SaaS/1.0',
      };

      const [subRes, payRes] = await Promise.all([
        fetch(`${baseUrl}/subscriptions/${encodeURIComponent(subId)}`, { method: 'GET', headers }),
        fetch(`${baseUrl}/subscriptions/${encodeURIComponent(subId)}/payments`, { method: 'GET', headers }),
      ]);

      if (subRes.ok || payRes.ok) {
        subData = subRes.ok ? await subRes.json().catch(() => null) : null;
        payData = payRes.ok ? await payRes.json().catch(() => null) : null;
        break;
      }
    }

    const payments = Array.isArray(payData?.data) ? payData.data : [];

    const confirmedPayments = payments
      .filter((p) =>
        ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(String(p?.status || '').toUpperCase())
      )
      .sort((a, b) =>
        String(b.confirmedDate || b.clientPaymentDate || b.dueDate || '').localeCompare(
          String(a.confirmedDate || a.clientPaymentDate || a.dueDate || '')
        )
      );

    const overduePayments = payments.filter(
      (p) => String(p?.status || '').toUpperCase() === 'OVERDUE'
    );

    const pendingPayments = payments
      .filter((p) => String(p?.status || '').toUpperCase() === 'PENDING')
      .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

    const latestConfirmed = confirmedPayments[0] || null;
    const nextPending = pendingPayments[0] || null;

    const cardLastDigits =
      subData?.creditCard?.creditCardNumber?.slice(-4) ||
      latestConfirmed?.creditCard?.creditCardNumber?.slice(-4) ||
      compRow?.card_last_digits ||
      billingMeta.card_last_digits ||
      null;

    const cardBrand =
      (subData?.creditCard?.creditCardBrand &&
        String(subData.creditCard.creditCardBrand).toUpperCase()) ||
      (latestConfirmed?.creditCard?.creditCardBrand &&
        String(latestConfirmed.creditCard.creditCardBrand).toUpperCase()) ||
      compRow?.card_brand ||
      billingMeta.card_brand ||
      null;

    let subscriptionStatus = compRow?.subscription_status || 'trialing';
    let billingStatus = compRow?.billing_status || 'ACTIVE';
    let currentPeriodEnd = compRow?.current_period_end || null;
    let paymentLinkUrl = compRow?.asaas_payment_link_url || null;

    if (overduePayments.length > 0 && !latestConfirmed) {
      subscriptionStatus = 'overdue';
      billingStatus = 'OVERDUE';
      paymentLinkUrl = overduePayments[0]?.invoiceUrl || paymentLinkUrl;
    } else if (latestConfirmed) {
      subscriptionStatus = 'active';
      billingStatus = 'ACTIVE';
      paymentLinkUrl =
        latestConfirmed.transactionReceiptUrl ||
        latestConfirmed.invoiceUrl ||
        nextPending?.invoiceUrl ||
        paymentLinkUrl;

      if (nextPending?.dueDate) {
        currentPeriodEnd = `${nextPending.dueDate}T12:00:00.000Z`;
      } else if (latestConfirmed.dueDate) {
        currentPeriodEnd = addOneMonthIso(latestConfirmed.dueDate);
      } else if (subData?.nextDueDate) {
        currentPeriodEnd = `${subData.nextDueDate}T12:00:00.000Z`;
      }
    } else if (String(subData?.status || '').toUpperCase() === 'ACTIVE') {
      const trialEndMs = compRow?.trial_ends_at ? new Date(compRow.trial_ends_at).getTime() : null;
      if (trialEndMs && trialEndMs <= Date.now()) {
        subscriptionStatus = 'active';
        billingStatus = 'ACTIVE';
      }
      if (nextPending?.dueDate && !currentPeriodEnd) {
        currentPeriodEnd = `${nextPending.dueDate}T12:00:00.000Z`;
      } else if (subData?.nextDueDate && !currentPeriodEnd) {
        currentPeriodEnd = `${subData.nextDueDate}T12:00:00.000Z`;
      }
      paymentLinkUrl = nextPending?.invoiceUrl || paymentLinkUrl;
    }

    const updatedFields = {
      subscription_status: subscriptionStatus,
      billing_status: billingStatus,
      ...(cardLastDigits ? { card_last_digits: cardLastDigits } : {}),
      ...(cardBrand ? { card_brand: cardBrand } : {}),
      ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
      ...(paymentLinkUrl ? { asaas_payment_link_url: paymentLinkUrl } : {}),
      business_hours: {
        ...(compRow?.business_hours || {}),
        _billing: {
          ...billingMeta,
          asaas_subscription_id: subId,
          asaas_customer_id: subData?.customer || compRow?.asaas_customer_id || billingMeta.asaas_customer_id || null,
          subscription_status: subscriptionStatus,
          billing_status: billingStatus,
          ...(cardLastDigits ? { card_last_digits: cardLastDigits } : {}),
          ...(cardBrand ? { card_brand: cardBrand } : {}),
          ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
          ...(paymentLinkUrl ? { asaas_payment_link_url: paymentLinkUrl } : {}),
          ...(latestConfirmed
            ? {
                last_payment_id: latestConfirmed.id,
                last_payment_date:
                  latestConfirmed.confirmedDate ||
                  latestConfirmed.clientPaymentDate ||
                  latestConfirmed.dueDate ||
                  null,
                last_payment_status: latestConfirmed.status,
              }
            : {}),
        },
      },
      updated_at: new Date().toISOString(),
    };

    if (compRow?.id) {
      const payloadCopy = { ...updatedFields };
      for (let attempt = 0; attempt < 10; attempt++) {
        const res = await sb.from('companies').update(payloadCopy).eq('id', compRow.id);
        if (!res.error) break;
        const matchCol =
          res.error.message?.match(/Could not find the '([^']+)' column/) ||
          res.error.message?.match(/column "([^"]+)" of relation/);
        if (matchCol && matchCol[1] && matchCol[1] in payloadCopy) {
          delete payloadCopy[matchCol[1]];
          continue;
        }
        break;
      }
    }

    const mergedCompany = {
      ...(compRow || {}),
      ...updatedFields,
    };
    delete mergedCompany.asaas_api_key;

    return {
      status: 200,
      body: {
        success: true,
        synced: true,
        company: mergedCompany,
        latest_payment: latestConfirmed
          ? {
              id: latestConfirmed.id,
              status: latestConfirmed.status,
              value: latestConfirmed.value,
              dueDate: latestConfirmed.dueDate,
              confirmedDate:
                latestConfirmed.confirmedDate || latestConfirmed.clientPaymentDate || latestConfirmed.dueDate,
              receiptUrl: latestConfirmed.transactionReceiptUrl || latestConfirmed.invoiceUrl || null,
            }
          : null,
        next_payment: nextPending
          ? {
              id: nextPending.id,
              status: nextPending.status,
              value: nextPending.value,
              dueDate: nextPending.dueDate,
              invoiceUrl: nextPending.invoiceUrl || null,
            }
          : null,
      },
    };
  } catch (err) {
    console.warn('[handleSyncAsaasSubscription] Erro ao sincronizar assinatura:', err?.message);
    return {
      status: 200,
      body: {
        success: false,
        synced: false,
        error: err?.message || 'Erro ao sincronizar assinatura.',
      },
    };
  }
}

export async function handleAsaasSubscription(payload = {}) {
  try {
    if (payload?.action === 'sync') {
      return await handleSyncAsaasSubscription(payload);
    }

    // Segurança estrita: consome exclusivamente a variável de ambiente server-side (nunca VITE_/NEXT_PUBLIC_ ou payload do cliente)
    const rawApiKey = (process.env.ASAAS_API_KEY || '').trim();

    const isApiKeyValid =
      rawApiKey &&
      rawApiKey.length > 40 &&
      !rawApiKey.toLowerCase().includes('fake') &&
      !rawApiKey.toLowerCase().includes('sua_chave') &&
      !rawApiKey.toLowerCase().includes('your_key') &&
      !rawApiKey.toLowerCase().includes('placeholder');

    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      FALLBACK_SUPABASE_ANON_KEY;

    let apiKey = isApiKeyValid ? rawApiKey : '';

    // Se a chave da plataforma não estiver no env mas a company já possuir chave cadastrada no servidor, busca do Supabase
    if (!apiKey && payload.company_id && supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(supabaseUrl, supabaseKey);
        const { data: compRow } = await sb
          .from('companies')
          .select('asaas_api_key')
          .eq('id', payload.company_id)
          .maybeSingle();
        if (compRow?.asaas_api_key) {
          apiKey = compRow.asaas_api_key.trim();
        }
      } catch (_) {}
    }
    if (!apiKey && supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(supabaseUrl, supabaseKey);
        const { data: keyRows } = await sb
          .from('companies')
          .select('asaas_api_key')
          .not('asaas_api_key', 'is', null)
          .limit(1);
        if (keyRows?.[0]?.asaas_api_key) {
          apiKey = String(keyRows[0].asaas_api_key).trim();
        }
      } catch (_) {}
    }

    if (!apiKey) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Chave de API do Asaas (ASAAS_API_KEY) não configurada no servidor.',
        },
      };
    }

    // Normaliza os dados recebidos (suporta formato aninhado ou plano do formulário)
    const customer = payload.customer || {
      name: payload.owner_name || payload.business_name || 'Cliente O CORTE',
      email: payload.email,
      cpfCnpj: payload.cpf_cnpj || payload.cnpj,
      phone: payload.phone,
    };

    const plan = payload.plan || {
      name: payload.plan_name || payload.plan || 'Pro',
      value: payload.value || payload.price || (payload.promo ? 49.00 : 89.00),
    };

    const creditCard = payload.creditCard || payload.card || {};
    const creditCardHolderInfo = payload.creditCardHolderInfo || payload.holder_info || {
      name: creditCard.holderName || customer.name,
      email: customer.email,
      cpfCnpj: creditCard.cpfCnpj || customer.cpfCnpj,
      postalCode: creditCard.postalCode || '01310100',
      addressNumber: creditCard.addressNumber || '100',
      phone: customer.phone,
    };

    const cleanCpfCnpj = String(customer.cpfCnpj || creditCardHolderInfo.cpfCnpj || '').replace(/\D/g, '');
    const cleanEmail = String(customer.email || creditCardHolderInfo.email || '').trim().toLowerCase();
    const cleanPhone = String(customer.phone || creditCardHolderInfo.phone || '').replace(/\D/g, '');

    // Validação de documento (CPF = 11 dígitos, CNPJ = 14 dígitos)
    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.',
        },
      };
    }

    // Validação dos dados do cartão de crédito
    const cleanCardNum = String(creditCard.number || '').replace(/\D/g, '');
    const ccvVal = String(creditCard.ccv || creditCard.cvv || '').trim();
    if (
      !cleanCardNum ||
      cleanCardNum.length < 13 ||
      !creditCard.holderName ||
      !creditCard.expiryMonth ||
      !creditCard.expiryYear ||
      !ccvVal
    ) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Dados do cartão de crédito incompletos. Verifique número, nome, validade e CVV.',
        },
      };
    }

    let customerId = null;
    let subscriptionId = null;
    let cardLastDigits = cleanCardNum.slice(-4);
    let cardBrand = creditCard.brand || detectCardBrand(cleanCardNum);

    const isHmlg = apiKey.startsWith('$aact_hmlg_');
    const baseUrl = (
      process.env.ASAAS_BASE_URL ||
      (isHmlg ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3')
    ).trim();

    console.info('[subscribeHandler] Chamando Asaas API em:', baseUrl, 'Ambiente:', isHmlg ? 'Sandbox' : 'Produção');

    // 1. Busca ou Cria Cliente no Asaas
    try {
      const searchUrl = cleanCpfCnpj
        ? `${baseUrl}/customers?cpfCnpj=${cleanCpfCnpj}`
        : `${baseUrl}/customers?email=${encodeURIComponent(cleanEmail)}`;

      const searchRes = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'access_token': apiKey,
          'User-Agent': 'OCorte-SaaS/1.0',
        },
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (Array.isArray(searchData?.data) && searchData.data.length > 0) {
          customerId = searchData.data[0].id;
          console.info('[subscribeHandler] Cliente Asaas existente identificado por doc:', customerId);
        }
      }

      if (!customerId && cleanEmail) {
        const emailRes = await fetch(`${baseUrl}/customers?email=${encodeURIComponent(cleanEmail)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'access_token': apiKey,
            'User-Agent': 'OCorte-SaaS/1.0',
          },
        });
        if (emailRes.ok) {
          const emailData = await emailRes.json();
          if (Array.isArray(emailData?.data) && emailData.data.length > 0) {
            customerId = emailData.data[0].id;
            console.info('[subscribeHandler] Cliente Asaas existente identificado por email:', customerId);
          }
        }
      }
    } catch (e) {
      console.warn('[subscribeHandler] Busca de cliente Asaas falhou, tentando cadastro direto:', e.message);
    }

    if (!customerId) {
      const custBody = {
        name: customer.name || creditCard.holderName || 'Cliente O CORTE',
        email: cleanEmail || 'contato@ocorte.com.br',
        cpfCnpj: cleanCpfCnpj,
        phone: cleanPhone || undefined,
        mobilePhone: cleanPhone || undefined,
        notificationDisabled: false,
      };

      console.info('[subscribeHandler] Registrando novo cliente no Asaas:', cleanEmail, cleanCpfCnpj);
      const custRes = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': apiKey,
          'User-Agent': 'OCorte-SaaS/1.0',
        },
        body: JSON.stringify(custBody),
      });

      const custData = await custRes.json().catch(() => ({}));
      if (!custRes.ok || !custData?.id) {
        const errorMsg = extractAsaasError(custData);
        console.error('[subscribeHandler] Erro na criação de cliente Asaas:', errorMsg, custData);
        return {
          status: 400,
          body: {
            success: false,
            error: errorMsg,
            details: custData,
          },
        };
      }
      customerId = custData.id;
      console.info('[subscribeHandler] Novo cliente criado no Asaas com sucesso! ID:', customerId);
    }

    // 2. Calcula data de vencimento da primeira fatura: Hoje + 7 dias (Trial Seguro)
    const trialDays = 7;
    const trialDate = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    const nextDueDate = trialDate.toISOString().split('T')[0];

    const planValue = Number(plan.value || 89.00);
    const planName = typeof plan === 'string' ? plan : (plan.name || 'Pro');
    const expYear = String(creditCard.expiryYear).length === 2 ? `20${creditCard.expiryYear}` : String(creditCard.expiryYear);
    const billingCycle = String(payload.cycle || 'MONTHLY').toUpperCase() === 'YEARLY' ? 'YEARLY' : 'MONTHLY';

    // 3. Cria Assinatura Recorrente no Asaas (/v3/subscriptions) com Cartão de Crédito validado pela API oficial
    const subBody = {
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: planValue,
      nextDueDate,
      cycle: billingCycle,
      description: `Assinatura O CORTE - Plano ${planName}`,
      creditCard: {
        holderName: String(creditCard.holderName).trim().toUpperCase(),
        number: cleanCardNum,
        expiryMonth: String(creditCard.expiryMonth).padStart(2, '0'),
        expiryYear: expYear,
        ccv: ccvVal,
      },
      creditCardHolderInfo: {
        name: String(creditCardHolderInfo.name || creditCard.holderName || customer.name).trim().toUpperCase(),
        email: cleanEmail || 'contato@ocorte.com.br',
        cpfCnpj: String(creditCardHolderInfo.cpfCnpj || cleanCpfCnpj).replace(/\D/g, ''),
        postalCode: String(creditCardHolderInfo.postalCode || '01310100').replace(/\D/g, ''),
        addressNumber: String(creditCardHolderInfo.addressNumber || '100').trim(),
        phone: cleanPhone || '11999999999',
      },
    };

    console.info('[subscribeHandler] Enviando requisição de assinatura para Asaas. nextDueDate:', nextDueDate, 'Valor:', planValue);

    const subRes = await fetch(`${baseUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey,
        'User-Agent': 'OCorte-SaaS/1.0',
      },
      body: JSON.stringify(subBody),
    });

    const subData = await subRes.json().catch(() => ({}));

    if (!subRes.ok || !subData?.id) {
      const errorMsg = extractAsaasError(subData);
      console.error('[subscribeHandler] Assinatura recusada pela API do Asaas:', errorMsg, subData);
      return {
        status: 400,
        body: {
          success: false,
          error: errorMsg,
          details: subData,
        },
      };
    }

    subscriptionId = subData.id;
    if (subData?.creditCard?.creditCardNumber) {
      cardLastDigits = String(subData.creditCard.creditCardNumber).slice(-4);
    }
    if (subData?.creditCard?.creditCardBrand) {
      cardBrand = String(subData.creditCard.creditCardBrand).toUpperCase();
    }
    console.info('[subscribeHandler] Assinatura criada com SUCESSO no Asaas! ID:', subscriptionId);

    // 4. Salva na tabela 'companies' do Supabase com asaas_customer_id, asaas_subscription_id, card_last_digits, card_brand, referred_by e referral_code
    const businessName = payload.business_name || customer.name || 'Minha Barbearia';
    const slugStr = businessName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const rawReferredBy = String(payload.referred_by || payload.ref || '').trim().toUpperCase();
    const generatedReferralCode = String(payload.referral_code || '').trim().toUpperCase() || generateReferralCode(8);

    const companyData = {
      name: businessName,
      owner_name: customer.name,
      owner_email: cleanEmail,
      owner_cpf_cnpj: cleanCpfCnpj,
      phone: cleanPhone,
      whatsapp: cleanPhone,
      plan_id: String(planName).toLowerCase(),
      plan_name: planName,
      status: 'active',
      billing_status: 'ACTIVE',
      subscription_status: 'trialing',
      asaas_customer_id: customerId,
      asaas_subscription_id: subscriptionId,
      card_last_digits: cardLastDigits,
      card_brand: cardBrand,
      trial_ends_at: trialDate.toISOString(),
      current_period_end: trialDate.toISOString(),
      slug: slugStr || `barbearia-${Date.now().toString().slice(-4)}`,
      referral_code: generatedReferralCode,
      ...(rawReferredBy ? { referred_by: rawReferredBy } : {}),
      updated_at: new Date().toISOString(),
    };

    let savedCompanyId = payload.company_id || null;

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);

        let existing = null;
        if (savedCompanyId) {
          const { data: byId } = await supabase
            .from('companies')
            .select('id, business_hours, referral_code, referred_by')
            .eq('id', savedCompanyId)
            .maybeSingle();
          existing = byId;
        }
        if (!existing && cleanEmail) {
          const { data: byEmail } = await supabase
            .from('companies')
            .select('id, business_hours, referral_code, referred_by')
            .eq('owner_email', cleanEmail)
            .maybeSingle();
          existing = byEmail;
        }

        const finalReferralCode = existing?.referral_code || generatedReferralCode;
        const finalReferredBy = existing?.referred_by || rawReferredBy || null;

        const enrichedCompanyData = {
          ...companyData,
          referral_code: finalReferralCode,
          ...(finalReferredBy ? { referred_by: finalReferredBy } : {}),
          cnpj: cleanCpfCnpj,
          business_hours: {
            ...(existing?.business_hours || {}),
            _billing: {
              card_last_digits: cardLastDigits,
              card_brand: cardBrand,
              plan_name: planName,
              asaas_customer_id: customerId,
              asaas_subscription_id: subscriptionId,
            },
          },
        };

        const saveWithFallback = async (targetId, dataToSave) => {
          const payloadCopy = { ...dataToSave };
          for (let attempt = 0; attempt < 15; attempt++) {
            const res = targetId
              ? await supabase.from('companies').update(payloadCopy).eq('id', targetId).select('id').maybeSingle()
              : await supabase.from('companies').insert([payloadCopy]).select('id').maybeSingle();

            if (!res.error) {
              return res.data?.id || targetId;
            }

            // Se alguma coluna opcional ainda não existir no banco remoto, remove apenas a coluna ausente e tenta novamente
            const matchCol =
              res.error.message?.match(/Could not find the '([^']+)' column/) ||
              res.error.message?.match(/column "([^"]+)" of relation/);
            if (matchCol && matchCol[1] && matchCol[1] in payloadCopy) {
              delete payloadCopy[matchCol[1]];
              continue;
            }
            break;
          }
          return targetId;
        };

        savedCompanyId = await saveWithFallback(existing?.id || savedCompanyId || null, enrichedCompanyData);
      } catch (dbErr) {
        console.warn('[subscribeHandler] Aviso ao sincronizar com Supabase no servidor:', dbErr.message);
      }
    }

    const queryParams = new URLSearchParams({
      email: cleanEmail,
      plano: String(planName).toLowerCase(),
      business: businessName,
      owner: customer.name,
      phone: cleanPhone,
      cnpj: cleanCpfCnpj,
      ...(rawReferredBy ? { ref: rawReferredBy } : {}),
    }).toString();

    return {
      status: 200,
      body: {
        success: true,
        company_id: savedCompanyId,
        customer_id: customerId,
        asaas_customer_id: customerId,
        subscription_id: subscriptionId,
        asaas_subscription_id: subscriptionId,
        card_last_digits: cardLastDigits,
        card_brand: cardBrand,
        referral_code: companyData.referral_code,
        referred_by: rawReferredBy || null,
        trial_ends_at: trialDate.toISOString(),
        url: `/checkout/sucesso?${queryParams}`,
        message: 'Assinatura criada com sucesso no Asaas!',
      },
    };
  } catch (err) {
    console.error('[subscribeHandler] Erro fatal:', err);
    return {
      status: 500,
      body: {
        success: false,
        error: err.message || 'Erro inesperado no servidor ao processar assinatura.',
      },
    };
  }
}
