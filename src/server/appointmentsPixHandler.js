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

export async function handleAsaasProxy(body = {}) {
  try {
    const method = String(body.method || 'GET').toUpperCase();
    const path = String(body.path || '/customers');
    let apiKey = String(body.apiKey || '').trim();
    const companyId = toSafeUuid(body.companyId || body.company_id);

    if (!apiKey && companyId && supabase) {
      try {
        const { data: comp } = await supabase
          .from('companies')
          .select('asaas_api_key')
          .eq('id', companyId)
          .maybeSingle();
        if (comp?.asaas_api_key) {
          apiKey = comp.asaas_api_key.trim();
        }
      } catch (_) {}
    }

    if (!apiKey && supabase) {
      try {
        const { data: comps } = await supabase
          .from('companies')
          .select('asaas_api_key')
          .not('asaas_api_key', 'is', null)
          .limit(1);
        if (comps?.[0]?.asaas_api_key) {
          apiKey = comps[0].asaas_api_key.trim();
        }
      } catch (_) {}
    }

    if (!apiKey) {
      return {
        status: 400,
        body: {
          errors: [{ description: 'Chave de API do Asaas não configurada na barbearia.' }],
          message: 'Chave de API do Asaas não configurada na barbearia.',
        },
      };
    }

    const baseUrl = getAsaasBaseUrl(apiKey);
    let url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    if (body.query && typeof body.query === 'object') {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(body.query)) {
        if (v !== undefined && v !== null) qs.append(k, String(v));
      }
      const qsStr = qs.toString();
      if (qsStr) url += `?${qsStr}`;
    }

    const headers = {
      'access_token': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'OCorte-App',
    };

    const res = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' && method !== 'HEAD' && body.body ? JSON.stringify(body.body) : undefined,
    });

    const data = await res.json().catch(() => null);
    return {
      status: res.status,
      body: data || {},
    };
  } catch (err) {
    return {
      status: 500,
      body: {
        message: err.message || 'Erro ao comunicar com o Asaas.',
      },
    };
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

    // 2º PASSO: Cria e captura a cobrança com Cartão de Crédito no Asaas (POST /v3/payments)
    const today = new Date().toISOString().split('T')[0];
    const postalCode = String(card?.postalCode || '01310100').replace(/\D/g, '') || '01310100';
    const addressNumber = String(card?.addressNumber || '100').trim() || '100';

    const buildPaymentBody = (val) => ({
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: Number(val),
      dueDate: today,
      description: `Agendamento - ${clientName}`,
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
      targetPaymentStatus: 'confirmed',
    });

    return {
      status: 200,
      body: {
        success: true,
        confirmed: true,
        status: payStatus,
        paymentId,
        payment_id: paymentId,
        appointmentId: confirmedAppt?.id || null,
        appointment_id: confirmedAppt?.id || null,
        appointment: confirmedAppt || null,
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
  if (body?.action === 'asaas_proxy') {
    return handleAsaasProxy(body);
  }
  if (body?.action === 'card' || body?.billingType === 'CREDIT_CARD' || body?.card || body?.creditCard) {
    return handleCreateCardPayment(body);
  }
  try {
    const rawCompanyId = body.companyId || body.company_id || null;
    const companyId = toSafeUuid(rawCompanyId);

    const clientName = (body.clientName || body.client_name || body.customer_name || 'Cliente').trim();
    const clientPhone = (body.clientPhone || body.client_phone || body.customer_phone || '').trim();
    const validCpf = resolveValidCpf(body.clientCpf || body.client_cpf || body.customer_cpf);
    const rawPrice = Number(body.price || body.amount || 0);
    const servicePrice = rawPrice > 0 ? rawPrice : 35.0;

    // Busca a 'asaas_api_key' da barbearia em 'companies' pelo companyId
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
      } catch (err) {
        console.warn('[create-pix] Erro ao consultar empresa no Supabase:', err);
      }
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

    // 2º PASSO: Cria a cobrança Pix no Asaas (POST https://api.asaas.com/v3/payments)
    const today = new Date().toISOString().split('T')[0];
    let payRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: Number(servicePrice),
        dueDate: today,
        description: `Agendamento - ${clientName}`,
      }),
    });
    let payData = await payRes.json().catch(() => null);

    if (!payRes.ok && servicePrice < 5) {
      payRes = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customer: customerId,
          billingType: 'PIX',
          value: 5.0,
          dueDate: today,
          description: `Agendamento - ${clientName}`,
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

    // 3º PASSO: Obtém o QR Code e Payload no Asaas (GET https://api.asaas.com/v3/payments/{paymentId}/pixQrCode)
    const qrRes = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
      method: 'GET',
      headers,
    });
    const pixData = await qrRes.json().catch(() => null);

    if (!qrRes.ok || !pixData?.encodedImage || !pixData?.payload) {
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

    // 4º PASSO: Registra a intenção com status = 'pending_payment' no Supabase.
    // Enquanto estiver 'pending_payment', NÃO aparece como corte agendado na agenda,
    // mas garante que todos os dados do agendamento estejam salvos no banco para ativação imediata assim que o Pix compensar!
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

    let targetCompanyId = toSafeUuid(companyId || bookingData?.companyId || bookingData?.company_id);
    let targetPaymentId = paymentId ? String(paymentId).trim() : '';

    // 1. Consulta agendamento existente se necessário
    if (supabase && (!targetCompanyId || !targetPaymentId)) {
      try {
        let query = supabase.from('appointments').select('*');
        if (targetPaymentId) {
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

    // Bloqueia qualquer ID simulado/inválido
    if (
      !targetPaymentId ||
      !targetPaymentId.startsWith('pay_') ||
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

    // 2. Busca a 'asaas_api_key' da barbearia na tabela 'companies'
    let asaasApiKey = '';
    if (targetCompanyId && supabase) {
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

    // Fallback se companyId não foi passado: busca empresa com asaas_api_key configurada
    if (!asaasApiKey && supabase) {
      try {
        const { data: comps } = await supabase
          .from('companies')
          .select('id, asaas_api_key')
          .not('asaas_api_key', 'is', null)
          .limit(1);
        if (comps?.[0]?.asaas_api_key) {
          asaasApiKey = comps[0].asaas_api_key.trim();
          targetCompanyId = targetCompanyId || comps[0].id;
        }
      } catch (_) {}
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

    // 3. Consulta GET https://api.asaas.com/v3/payments/{paymentId} com a asaasApiKey
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

    // SE SIM (pagamento confirmado no Asaas: RECEIVED, CONFIRMED ou RECEIVED_IN_CASH) → confirma o agendamento no sistema!
    if (asaasRes.ok && ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(asaasStatus)) {
      const confirmedAppt = await upsertAppointmentForPix({
        paymentId: targetPaymentId,
        booking: bookingData || {},
        fallbackCompanyId: targetCompanyId,
        targetStatus: 'confirmado',
        targetPaymentStatus: 'confirmed',
      });

      return {
        status: 200,
        body: {
          status: asaasStatus,
          received: true,
          confirmed: true,
          appointmentId: confirmedAppt?.id || appointmentId || null,
          appointment: confirmedAppt || null,
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
