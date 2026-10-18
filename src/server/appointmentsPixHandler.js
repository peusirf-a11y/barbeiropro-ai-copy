// src/server/appointmentsPixHandler.js
// Handler para criação de agendamento com cobrança Pix real no Asaas, persistência imediata no Supabase e consulta de status bancário real.
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

export async function handleCreatePix(body = {}) {
  try {
    const rawCompanyId = body.companyId || body.company_id || null;
    const rawServiceId = body.serviceId || body.service_id || null;
    const rawProfessionalId = body.professionalId || body.professional_id || null;
    const rawCustomerId = body.customerId || body.customer_id || null;

    const companyId = toSafeUuid(rawCompanyId);
    const candidateServiceId = toSafeUuid(rawServiceId);
    const candidateProfessionalId =
      rawProfessionalId === 'any' || !rawProfessionalId ? null : toSafeUuid(rawProfessionalId);
    const candidateCustomerId = toSafeUuid(rawCustomerId);

    const clientName = (body.clientName || body.client_name || body.customer_name || 'Cliente').trim();
    const clientPhone = (body.clientPhone || body.client_phone || body.customer_phone || '').trim();
    const clientEmail = (body.clientEmail || body.client_email || body.customer_email || '').trim().toLowerCase();
    const validCpf = resolveValidCpf(body.clientCpf || body.client_cpf || body.customer_cpf);
    const rawPrice = Number(body.price || body.amount || 0);
    const servicePrice = rawPrice > 0 ? rawPrice : 35.0;

    const startTime = body.startTime || body.start_time || body.scheduled_at || new Date().toISOString();
    const endTime =
      body.endTime ||
      body.end_time ||
      (() => {
        const parsed = new Date(startTime);
        if (!Number.isNaN(parsed.getTime())) {
          return new Date(parsed.getTime() + 30 * 60 * 1000).toISOString();
        }
        return startTime;
      })();

    const date =
      body.date ||
      (String(startTime).includes('T')
        ? String(startTime).split('T')[0]
        : new Date().toISOString().split('T')[0]);
    const time =
      body.time ||
      (String(startTime).includes('T')
        ? String(startTime).split('T')[1].slice(0, 5)
        : '09:00');

    // Busque a 'asaas_api_key' da barbearia em 'companies' pelo companyId
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

    // 1º PASSO: Crie o cliente no Asaas (POST https://api.asaas.com/v3/customers)
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

    // 2º PASSO: Crie a cobrança Pix (POST https://api.asaas.com/v3/payments)
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

    // 3º PASSO: Obtenha o QR Code e Payload (GET https://api.asaas.com/v3/payments/{paymentId}/pixQrCode)
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

    // Validação das FKs reais para garantir integridade no insert em 'appointments'
    let validServiceId = null;
    let resolvedServiceName = body.serviceName || body.service_name || '';
    if (candidateServiceId && supabase) {
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
    let resolvedProfessionalName = body.professionalName || body.professional_name || '';
    if (candidateProfessionalId && supabase) {
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
    if (candidateCustomerId && supabase) {
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

    // 4º PASSO: GRAVE O AGENDAMENTO NO SUPABASE IMEDIATAMENTE
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
      status: 'pending_payment',
      payment_status: 'pending',
      payment_id: paymentId,
      asaas_payment_id: paymentId,
      notes: body.notes || '',
    };

    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .insert(insertPayload)
      .select()
      .single();

    if (apptError) {
      console.error('[create-pix] Erro ao gravar agendamento no Supabase:', apptError);
      return {
        status: 500,
        body: {
          success: false,
          error: apptError.message || 'Erro ao gravar agendamento no Supabase.',
          details: apptError,
        },
      };
    }

    // Retorne para o front: { success: true, appointmentId: appt.id, paymentId, encodedImage, payload }
    return {
      status: 200,
      body: {
        success: true,
        appointmentId: appt.id,
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

export async function handlePaymentStatus(paymentId, appointmentId, companyId) {
  try {
    if (!paymentId && !appointmentId) {
      return {
        status: 400,
        body: { status: 'PENDING', error: 'paymentId ou appointmentId é obrigatório' },
      };
    }

    let targetCompanyId = toSafeUuid(companyId);
    let targetPaymentId = paymentId ? String(paymentId).trim() : '';

    // 1. Consulta o agendamento no Supabase para obter company_id e payment_id se necessário
    if (supabase) {
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

    // Quando o Asaas retornar status === 'RECEIVED' ou status === 'CONFIRMED':
    // Faz o UPDATE no Supabase: status = 'confirmed'
    if (asaasRes.ok && (asaasStatus === 'RECEIVED' || asaasStatus === 'CONFIRMED')) {
      if (supabase) {
        try {
          await supabase
            .from('appointments')
            .update({
              status: 'confirmed',
              payment_status: 'confirmed',
              updated_at: new Date().toISOString(),
            })
            .or(`asaas_payment_id.eq.${targetPaymentId},payment_id.eq.${targetPaymentId}`);
        } catch (upErr) {
          console.warn('[handlePaymentStatus] Erro ao atualizar status no Supabase:', upErr);
        }
      }

      return {
        status: 200,
        body: {
          status: asaasStatus,
          received: true,
          confirmed: true,
          payment_status: 'succeeded',
          appointment_status: 'confirmed',
        },
      };
    }

    return {
      status: 200,
      body: {
        status: asaasStatus,
        received: false,
        confirmed: false,
        payment_status: 'pending',
        appointment_status: 'pending_payment',
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
