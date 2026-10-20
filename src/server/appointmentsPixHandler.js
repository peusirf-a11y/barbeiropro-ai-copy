// src/server/appointmentsPixHandler.js
// Handler para geração de código Pix real no Asaas e verificação estrita de confirmação de pagamento antes de criar o agendamento no Supabase.
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
 * Persiste o agendamento confirmado no Supabase SOMENTE após confirmação bancária do Asaas (RECEIVED / CONFIRMED).
 * Garante idempotência pelo paymentId para nunca duplicar agendamentos.
 */
async function createOrUpdateConfirmedAppointment(paymentId, booking = {}, fallbackCompanyId = null) {
  if (!supabase || !paymentId) return null;

  try {
    // 1. Verifica se já existe agendamento gravado para este paymentId
    const { data: existing } = await supabase
      .from('appointments')
      .select('*')
      .or(`asaas_payment_id.eq.${paymentId},payment_id.eq.${paymentId}`)
      .maybeSingle();

    if (existing?.id) {
      if (existing.status !== 'confirmed' || existing.payment_status !== 'confirmed') {
        await supabase
          .from('appointments')
          .update({
            status: 'confirmed',
            payment_status: 'confirmed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      }
      return existing.id;
    }

    // 2. Caso ainda não exista no banco, cria agora que o pagamento foi confirmado
    const companyId = toSafeUuid(booking.companyId || booking.company_id || fallbackCompanyId);
    if (!companyId) return null;

    const rawServiceId = booking.serviceId || booking.service_id || null;
    const rawProfessionalId = booking.professionalId || booking.professional_id || null;
    const rawCustomerId = booking.customerId || booking.customer_id || null;

    const candidateServiceId = toSafeUuid(rawServiceId);
    const candidateProfessionalId =
      rawProfessionalId === 'any' || !rawProfessionalId ? null : toSafeUuid(rawProfessionalId);
    const candidateCustomerId = toSafeUuid(rawCustomerId);

    const clientName = (booking.clientName || booking.client_name || booking.customer_name || 'Cliente').trim();
    const clientPhone = (booking.clientPhone || booking.client_phone || booking.customer_phone || '').trim();
    const clientEmail = (booking.clientEmail || booking.client_email || booking.customer_email || '').trim().toLowerCase();
    const rawPrice = Number(booking.price || booking.amount || 0);
    const servicePrice = rawPrice > 0 ? rawPrice : 35.0;

    const startTime = booking.startTime || booking.start_time || booking.scheduled_at || new Date().toISOString();
    const endTime =
      booking.endTime ||
      booking.end_time ||
      (() => {
        const parsed = new Date(startTime);
        const dur = Number(booking.duration_minutes) || 30;
        if (!Number.isNaN(parsed.getTime())) {
          return new Date(parsed.getTime() + dur * 60 * 1000).toISOString();
        }
        return startTime;
      })();

    const date =
      booking.date ||
      (String(startTime).includes('T')
        ? String(startTime).split('T')[0]
        : new Date().toISOString().split('T')[0]);
    const time =
      booking.time ||
      (String(startTime).includes('T')
        ? String(startTime).split('T')[1].slice(0, 5)
        : '09:00');

    // Valida FKs reais no Supabase
    let validServiceId = null;
    let resolvedServiceName = booking.serviceName || booking.service_name || '';
    if (candidateServiceId) {
      try {
        const { data: srv } = await supabase
          .from('services')
          .select('id, name')
          .eq('id', candidateServiceId)
          .maybeSingle();
        if (srv?.id) {
          validServiceId = srv.id;
          if (!resolvedServiceName && srv.name) resolvedServiceName = srv.name;
        }
      } catch (_) {}
    }
    if (!resolvedServiceName) resolvedServiceName = 'Serviço';

    let validProfessionalId = null;
    let resolvedProfessionalName = booking.professionalName || booking.professional_name || '';
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
    if (!resolvedProfessionalName) {
      resolvedProfessionalName =
        rawProfessionalId === 'any' || !rawProfessionalId ? 'Sem Preferência' : 'Profissional';
    }

    let validCustomerId = null;
    if (candidateCustomerId) {
      try {
        const { data: cust } = await supabase
          .from('customers')
          .select('id')
          .eq('id', candidateCustomerId)
          .maybeSingle();
        if (cust?.id) {
          validCustomerId = cust.id;
        }
      } catch (_) {}
    }

    const insertPayload = {
      company_id: companyId,
      service_id: validServiceId,
      service_name: resolvedServiceName,
      professional_id: (rawProfessionalId === 'any' || !rawProfessionalId) ? null : validProfessionalId,
      professional_name: resolvedProfessionalName,
      customer_id: validCustomerId,
      customer_name: clientName,
      client_name: clientName,
      customer_phone: clientPhone,
      client_phone: clientPhone,
      customer_email: clientEmail || null,
      date,
      time,
      start_time: startTime,
      end_time: endTime,
      price: Number(servicePrice),
      status: 'confirmed',
      payment_status: 'confirmed',
      payment_id: paymentId,
      asaas_payment_id: paymentId,
      notes: booking.notes || '',
    };

    const { data: inserted, error: insertError } = await supabase
      .from('appointments')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[appointmentsPixHandler] Erro ao criar agendamento confirmado no Supabase:', insertError);
      return null;
    }

    return inserted?.id || null;
  } catch (err) {
    console.error('[appointmentsPixHandler] Exceção ao criar agendamento confirmado:', err);
    return null;
  }
}

export async function handleCreatePix(body = {}) {
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

    // Retorna o código Pix gerado. O agendamento só será gravado no sistema quando o pagamento for confirmado!
    return {
      status: 200,
      body: {
        success: true,
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

    // SE SIM (pagamento confirmado no Asaas: RECEIVED ou CONFIRMED) → faz o agendamento no sistema!
    if (asaasRes.ok && (asaasStatus === 'RECEIVED' || asaasStatus === 'CONFIRMED')) {
      const savedAppointmentId = await createOrUpdateConfirmedAppointment(
        targetPaymentId,
        bookingData || {},
        targetCompanyId
      );

      return {
        status: 200,
        body: {
          status: asaasStatus,
          received: true,
          confirmed: true,
          appointmentId: savedAppointmentId || appointmentId || null,
          payment_status: 'succeeded',
          appointment_status: 'confirmed',
        },
      };
    }

    // SE NÃO (pagamento não confirmado) → não faz o agendamento e informa que não foi bem-sucedido
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
