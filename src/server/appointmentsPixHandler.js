// src/server/appointmentsPixHandler.js
// Handler para geração de código Pix real no Asaas, gravação e confirmação estrita do agendamento no Supabase.
import { supabase } from '../lib/supabaseClient.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toSafeUuid(val) {
  if (typeof val === 'string' && UUID_REGEX.test(val.trim())) {
    return val.trim();
  }
  return null;
}

function isValidCpf(cpf) {
  const digits = String(cpf || '').replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 10; i > 0; i--) {
    sum += parseInt(digits.charAt(10 - i), 10) * (i + 1);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(10), 10)) return false;

  return true;
}

function resolveValidCpf(rawCpf) {
  const cleaned = String(rawCpf || '').replace(/\D/g, '');
  if (isValidCpf(cleaned)) {
    return cleaned;
  }
  return '39053344705';
}

function getAsaasBaseUrl(apiKey) {
  const key = String(apiKey || '').trim();
  if (key.includes('$aact_prod_') || key.startsWith('prod_')) {
    return 'https://api.asaas.com/v3';
  }
  if (key.includes('hmlg') || key.includes('sandbox')) {
    return 'https://sandbox.asaas.com/api/v3';
  }
  return 'https://api.asaas.com/v3';
}

const DEFAULT_PIX_ERROR = 'Não foi possível gerar a cobrança Pix no Asaas. Verifique a chave de API da barbearia.';

/**
 * Garante que o cliente exista na tabela `customers` do Supabase e retorna seu ID (UUID) e dados normalizados.
 */
async function ensureCustomerInSupabase({ companyId, customerId, name, phone, email, cpf }) {
  if (!supabase || !companyId) {
    return {
      id: toSafeUuid(customerId),
      name: name || 'Cliente',
      phone: phone || '',
      email: email || null,
    };
  }

  const safeId = toSafeUuid(customerId);
  const cleanName = String(name || '').trim() || 'Cliente';
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanEmail = String(email || '').trim().toLowerCase() || null;
  const cleanCpf = String(cpf || '').replace(/\D/g, '') || null;

  try {
    // 1. Tenta localizar pelo UUID se fornecido
    if (safeId) {
      const { data: byId } = await supabase
        .from('customers')
        .select('*')
        .eq('id', safeId)
        .maybeSingle();
      if (byId?.id) {
        return {
          id: byId.id,
          name: cleanName !== 'Cliente' ? cleanName : (byId.name || 'Cliente'),
          phone: cleanPhone || byId.phone || '',
          email: cleanEmail || byId.email || null,
        };
      }
    }

    // 2. Tenta localizar por email na mesma barbearia
    if (cleanEmail) {
      const { data: byEmail } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .eq('email', cleanEmail)
        .maybeSingle();
      if (byEmail?.id) {
        return {
          id: byEmail.id,
          name: cleanName !== 'Cliente' ? cleanName : (byEmail.name || 'Cliente'),
          phone: cleanPhone || byEmail.phone || '',
          email: byEmail.email || cleanEmail,
        };
      }
    }

    // 3. Tenta localizar por CPF na mesma barbearia
    if (cleanCpf && cleanCpf.length === 11) {
      const { data: byCpf } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .eq('cpf', cleanCpf)
        .maybeSingle();
      if (byCpf?.id) {
        return {
          id: byCpf.id,
          name: cleanName !== 'Cliente' ? cleanName : (byCpf.name || 'Cliente'),
          phone: cleanPhone || byCpf.phone || '',
          email: cleanEmail || byCpf.email || null,
        };
      }
    }

    // 4. Tenta localizar por telefone na mesma barbearia
    if (cleanPhone && cleanPhone.length >= 10) {
      const { data: byPhone } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .eq('phone', cleanPhone)
        .maybeSingle();
      if (byPhone?.id) {
        return {
          id: byPhone.id,
          name: cleanName !== 'Cliente' ? cleanName : (byPhone.name || 'Cliente'),
          phone: byPhone.phone || cleanPhone,
          email: cleanEmail || byPhone.email || null,
        };
      }
    }

    // 5. Cria novo registro na tabela `customers` para que apareça na carteira da barbearia e vincule o agendamento
    const safeEmail =
      cleanEmail ||
      (cleanPhone ? `${cleanPhone}@cliente.local` : cleanCpf ? `${cleanCpf}@cliente.local` : `cliente_${Date.now()}@cliente.local`);

    const { data: created } = await supabase
      .from('customers')
      .insert({
        company_id: companyId,
        name: cleanName,
        phone: cleanPhone || null,
        email: safeEmail,
        cpf: cleanCpf,
        status: 'active',
      })
      .select()
      .single();

    if (created?.id) {
      return {
        id: created.id,
        name: created.name || cleanName,
        phone: created.phone || cleanPhone || '',
        email: created.email || safeEmail,
      };
    }
  } catch (err) {
    console.warn('[appointmentsPixHandler] Aviso ao sincronizar cliente no Supabase:', err);
  }

  return {
    id: null,
    name: cleanName,
    phone: cleanPhone,
    email: cleanEmail,
  };
}

/**
 * Cria ou atualiza o agendamento no Supabase vinculado ao paymentId do Asaas.
 * - Na criação do Pix: status = 'pending_payment', payment_status = 'pending'
 * - Na confirmação bancária (RECEIVED / CONFIRMED): status = 'confirmado', payment_status = 'confirmed'
 */
async function upsertAppointmentForPix({
  paymentId,
  booking = {},
  fallbackCompanyId = null,
  targetStatus = 'confirmado',
  targetPaymentStatus = 'confirmed',
}) {
  if (!supabase || !paymentId) return null;

  try {
    // 1. Verifica se já existe agendamento gravado para este paymentId
    const { data: existing } = await supabase
      .from('appointments')
      .select('*')
      .or(`asaas_payment_id.eq.${paymentId},payment_id.eq.${paymentId}`)
      .maybeSingle();

    const companyId = toSafeUuid(
      booking?.companyId || booking?.company_id || existing?.company_id || fallbackCompanyId
    );
    if (!companyId) return existing || null;

    const rawCustomerInfo = await ensureCustomerInSupabase({
      companyId,
      customerId: booking?.customerId || booking?.customer_id || existing?.customer_id,
      name: booking?.clientName || booking?.client_name || booking?.customer_name || existing?.customer_name,
      phone: booking?.clientPhone || booking?.client_phone || booking?.customer_phone || existing?.customer_phone,
      email: booking?.clientEmail || booking?.client_email || booking?.customer_email || existing?.customer_email,
      cpf: booking?.clientCpf || booking?.client_cpf || booking?.customer_cpf,
    });

    if (existing?.id) {
      const patch = {
        status: targetStatus,
        payment_status: targetPaymentStatus,
        updated_at: new Date().toISOString(),
      };
      if (!existing.customer_id && rawCustomerInfo.id) {
        patch.customer_id = rawCustomerInfo.id;
      }
      if ((!existing.customer_name || existing.customer_name === 'Cliente') && rawCustomerInfo.name) {
        patch.customer_name = rawCustomerInfo.name;
        patch.client_name = rawCustomerInfo.name;
      }
      if (!existing.customer_phone && rawCustomerInfo.phone) {
        patch.customer_phone = rawCustomerInfo.phone;
        patch.client_phone = rawCustomerInfo.phone;
      }
      if (!existing.customer_email && rawCustomerInfo.email) {
        patch.customer_email = rawCustomerInfo.email;
      }

      const { data: updated } = await supabase
        .from('appointments')
        .update(patch)
        .eq('id', existing.id)
        .select()
        .single();

      return updated || { ...existing, ...patch };
    }

    // 2. Caso ainda não exista no banco, resolve FKs e insere
    const rawServiceId = booking?.serviceId || booking?.service_id || null;
    const rawProfessionalId = booking?.professionalId || booking?.professional_id || null;

    const candidateServiceId = toSafeUuid(rawServiceId);
    const candidateProfessionalId =
      rawProfessionalId === 'any' || !rawProfessionalId ? null : toSafeUuid(rawProfessionalId);

    const rawPrice = Number(booking?.price || booking?.amount || 0);
    let servicePrice = rawPrice > 0 ? rawPrice : 35.0;

    // Valida Serviço no Supabase
    let validServiceId = null;
    let resolvedServiceName = booking?.serviceName || booking?.service_name || '';
    let serviceDuration = Number(booking?.duration_minutes) || 30;
    if (candidateServiceId) {
      try {
        const { data: srv } = await supabase
          .from('services')
          .select('id, name, price, duration_minutes')
          .eq('id', candidateServiceId)
          .maybeSingle();
        if (srv?.id) {
          validServiceId = srv.id;
          if (!resolvedServiceName && srv.name) resolvedServiceName = srv.name;
          if (!rawPrice && srv.price) servicePrice = Number(srv.price);
          if (srv.duration_minutes) serviceDuration = Number(srv.duration_minutes);
        }
      } catch (_) {}
    }
    if (!validServiceId) {
      try {
        const { data: firstSrv } = await supabase
          .from('services')
          .select('id, name, price, duration_minutes')
          .eq('company_id', companyId)
          .limit(1)
          .maybeSingle();
        if (firstSrv?.id) {
          validServiceId = firstSrv.id;
          if (!resolvedServiceName) resolvedServiceName = firstSrv.name;
          if (!rawPrice && firstSrv.price) servicePrice = Number(firstSrv.price);
        }
      } catch (_) {}
    }
    if (!resolvedServiceName) resolvedServiceName = 'Corte';

    // Valida Profissional no Supabase (se 'any' ou vazio, atribui ao primeiro profissional ativo da barbearia para exibir na coluna da Agenda!)
    let validProfessionalId = null;
    let resolvedProfessionalName = booking?.professionalName || booking?.professional_name || '';
    if (candidateProfessionalId) {
      try {
        const { data: pro } = await supabase
          .from('professionals')
          .select('id, name')
          .eq('id', candidateProfessionalId)
          .maybeSingle();
        if (pro?.id) {
          validProfessionalId = pro.id;
          if (!resolvedProfessionalName && pro.name) resolvedProfessionalName = pro.name;
        }
      } catch (_) {}
    }
    if (!validProfessionalId) {
      try {
        const { data: firstPro } = await supabase
          .from('professionals')
          .select('id, name')
          .eq('company_id', companyId)
          .limit(1)
          .maybeSingle();
        if (firstPro?.id) {
          validProfessionalId = firstPro.id;
          if (!resolvedProfessionalName || resolvedProfessionalName === 'Sem Preferência') {
            resolvedProfessionalName = firstPro.name;
          }
        }
      } catch (_) {}
    }
    if (!resolvedProfessionalName) {
      resolvedProfessionalName = 'Profissional';
    }

    const date =
      booking?.date ||
      (booking?.startTime && String(booking.startTime).includes('T')
        ? String(booking.startTime).split('T')[0]
        : new Date().toISOString().split('T')[0]);
    const time =
      booking?.time ||
      (booking?.startTime && String(booking.startTime).includes('T')
        ? String(booking.startTime).split('T')[1].slice(0, 5)
        : '09:00');

    const startTime =
      booking?.startTime ||
      booking?.start_time ||
      booking?.scheduled_at ||
      `${date}T${String(time).slice(0, 5)}:00-03:00`;

    const endTime =
      booking?.endTime ||
      booking?.end_time ||
      (() => {
        const parsed = new Date(startTime);
        if (!Number.isNaN(parsed.getTime())) {
          return new Date(parsed.getTime() + serviceDuration * 60 * 1000).toISOString();
        }
        return startTime;
      })();

    const insertPayload = {
      company_id: companyId,
      service_id: validServiceId,
      service_name: resolvedServiceName,
      professional_id: validProfessionalId,
      professional_name: resolvedProfessionalName,
      customer_id: rawCustomerInfo.id,
      customer_name: rawCustomerInfo.name,
      client_name: rawCustomerInfo.name,
      customer_phone: rawCustomerInfo.phone,
      client_phone: rawCustomerInfo.phone,
      customer_email: rawCustomerInfo.email,
      date,
      time: String(time).slice(0, 5),
      start_time: startTime,
      end_time: endTime,
      price: Number(servicePrice),
      status: targetStatus,
      payment_status: targetPaymentStatus,
      payment_id: paymentId,
      asaas_payment_id: paymentId,
      notes: booking?.notes || '',
    };

    const { data: inserted, error: insertError } = await supabase
      .from('appointments')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[appointmentsPixHandler] Erro ao inserir agendamento no Supabase:', insertError);
      return null;
    }

    return inserted;
  } catch (err) {
    console.error('[appointmentsPixHandler] Exceção em upsertAppointmentForPix:', err);
    return null;
  }
}


export async function handleCreateCardPayment(body = {}) {
  try {
    const booking = body.booking || body;
    const card = body.card || body.creditCard || {};

    const rawCompanyId =
      body.companyId || body.company_id || booking?.companyId || booking?.company_id || null;
    let companyId = toSafeUuid(rawCompanyId);

    const clientName = String(
      booking?.clientName ||
      booking?.client_name ||
      booking?.customer_name ||
      card?.holderName ||
      'Cliente'
    ).trim();
    const clientPhone = String(
      card?.phone ||
      booking?.clientPhone ||
      booking?.client_phone ||
      booking?.customer_phone ||
      ''
    ).trim();
    const clientEmail = String(
      card?.email ||
      booking?.clientEmail ||
      booking?.client_email ||
      booking?.customer_email ||
      ''
    ).trim();

    const rawCpfDigits = String(
      card?.cpfCnpj ||
      booking?.clientCpf ||
      booking?.client_cpf ||
      booking?.customer_cpf ||
      ''
    ).replace(/\D/g, '');
    const validCpf =
      rawCpfDigits.length === 14
        ? rawCpfDigits
        : resolveValidCpf(rawCpfDigits);

    const rawPrice = Number(booking?.price || body.price || booking?.amount || 0);
    const servicePrice = rawPrice > 0 ? rawPrice : 35.0;

    const cardNumber = String(card?.number || '').replace(/\D/g, '');
    const holderName = String(card?.holderName || clientName || 'Cliente').trim();
    const expiryMonth = String(card?.expiryMonth || '').replace(/\D/g, '').padStart(2, '0');
    const rawYear = String(card?.expiryYear || '').replace(/\D/g, '');
    const expiryYear = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    const ccv = String(card?.ccv || card?.cvv || '').replace(/\D/g, '');

    if (!cardNumber || cardNumber.length < 13 || !expiryMonth || !expiryYear || !ccv) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Dados do cartão incompletos. Verifique número, validade e CVV.',
          message: 'Dados do cartão incompletos. Verifique número, validade e CVV.',
        },
      };
    }

    // Busca a 'asaas_api_key' da barbearia em 'companies'
    let asaasApiKey = '';
    if (companyId && supabase) {
      try {
        const { data: comp } = await supabase
          .from('companies')
          .select('id, name, asaas_api_key')
          .eq('id', companyId)
          .maybeSingle();
        if (comp?.asaas_api_key) {
          asaasApiKey = comp.asaas_api_key.trim();
        }
      } catch (_) {}
    }

    if (!asaasApiKey && supabase) {
      try {
        const { data: comps } = await supabase
          .from('companies')
          .select('id, asaas_api_key')
          .not('asaas_api_key', 'is', null)
          .limit(1);
        if (comps?.[0]?.asaas_api_key) {
          asaasApiKey = comps[0].asaas_api_key.trim();
          companyId = companyId || comps[0].id;
        }
      } catch (_) {}
    }

    if (!asaasApiKey) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Não foi possível processar o cartão no Asaas. Verifique a chave de API da barbearia.',
          message: 'Não foi possível processar o cartão no Asaas. Verifique a chave de API da barbearia.',
        },
      };
    }

    const baseUrl = getAsaasBaseUrl(asaasApiKey);
    const headers = {
      'access_token': asaasApiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'OCorte-App',
    };

    // 1º PASSO: Cria ou obtém o cliente no Asaas
    let customerId = null;
    const cleanMobile = clientPhone.replace(/\D/g, '');
    const validPhone =
      cleanMobile.length >= 10 && cleanMobile.length <= 11 && !/^(\d)\1+$/.test(cleanMobile.slice(-8))
        ? cleanMobile
        : '11987654321';
    const validEmail = clientEmail.includes('@') ? clientEmail : 'cliente@barbearia.com';

    // Tenta buscar cliente existente por CPF/CNPJ para evitar duplicidades
    try {
      const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${encodeURIComponent(validCpf)}`, {
        method: 'GET',
        headers,
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json().catch(() => null);
        if (Array.isArray(searchData?.data) && searchData.data.length > 0 && searchData.data[0]?.id) {
          customerId = searchData.data[0].id;
        }
      }
    } catch (_) {}

    if (!customerId) {
      const createCustRes = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: clientName || holderName || 'Cliente',
          cpfCnpj: validCpf,
          email: validEmail,
          mobilePhone: validPhone,
        }),
      });
      const createCustData = await createCustRes.json().catch(() => null);

      if (createCustRes.ok && createCustData?.id) {
        customerId = createCustData.id;
      } else {
        const retryCustRes = await fetch(`${baseUrl}/customers`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: clientName || holderName || 'Cliente',
            cpfCnpj: validCpf,
          }),
        });
        const retryCustData = await retryCustRes.json().catch(() => null);
        if (retryCustRes.ok && retryCustData?.id) {
          customerId = retryCustData.id;
        } else {
          const custErr =
            retryCustData?.errors?.map((e) => e.description).filter(Boolean).join(' ') ||
            createCustData?.errors?.map((e) => e.description).filter(Boolean).join(' ') ||
            'Não foi possível validar o cadastro do titular no Asaas.';
          return {
            status: 400,
            body: {
              success: false,
              error: custErr,
              message: custErr,
            },
          };
        }
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const postalCode = String(card?.postalCode || '01310100').replace(/\D/g, '') || '01310100';
    const addressNumber = String(card?.addressNumber || '100').trim() || '100';

    // SE FOR ASSINATURA RECORRENTE DE PLANO DE CLIENTE:
    // Chama POST https://api.asaas.com/v3/subscriptions com billingType: 'CREDIT_CARD', cycle: 'MONTHLY', nextDueDate: today
    const isCustomerPlanSub =
      Boolean(body.isCustomerPlan) ||
      body.action === 'customer_subscription' ||
      body.cycle === 'MONTHLY';

    if (isCustomerPlanSub) {
      const planId = toSafeUuid(body.planId || body.plan_id || booking?.plan_id);
      const planName = String(body.planName || body.plan_name || booking?.plan_name || 'Plano Mensal').trim();
      const subscriptionDescription =
        body.description || booking?.description || `Assinatura Plano ${planName} - ${clientName}`;

      const buildSubscriptionBody = (val) => ({
        customer: customerId,
        billingType: 'CREDIT_CARD',
        cycle: 'MONTHLY',
        value: Number(val),
        nextDueDate: today,
        description: subscriptionDescription,
        creditCard: {
          holderName,
          number: cardNumber,
          expiryMonth,
          expiryYear,
          ccv,
        },
        creditCardHolderInfo: {
          name: holderName,
          email: validEmail,
          cpfCnpj: validCpf,
          postalCode,
          addressNumber,
          phone: validPhone,
          mobilePhone: validPhone,
        },
      });

      let subRes = await fetch(`${baseUrl}/subscriptions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildSubscriptionBody(servicePrice)),
      });
      let subData = await subRes.json().catch(() => null);

      if (!subRes.ok && servicePrice < 5) {
        subRes = await fetch(`${baseUrl}/subscriptions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(buildSubscriptionBody(5.0)),
        });
        subData = await subRes.json().catch(() => null);
      }

      if (!subRes.ok || !subData?.id) {
        const asaasErr =
          subData?.errors?.map((e) => e.description).filter(Boolean).join(' ') ||
          subData?.message ||
          'Cartão não autorizado para assinatura recorrente pelo banco emissor.';
        return {
          status: 400,
          body: {
            success: false,
            error: asaasErr,
            message: asaasErr,
          },
        };
      }

      const asaasSubscriptionId = subData.id;
      const cardLastDigits =
        subData?.creditCard?.creditCardNumber?.slice(-4) || cardNumber.slice(-4);
      const cardBrand =
        subData?.creditCard?.creditCardBrand ||
        (/^4/.test(cardNumber)
          ? 'VISA'
          : /^(5[1-5]|2[2-7])/.test(cardNumber)
          ? 'MASTERCARD'
          : 'CARTAO');
      const nowIso = new Date().toISOString();
      const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Persiste na tabela customer_subscriptions do Supabase com fallback resiliente de colunas
      let savedSubscription = null;
      if (supabase && companyId) {
        try {
          const ensuredCustomer = await ensureCustomerInSupabase({
            companyId,
            customerId: body.customerId || body.customer_id || booking?.customer_id,
            name: clientName,
            phone: clientPhone,
            email: clientEmail,
            cpf: validCpf,
          });
          const resolvedCustomerId =
            ensuredCustomer?.id ||
            toSafeUuid(body.customerId || body.customer_id || booking?.customer_id);

          if (resolvedCustomerId) {
            // Remove eventuais assinaturas pendentes antigas deste cliente na barbearia
            await supabase
              .from('customer_subscriptions')
              .delete()
              .eq('company_id', companyId)
              .eq('customer_id', resolvedCustomerId)
              .eq('status', 'pending_payment');

            const fullSubRecord = {
              company_id: companyId,
              customer_id: resolvedCustomerId,
              plan_id: planId,
              plan_name: planName,
              plan_name_snapshot: planName,
              plan_price_snapshot: Number(servicePrice),
              plan_type_snapshot: body.plan_type || 'limited',
              plan_usage_limit_snapshot: Number(body.usage_limit ?? 0),
              status: 'active',
              asaas_subscription_id: asaasSubscriptionId,
              card_last_digits: cardLastDigits,
              card_brand: cardBrand,
              current_period_start: nowIso,
              current_period_end: currentPeriodEnd,
              current_cycle_start: nowIso,
              current_cycle_end: currentPeriodEnd,
              uses_remaining: Number(body.usage_limit ?? 0),
              uses_consumed_total: 0,
              last_payment_status: 'pago',
              updated_at: nowIso,
            };

            const existingSubId = toSafeUuid(body.subscriptionId || body.subscription_id);
            const saveSubWithFallback = async (targetId, record) => {
              const copy = { ...record };
              for (let attempt = 0; attempt < 20; attempt++) {
                const res = targetId
                  ? await supabase
                      .from('customer_subscriptions')
                      .update(copy)
                      .eq('id', targetId)
                      .select()
                      .maybeSingle()
                  : await supabase
                      .from('customer_subscriptions')
                      .insert([copy])
                      .select()
                      .maybeSingle();

                if (!res.error) {
                  return res.data || { id: targetId, ...copy };
                }

                const matchCol =
                  res.error.message?.match(/Could not find the '([^']+)' column/) ||
                  res.error.message?.match(/column "([^"]+)" of relation/);
                if (matchCol && matchCol[1] && matchCol[1] in copy) {
                  delete copy[matchCol[1]];
                  continue;
                }
                break;
              }
              return null;
            };

            savedSubscription = await saveSubWithFallback(existingSubId, fullSubRecord);
          }
        } catch (subErr) {
          console.warn('[create-card] Aviso ao gravar customer_subscriptions no Supabase:', subErr);
        }
      }

      return {
        status: 200,
        body: {
          success: true,
          confirmed: true,
          status: subData.status || 'ACTIVE',
          billingType: 'CREDIT_CARD',
          payment_method: 'credit_card',
          subscriptionId: asaasSubscriptionId,
          asaas_subscription_id: asaasSubscriptionId,
          customerId,
          asaas_customer_id: customerId,
          card_last_digits: cardLastDigits,
          card_brand: cardBrand,
          current_period_end: currentPeriodEnd,
          creditCard: subData.creditCard || {
            creditCardNumber: cardLastDigits,
            creditCardBrand: cardBrand,
          },
          subscription: savedSubscription,
        },
      };
    }

    // 2º PASSO (Agendamento avulso): Cria e captura a cobrança com Cartão de Crédito no Asaas (POST /v3/payments)
    const buildPaymentBody = (val) => ({
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: Number(val),
      dueDate: today,
      description: body.description || booking?.description || `Agendamento - ${clientName}`,
      creditCard: {
        holderName,
        number: cardNumber,
        expiryMonth,
        expiryYear,
        ccv,
      },
      creditCardHolderInfo: {
        name: holderName,
        email: validEmail,
        cpfCnpj: validCpf,
        postalCode,
        addressNumber,
        phone: validPhone,
        mobilePhone: validPhone,
      },
    });

    let payRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildPaymentBody(servicePrice)),
    });
    let payData = await payRes.json().catch(() => null);

    if (!payRes.ok && servicePrice < 5) {
      payRes = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildPaymentBody(5.0)),
      });
      payData = await payRes.json().catch(() => null);
    }

    if (!payRes.ok || !payData?.id) {
      const asaasErr =
        payData?.errors?.map((e) => e.description).filter(Boolean).join(' ') ||
        payData?.message ||
        'Pagamento com cartão não autorizado pelo banco emissor.';
      return {
        status: 400,
        body: {
          success: false,
          error: asaasErr,
          message: asaasErr,
        },
      };
    }

    const paymentId = payData.id;
    const payStatus = String(payData.status || '').toUpperCase();

    if (!['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(payStatus)) {
      return {
        status: 400,
        body: {
          success: false,
          status: payStatus,
          error: `O pagamento não foi aprovado imediatamente (status: ${payStatus}). Verifique os dados do cartão.`,
          message: `O pagamento não foi aprovado imediatamente (status: ${payStatus}). Verifique os dados do cartão.`,
        },
      };
    }

    // Se for cobrança sem registro de agendamento, retorna diretamente
    if (body.skipAppointmentRecord) {
      return {
        status: 200,
        body: {
          success: true,
          confirmed: true,
          status: payStatus,
          billingType: 'CREDIT_CARD',
          payment_method: 'credit_card',
          paymentId,
          payment_id: paymentId,
          customerId,
          invoiceUrl: payData.invoiceUrl || null,
        },
      };
    }

    // 3º PASSO: Grava o agendamento confirmado no Supabase imediatamente
    const confirmedAppt = await upsertAppointmentForPix({
      paymentId,
      booking: {
        ...booking,
        clientName,
        clientPhone,
        clientEmail,
        clientCpf: validCpf,
      },
      fallbackCompanyId: companyId,
      targetStatus: 'confirmado',
      targetPaymentStatus: 'confirmed_card',
    });

    return {
      status: 200,
      body: {
        success: true,
        confirmed: true,
        status: payStatus,
        billingType: 'CREDIT_CARD',
        payment_method: 'credit_card',
        paymentId,
        payment_id: paymentId,
        appointmentId: confirmedAppt?.id || null,
        appointment_id: confirmedAppt?.id || null,
        appointment: confirmedAppt
          ? { ...confirmedAppt, payment_method: 'credit_card' }
          : null,
      },
    };
  } catch (err) {
    console.error('[create-card] Erro fatal:', err);
    return {
      status: 500,
      body: {
        success: false,
        error: err.message || 'Erro ao processar pagamento com cartão no Asaas.',
        message: err.message || 'Erro ao processar pagamento com cartão no Asaas.',
      },
    };
  }
}

export async function handleCreatePix(body = {}) {
  if (body?.action === 'card' || body?.billingType === 'CREDIT_CARD' || body?.card || body?.creditCard) {
    return handleCreateCardPayment(body);
  }
  try {
    const rawCompanyId = body.companyId || body.company_id || null;
    const companyId = toSafeUuid(rawCompanyId);
    const isSaasSubscription = Boolean(body.isSaasSubscription);
    const isPlanCheckout = body.action === 'plan_checkout' || Boolean(body.isCustomerPlan);
    const skipAppointmentRecord = Boolean(body.skipAppointmentRecord || isSaasSubscription || isPlanCheckout);

    const clientName = (body.clientName || body.client_name || body.customer_name || 'Cliente').trim();
    const clientPhone = (body.clientPhone || body.client_phone || body.customer_phone || '').trim();
    const validCpf = resolveValidCpf(body.clientCpf || body.client_cpf || body.customer_cpf);
    const rawPrice = Number(body.price || body.amount || 0);
    const servicePrice = rawPrice > 0 ? rawPrice : 35.0;

    // Busca a 'asaas_api_key' da barbearia em 'companies' pelo companyId (ou usa ASAAS_API_KEY da plataforma se for assinatura SaaS)
    let asaasApiKey = '';
    if (isSaasSubscription && process.env.ASAAS_API_KEY) {
      asaasApiKey = process.env.ASAAS_API_KEY.trim();
    }

    if (!asaasApiKey && companyId && supabase) {
      try {
        const { data: comp } = await supabase
          .from('companies')
          .select('id, name, asaas_api_key')
          .eq('id', companyId)
          .maybeSingle();

        if (comp?.asaas_api_key) {
          asaasApiKey = comp.asaas_api_key.trim();
        }
      } catch (err) {
        console.warn('[create-pix] Erro ao consultar empresa no Supabase:', err);
      }
    }

    if (!asaasApiKey && process.env.ASAAS_API_KEY) {
      asaasApiKey = process.env.ASAAS_API_KEY.trim();
    }

    if (!asaasApiKey) {
      return {
        status: 400,
        body: {
          success: false,
          error: DEFAULT_PIX_ERROR,
          message: DEFAULT_PIX_ERROR,
        },
      };
    }

    const baseUrl = getAsaasBaseUrl(asaasApiKey);
    const headers = {
      'access_token': asaasApiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'OCorte-App',
    };

    // 1º PASSO: Cria o cliente no Asaas (POST https://api.asaas.com/v3/customers)
    let customerId = null;
    const cleanMobile = clientPhone.replace(/\D/g, '');
    const customerPayload = {
      name: clientName || 'Cliente',
      mobilePhone: cleanMobile || undefined,
      cpfCnpj: validCpf,
    };
    if (!cleanMobile || cleanMobile.length < 10 || cleanMobile.length > 11 || /^(\d)\1+$/.test(cleanMobile.slice(-8))) {
      delete customerPayload.mobilePhone;
    }

    const createCustRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(customerPayload),
    });
    const createCustData = await createCustRes.json().catch(() => null);

    if (createCustRes.ok && createCustData?.id) {
      customerId = createCustData.id;
    } else {
      const retryCustRes = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: clientName || 'Cliente',
          cpfCnpj: validCpf,
        }),
      });
      const retryCustData = await retryCustRes.json().catch(() => null);
      if (retryCustRes.ok && retryCustData?.id) {
        customerId = retryCustData.id;
      } else {
        return {
          status: 400,
          body: {
            success: false,
            error: DEFAULT_PIX_ERROR,
            message: DEFAULT_PIX_ERROR,
          },
        };
      }
    }

    // 2º PASSO: Cria a cobrança no Asaas (POST https://api.asaas.com/v3/payments)
    const today = new Date().toISOString().split('T')[0];
    const chargeDescription = body.description || `Agendamento - ${clientName}`;
    const billingType = isPlanCheckout && body.billingType ? body.billingType : 'PIX';

    let payRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: customerId,
        billingType,
        value: Number(servicePrice),
        dueDate: today,
        description: chargeDescription,
      }),
    });
    let payData = await payRes.json().catch(() => null);

    if (!payRes.ok && servicePrice < 5) {
      payRes = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customer: customerId,
          billingType,
          value: 5.0,
          dueDate: today,
          description: chargeDescription,
        }),
      });
      payData = await payRes.json().catch(() => null);
    }

    if (!payRes.ok || !payData?.id) {
      return {
        status: 400,
        body: {
          success: false,
          error: DEFAULT_PIX_ERROR,
          message: DEFAULT_PIX_ERROR,
        },
      };
    }

    const paymentId = payData.id;
    const invoiceUrl = payData.invoiceUrl || payData.bankSlipUrl || null;

    // Se for checkout de plano de cliente e já tivermos invoiceUrl sem exigir QR code imediato
    if (isPlanCheckout && invoiceUrl && body.returnInvoiceOnly) {
      return {
        status: 200,
        body: {
          success: true,
          paymentId,
          customerId,
          invoiceUrl,
        },
      };
    }

    // 3º PASSO: Obtém o QR Code e Payload no Asaas (GET https://api.asaas.com/v3/payments/{paymentId}/pixQrCode)
    const qrRes = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
      method: 'GET',
      headers,
    });
    const pixData = await qrRes.json().catch(() => null);

    if (!qrRes.ok || !pixData?.encodedImage || !pixData?.payload) {
      if (isPlanCheckout && invoiceUrl) {
        return {
          status: 200,
          body: {
            success: true,
            paymentId,
            customerId,
            invoiceUrl,
          },
        };
      }
      return {
        status: 400,
        body: {
          success: false,
          error: DEFAULT_PIX_ERROR,
          message: DEFAULT_PIX_ERROR,
        },
      };
    }

    const encodedImage = String(pixData.encodedImage).replace(/^data:image\/png;base64,/, '');
    const pixPayload = pixData.payload;

    if (skipAppointmentRecord) {
      return {
        status: 200,
        body: {
          success: true,
          appointmentId: null,
          paymentId: paymentId,
          invoiceUrl,
          encodedImage: encodedImage,
          payload: pixPayload,
        },
      };
    }

    // 4º PASSO: Registra a intenção com status = 'pending_payment' no Supabase.
    const pendingAppt = await upsertAppointmentForPix({
      paymentId,
      booking: body,
      fallbackCompanyId: companyId,
      targetStatus: 'pending_payment',
      targetPaymentStatus: 'pending',
    });

    return {
      status: 200,
      body: {
        success: true,
        appointmentId: pendingAppt?.id || null,
        paymentId: paymentId,
        invoiceUrl,
        encodedImage: encodedImage,
        payload: pixPayload,
      },
    };
  } catch (err) {
    console.error('[create-pix] Erro fatal:', err);
    return {
      status: 500,
      body: {
        success: false,
        error: err.message || DEFAULT_PIX_ERROR,
        message: err.message || DEFAULT_PIX_ERROR,
      },
    };
  }
}

export async function handlePaymentStatus(paymentId, appointmentId, companyId, bookingData = null) {
  try {
    // Valida parâmetros obrigatórios e bloqueia qualquer tentativa de enviar status = 'confirmed' sem validação Asaas
    if (!paymentId && !appointmentId) {
      return {
        status: 400,
        body: {
          status: 'PENDING',
          received: false,
          confirmed: false,
          error: 'paymentId é obrigatório',
        },
      };
    }

    // Sanitiza bookingData para impedir que o cliente manipule status ou campos internos
    let sanitizedBooking = {};
    if (bookingData && typeof bookingData === 'object') {
      const {
        status: _ignoreStatus,
        payment_status: _ignorePayStatus,
        confirmed: _ignoreConfirmed,
        received: _ignoreReceived,
        paid: _ignorePaid,
        paid_online: _ignorePaidOnline,
        asaas_api_key: _ignoreApiKey,
        ...safeFields
      } = bookingData;
      sanitizedBooking = safeFields;
    }

    const skipAppointmentRecord = Boolean(
      sanitizedBooking?.skipAppointmentRecord || sanitizedBooking?.isSaasSubscription
    );
    let targetCompanyId = toSafeUuid(companyId || sanitizedBooking?.companyId || sanitizedBooking?.company_id);
    let targetPaymentId = paymentId ? String(paymentId).trim() : '';

    // 1. Consulta agendamento existente se necessário
    if (supabase && (!targetCompanyId || !targetPaymentId) && !skipAppointmentRecord) {
      try {
        let query = supabase
          .from('appointments')
          .select('id, company_id, asaas_payment_id, payment_id, status, payment_status');
        if (targetPaymentId && /^pay_[a-zA-Z0-9_]+$/.test(targetPaymentId)) {
          query = query.or(`asaas_payment_id.eq.${targetPaymentId},payment_id.eq.${targetPaymentId}`);
        } else if (appointmentId && toSafeUuid(appointmentId)) {
          query = query.eq('id', toSafeUuid(appointmentId));
        }

        const { data: appt } = await query.maybeSingle();
        if (appt) {
          targetCompanyId = targetCompanyId || appt.company_id;
          targetPaymentId = targetPaymentId || appt.asaas_payment_id || appt.payment_id || '';
        }
      } catch (_) {}
    }

    // Bloqueia qualquer ID simulado, inválido ou fora do formato oficial Asaas
    if (
      !targetPaymentId ||
      !/^pay_[a-zA-Z0-9_]+$/.test(targetPaymentId) ||
      targetPaymentId.startsWith('pay_mock_') ||
      targetPaymentId.startsWith('pay_test_')
    ) {
      return {
        status: 200,
        body: {
          status: 'PENDING',
          received: false,
          confirmed: false,
          message: 'O pagamento não foi bem-sucedido ou ainda não foi confirmado.',
        },
      };
    }

    // 2. Busca a 'asaas_api_key' da barbearia na tabela 'companies' (ou usa ASAAS_API_KEY da plataforma se aplicável)
    let asaasApiKey = '';
    if (sanitizedBooking?.isSaasSubscription && process.env.ASAAS_API_KEY) {
      asaasApiKey = process.env.ASAAS_API_KEY.trim();
    }

    if (!asaasApiKey && targetCompanyId && supabase) {
      try {
        const { data: comp } = await supabase
          .from('companies')
          .select('asaas_api_key')
          .eq('id', targetCompanyId)
          .maybeSingle();

        if (comp?.asaas_api_key) {
          asaasApiKey = comp.asaas_api_key.trim();
        }
      } catch (_) {}
    }

    if (!asaasApiKey && process.env.ASAAS_API_KEY) {
      asaasApiKey = process.env.ASAAS_API_KEY.trim();
    }

    if (!asaasApiKey) {
      return {
        status: 200,
        body: {
          status: 'PENDING',
          received: false,
          confirmed: false,
          message: 'O pagamento não foi bem-sucedido ou ainda não foi confirmado.',
        },
      };
    }

    // 3. Consulta oficial GET https://api.asaas.com/v3/payments/{paymentId} com a asaasApiKey
    const baseUrl = getAsaasBaseUrl(asaasApiKey);
    const asaasRes = await fetch(`${baseUrl}/payments/${encodeURIComponent(targetPaymentId)}`, {
      method: 'GET',
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'OCorte-App',
      },
    });

    const asaasData = await asaasRes.json().catch(() => null);
    const asaasStatus = String(asaasData?.status || 'PENDING').toUpperCase();
    const asaasBillingType = String(asaasData?.billingType || 'PIX').toUpperCase();
    const isCard = asaasBillingType === 'CREDIT_CARD';

    // SE SIM (pagamento confirmado na API oficial do Asaas: RECEIVED, CONFIRMED ou RECEIVED_IN_CASH)
    if (
      asaasRes.ok &&
      asaasData?.id === targetPaymentId &&
      ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(asaasStatus)
    ) {
      if (skipAppointmentRecord) {
        return {
          status: 200,
          body: {
            status: asaasStatus,
            billingType: asaasBillingType,
            payment_method: isCard ? 'credit_card' : 'pix',
            received: true,
            confirmed: true,
            payment_status: 'succeeded',
          },
        };
      }

      const confirmedAppt = await upsertAppointmentForPix({
        paymentId: targetPaymentId,
        booking: sanitizedBooking,
        fallbackCompanyId: targetCompanyId,
        targetStatus: 'confirmado',
        targetPaymentStatus: isCard ? 'confirmed_card' : 'confirmed',
      });

      return {
        status: 200,
        body: {
          status: asaasStatus,
          billingType: asaasBillingType,
          payment_method: isCard ? 'credit_card' : 'pix',
          received: true,
          confirmed: true,
          appointmentId: confirmedAppt?.id || appointmentId || null,
          appointment: confirmedAppt
            ? { ...confirmedAppt, payment_method: isCard ? 'credit_card' : 'pix' }
            : null,
          payment_status: 'succeeded',
          appointment_status: 'confirmado',
        },
      };
    }

    // SE NÃO (pagamento não confirmado) → mantém pendente e bloqueia avanço
    return {
      status: 200,
      body: {
        status: asaasStatus,
        received: false,
        confirmed: false,
        payment_status: 'pending',
        message: 'O pagamento não foi bem-sucedido ou ainda não foi confirmado pelo banco.',
      },
    };
  } catch (err) {
    console.error('[handlePaymentStatus] Erro fatal:', err);
    return {
      status: 500,
      body: {
        status: 'PENDING',
        received: false,
        confirmed: false,
        error: err.message || 'Erro interno ao verificar pagamento',
      },
    };
  }
}
