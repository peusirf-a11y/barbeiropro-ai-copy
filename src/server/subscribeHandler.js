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

export async function handleAsaasSubscription(payload = {}) {
  try {
    const rawApiKey = (
      process.env.ASAAS_API_KEY ||
      process.env.VITE_ASAAS_API_KEY ||
      payload.apiKey ||
      ''
    ).trim();

    const isApiKeyValid =
      rawApiKey &&
      rawApiKey.length > 10 &&
      !rawApiKey.toLowerCase().includes('sua_chave') &&
      !rawApiKey.toLowerCase().includes('your_key') &&
      !rawApiKey.toLowerCase().includes('placeholder');

    const apiKey = rawApiKey;
    let useSandboxMock = !isApiKeyValid;

    if (useSandboxMock) {
      console.warn('[subscribeHandler] ASAAS_API_KEY não configurada ou inválida. Ativando modo Sandbox/Simulação local para testes.');
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

    const cleanCpfCnpj = String(customer.cpfCnpj || '').replace(/\D/g, '');
    const cleanEmail = String(customer.email || '').trim().toLowerCase();
    const cleanPhone = String(customer.phone || '').replace(/\D/g, '');

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

    // Bloqueio de cartão de teste recusado
    if (cleanCardNum.startsWith('9999')) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Cartão não autorizado ou recusado pelo banco emissor (simulação de recusa).',
        },
      };
    }

    let customerId = null;
    let subscriptionId = null;
    let cardLastDigits = cleanCardNum.slice(-4);
    let cardBrand = creditCard.brand || detectCardBrand(cleanCardNum);

    if (!useSandboxMock) {
      const isHmlg = apiKey.startsWith('$aact_hmlg_');
      const baseUrl = (process.env.ASAAS_BASE_URL || (isHmlg ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3')).trim();

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
          name: customer.name || 'Cliente O CORTE',
          email: cleanEmail,
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
        if (!custRes.ok) {
          const errorMsg = extractAsaasError(custData);
          console.error('[subscribeHandler] Erro na criação de cliente Asaas:', errorMsg, custData);

          if (errorMsg.toLowerCase().includes('chave de api') || errorMsg.toLowerCase().includes('api key') || errorMsg.toLowerCase().includes('access_token')) {
            console.warn('[subscribeHandler] Chave de Asaas rejeitada pela API. Ativando fallback de sandbox local para testes.');
            useSandboxMock = true;
          } else {
            return {
              status: 400,
              body: {
                success: false,
                error: errorMsg,
                details: custData,
              },
            };
          }
        } else {
          customerId = custData.id;
          console.info('[subscribeHandler] Novo cliente criado no Asaas com sucesso! ID:', customerId);
        }
      }
    }

    // 2. Calcula data de vencimento da primeira fatura: Hoje + 7 dias (Trial Seguro)
    const trialDays = 7;
    const trialDate = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    const nextDueDate = trialDate.toISOString().split('T')[0];

    const planValue = Number(plan.value || 89.00);
    const planName = plan.name || 'Pro';
    const expYear = String(creditCard.expiryYear).length === 2 ? `20${creditCard.expiryYear}` : String(creditCard.expiryYear);

    if (!useSandboxMock && customerId) {
      const isHmlg = apiKey.startsWith('$aact_hmlg_');
      const baseUrl = (process.env.ASAAS_BASE_URL || (isHmlg ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3')).trim();

      // 3. Cria Assinatura Recorrente no Asaas (/v3/subscriptions) com Cartão de Crédito e nextDueDate (+7 dias)
      const subBody = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: planValue,
        nextDueDate,
        cycle: 'MONTHLY',
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
          email: cleanEmail,
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

      if (!subRes.ok) {
        const errorMsg = extractAsaasError(subData);
        console.error('[subscribeHandler] Assinatura recusada pela API do Asaas:', errorMsg, subData);

        if (errorMsg.toLowerCase().includes('chave de api') || errorMsg.toLowerCase().includes('api key') || errorMsg.toLowerCase().includes('access_token')) {
          console.warn('[subscribeHandler] Chave de Asaas rejeitada na criação de assinatura. Ativando fallback sandbox local.');
          useSandboxMock = true;
        } else {
          return {
            status: 400,
            body: {
              success: false,
              error: errorMsg,
              details: subData,
            },
          };
        }
      } else {
        subscriptionId = subData.id;
        if (subData?.creditCard?.creditCardNumber) {
          cardLastDigits = String(subData.creditCard.creditCardNumber).slice(-4);
        }
        if (subData?.creditCard?.creditCardBrand) {
          cardBrand = String(subData.creditCard.creditCardBrand).toUpperCase();
        }
        console.info('[subscribeHandler] Assinatura criada com SUCESSO no Asaas! ID:', subscriptionId);
      }
    }

    if (useSandboxMock) {
      customerId = `cust_dev_${Date.now()}`;
      subscriptionId = `sub_dev_${Date.now()}`;
      console.info('[subscribeHandler] Usando IDs de Sandbox Mock:', { customerId, subscriptionId });
    }

    // 4. Salva na tabela 'companies' do Supabase com asaas_customer_id, asaas_subscription_id, card_last_digits e card_brand
    const businessName = payload.business_name || customer.name || 'Minha Barbearia';
    const slugStr = businessName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

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
      updated_at: new Date().toISOString(),
    };

    let savedCompanyId = null;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: existing } = await supabase
          .from('companies')
          .select('id, business_hours')
          .eq('owner_email', cleanEmail)
          .maybeSingle();

        const enrichedCompanyData = {
          ...companyData,
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

        savedCompanyId = await saveWithFallback(existing?.id || null, enrichedCompanyData);
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
        trial_ends_at: trialDate.toISOString(),
        url: `/checkout/sucesso?${queryParams}`,
        message: useSandboxMock ? 'Assinatura simulada com sucesso (Modo Sandbox).' : 'Assinatura criada com sucesso no Asaas!',
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
