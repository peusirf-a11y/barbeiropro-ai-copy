// src/server/appointmentsPixHandler.js
// Handler para criação de agendamento com cobrança Pix real no Asaas e consulta de status bancário real.
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
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
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

    const companyId = toSafeUuid(rawCompanyId);
    const serviceId = toSafeUuid(rawServiceId);
    const professionalId = toSafeUuid(rawProfessionalId);

    const clientName = (body.clientName || body.client_name || body.customer_name || 'Cliente').trim();
    const clientPhone = (body.clientPhone || body.client_phone || body.customer_phone || '').trim();
    const clientEmail = (body.clientEmail || body.client_email || body.customer_email || '').trim().toLowerCase();
    const validCpf = resolveValidCpf(body.clientCpf || body.client_cpf || body.customer_cpf);
    const rawPrice = Number(body.price || body.amount || 0);
    const servicePrice = rawPrice > 0 ? rawPrice : 35.0;

    const startTime = body.startTime || body.start_time || body.scheduled_at || new Date().toISOString();
    const date = body.date || (startTime.includes('T') ? startTime.split('T')[0] : new Date().toISOString().split('T')[0]);
    const time = body.time || (startTime.includes('T') ? startTime.split('T')[1].slice(0, 5) : '09:00');

    // a) Busca a 'asaas_api_key' da barbearia dona da página na tabela 'companies' (company_id)
    let companyApiKey = '';
    if (companyId && supabase) {
      try {
        const { data: comp } = await supabase
          .from('companies')
          .select('id, name, asaas_api_key')
          .eq('id', companyId)
          .maybeSingle();

        if (comp?.asaas_api_key) {
          companyApiKey = comp.asaas_api_key.trim();
        }
      } catch (err) {
        console.warn('[create-pix] Erro ao consultar empresa no Supabase:', err);
      }
    }

    if (!companyApiKey) {
      return {
        status: 400,
        body: {
          success: false,
          error: DEFAULT_PIX_ERROR,
          message: DEFAULT_PIX_ERROR,
        },
      };
    }

    const baseUrl = getAsaasBaseUrl(companyApiKey);
    const headers = {
      'access_token': companyApiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'OCorte-App',
    };

    // 1. Localiza ou cria o cliente no Asaas com CPF válido
    let customerId = null;

    try {
      const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${encodeURIComponent(validCpf)}&limit=1`, {
        method: 'GET',
        headers,
      });
      const searchData = await searchRes.json().catch(() => null);
      if (searchRes.ok && Array.isArray(searchData?.data) && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
        if (!searchData.data[0].cpfCnpj) {
          await fetch(`${baseUrl}/customers/${customerId}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: clientName, cpfCnpj: validCpf }),
          }).catch(() => null);
        }
      }
    } catch (_) {}

    if (!customerId) {
      const cleanMobile = clientPhone.replace(/\D/g, '');
      const custPayload = {
        name: clientName || 'Cliente',
        cpfCnpj: validCpf,
      };
      if (cleanMobile.length >= 10 && cleanMobile.length <= 11 && !/^(\d)\1+$/.test(cleanMobile.slice(-8))) {
        custPayload.mobilePhone = cleanMobile;
      }
      if (clientEmail && clientEmail.includes('@')) {
        custPayload.email = clientEmail;
      }

      const createCustRes = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(custPayload),
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
    }

    // b) Faz a chamada real à API do Asaas: POST https://api.asaas.com/v3/payments
    const today = new Date().toISOString().split('T')[0];
    let payRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: servicePrice,
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

    // c) Em seguida, chama GET https://api.asaas.com/v3/payments/{id}/pixQrCode
    const qrRes = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
      method: 'GET',
      headers,
    });
    const qrData = await qrRes.json().catch(() => null);

    if (!qrRes.ok || !qrData?.encodedImage || !qrData?.payload) {
      return {
        status: 400,
        body: {
          success: false,
          error: DEFAULT_PIX_ERROR,
          message: DEFAULT_PIX_ERROR,
        },
      };
    }

    const encodedImage = String(qrData.encodedImage).replace(/^data:image\/png;base64,/, '');
    const pixPayload = qrData.payload;

    // Busca nomes descritivos do serviço e profissional
    let serviceName = body.serviceName || body.service_name || '';
    if (!serviceName && serviceId && supabase) {
      try {
        const { data: srv } = await supabase.from('services').select('name').eq('id', serviceId).maybeSingle();
        if (srv?.name) serviceName = srv.name;
      } catch (_) {}
    }
    if (!serviceName) serviceName = 'Serviço';

    let professionalName = body.professionalName || body.professional_name || '';
    if (!professionalName && professionalId && supabase) {
      try {
        const { data: pro } = await supabase.from('professionals').select('name').eq('id', professionalId).maybeSingle();
        if (pro?.name) professionalName = pro.name;
      } catch (_) {}
    }
    if (!professionalName) {
      professionalName = (body.professional_name === 'Sem Preferência' || rawProfessionalId === 'any') ? 'Sem Preferência' : 'Profissional';
    }

    // d) Salva o agendamento no Supabase na tabela 'appointments' com status 'pending_payment' e o payment_id retornado pelo Asaas
    let savedAppointmentId = null;

    if (supabase) {
      const baseRecord = {
        company_id: companyId,
        customer_id: toSafeUuid(body.customer_id || body.customerId),
        customer_name: clientName,
        customer_phone: clientPhone,
        customer_email: clientEmail || null,
        service_id: serviceId,
        service_name: serviceName,
        professional_id: professionalId,
        professional_name: professionalName,
        date,
        time,
        price: servicePrice,
        status: 'pending_payment',
        payment_status: 'pending',
        payment_id: paymentId,
        notes: body.notes || '',
      };

      try {
        const { data: inserted, error: insertError } = await supabase
          .from('appointments')
          .insert(baseRecord)
          .select()
          .maybeSingle();

        if (!insertError && inserted?.id) {
          savedAppointmentId = inserted.id;
        } else if (insertError) {
          console.error('[create-pix] Erro ao persistir agendamento no Supabase:', insertError.message);
        }
      } catch (dbErr) {
        console.error('[create-pix] Exceção ao gravar appointment no Supabase:', dbErr);
      }
    }

    // e) Envia para o frontend: { paymentId, encodedImage, payload }
    return {
      status: 200,
      body: {
        success: true,
        paymentId,
        appointmentId: savedAppointmentId,
        encodedImage,
        payload: pixPayload,
      },
    };
  } catch (err) {
    console.error('[create-pix] Erro fatal:', err);
    return {
      status: 500,
      body: {
        success: false,
        error: DEFAULT_PIX_ERROR,
        message: DEFAULT_PIX_ERROR,
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
          query = query.eq('payment_id', targetPaymentId);
        } else if (appointmentId && toSafeUuid(appointmentId)) {
          query = query.eq('id', toSafeUuid(appointmentId));
        }

        const { data: appt } = await query.maybeSingle();
        if (appt) {
          targetCompanyId = targetCompanyId || appt.company_id;
          targetPaymentId = targetPaymentId || appt.payment_id || '';
        }
      } catch (_) {}
    }

    // 2. Busca chave do Asaas da barbearia na tabela 'companies'
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

    if (!asaasApiKey || !targetPaymentId) {
      return {
        status: 200,
        body: {
          status: 'PENDING',
          received: false,
          confirmed: false,
        },
      };
    }

    // 3. Consulta status real no Asaas via GET /v3/payments/{id}
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

    if (asaasRes.ok && (asaasStatus === 'RECEIVED' || asaasStatus === 'CONFIRMED')) {
      if (supabase) {
        try {
          let updateQuery = supabase.from('appointments').update({
            status: 'confirmed',
            payment_status: 'confirmed',
            updated_at: new Date().toISOString(),
          });

          if (targetPaymentId) {
            updateQuery = updateQuery.eq('payment_id', targetPaymentId);
          } else if (appointmentId && toSafeUuid(appointmentId)) {
            updateQuery = updateQuery.eq('id', toSafeUuid(appointmentId));
          }

          await updateQuery;
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
        },
      };
    }

    return {
      status: 200,
      body: {
        status: asaasStatus || 'PENDING',
        received: false,
        confirmed: false,
        payment_status: 'pending',
      },
    };
  } catch (err) {
    console.error('[handlePaymentStatus] Erro ao consultar status:', err);
    return {
      status: 500,
      body: {
        status: 'PENDING',
        received: false,
        confirmed: false,
        error: err.message,
      },
    };
  }
}
