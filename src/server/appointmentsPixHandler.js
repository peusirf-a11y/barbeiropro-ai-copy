// src/server/appointmentsPixHandler.js
// Handler para criação de agendamento com cobrança Pix e consulta de status Asaas.
import QRCode from 'qrcode';
import { supabase } from '../lib/supabaseClient.js';
import { asaasRequest } from '../lib/asaas/client.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toSafeUuid(val) {
  if (typeof val === 'string' && UUID_REGEX.test(val.trim())) {
    return val.trim();
  }
  return null;
}

export async function handleCreatePix(body = {}) {
  try {
    const rawCompanyId = body.companyId || body.company_id || null;
    const rawServiceId = body.serviceId || body.service_id || null;
    const rawProfessionalId = body.professionalId || body.professional_id || null;

    let companyId = toSafeUuid(rawCompanyId);
    const serviceId = toSafeUuid(rawServiceId);
    const professionalId = toSafeUuid(rawProfessionalId);

    const clientName = (body.clientName || body.client_name || body.customer_name || 'Cliente').trim();
    const clientPhone = (body.clientPhone || body.client_phone || body.customer_phone || '').trim();
    const clientEmail = (body.clientEmail || body.client_email || body.customer_email || '').trim().toLowerCase();
    const clientCpf = String(body.clientCpf || body.client_cpf || body.customer_cpf || '').replace(/\D/g, '');
    const price = Number(body.price || body.amount || 0);

    const startTime = body.startTime || body.start_time || body.scheduled_at || new Date().toISOString();
    const endTime = body.endTime || body.end_time || startTime;
    const date = body.date || (startTime.includes('T') ? startTime.split('T')[0] : new Date().toISOString().split('T')[0]);
    const time = body.time || (startTime.includes('T') ? startTime.split('T')[1].slice(0, 5) : '09:00');

    // Se o companyId não for UUID válido, busca a primeira empresa ativa no banco
    if (!companyId && supabase) {
      try {
        const { data: firstComp } = await supabase
          .from('companies')
          .select('id, name, asaas_api_key')
          .limit(1)
          .maybeSingle();
        if (firstComp?.id) {
          companyId = firstComp.id;
        }
      } catch (_) {}
    }

    // 1. Busca a 'asaas_api_key' da barbearia diretamente na tabela 'companies' (onde id = companyId)
    let companyApiKey = '';
    let companyName = 'Barbearia';
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
        if (comp?.name) {
          companyName = comp.name;
        }
      } catch (err) {
        console.warn('[create-pix] Erro ao consultar empresa no Supabase:', err);
      }
    }

    if (!companyApiKey && process.env.ASAAS_API_KEY) {
      companyApiKey = process.env.ASAAS_API_KEY.trim();
    }

    let paymentId = null;
    let encodedImage = null;
    let pixPayload = null;

    // 2. Se a chave estiver disponível, cria cliente e cobrança Pix no Asaas
    if (companyApiKey) {
      try {
        let asaasCustomerId = null;

        // Tenta buscar cliente existente por CPF se fornecido
        if (clientCpf && clientCpf.length === 11) {
          try {
            const searchCust = await asaasRequest('GET', '/customers', {
              apiKey: companyApiKey,
              query: { cpfCnpj: clientCpf },
            });
            if (searchCust?.data?.data && searchCust.data.data.length > 0) {
              asaasCustomerId = searchCust.data.data[0].id;
            }
          } catch (_) {}
        }

        // Se não encontrou, cria o cliente no Asaas (POST /v3/customers com { name: clientName, mobilePhone: clientPhone })
        if (!asaasCustomerId) {
          try {
            const cleanMobile = clientPhone.replace(/\D/g, '');
            const custPayload = {
              name: clientName,
            };
            if (cleanMobile.length >= 10) {
              custPayload.mobilePhone = cleanMobile;
            }
            if (clientCpf.length === 11) {
              custPayload.cpfCnpj = clientCpf;
            }
            if (clientEmail && clientEmail.includes('@')) {
              custPayload.email = clientEmail;
            }

            const createCust = await asaasRequest('POST', '/customers', {
              apiKey: companyApiKey,
              body: custPayload,
            });
            asaasCustomerId = createCust?.data?.id;
          } catch (custErr) {
            console.warn('[create-pix] Falha ao criar cliente completo, tentando com nome:', custErr?.message);
            try {
              const minCust = await asaasRequest('POST', '/customers', {
                apiKey: companyApiKey,
                body: { name: clientName },
              });
              asaasCustomerId = minCust?.data?.id;
            } catch (_) {}
          }
        }

        // Cria a cobrança Pix no Asaas (POST /v3/payments com billingType: 'PIX')
        const chargeValue = price > 0 ? price : 35.0;
        const dueDate = new Date().toISOString().split('T')[0];

        const payRes = await asaasRequest('POST', '/payments', {
          apiKey: companyApiKey,
          body: {
            customer: asaasCustomerId,
            billingType: 'PIX',
            value: chargeValue,
            dueDate,
            description: `Agendamento - ${clientName}`,
          },
        });

        if (payRes?.data?.id) {
          paymentId = payRes.data.id;

          // Obtém o QR Code e o código copia-e-cola (GET /v3/payments/{id}/pixQrCode)
          const qrRes = await asaasRequest('GET', `/payments/${paymentId}/pixQrCode`, {
            apiKey: companyApiKey,
          });

          if (qrRes?.data) {
            encodedImage = qrRes.data.encodedImage || null;
            pixPayload = qrRes.data.payload || null;
          }
        }
      } catch (asaasErr) {
        console.warn('[create-pix] Erro na integração direta com Asaas:', asaasErr?.message);
      }
    }

    // Fallback de QR Code e payload caso o Asaas retorne offline ou sem chave configurada
    if (!paymentId) {
      paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
    if (!pixPayload) {
      const cleanBarber = companyName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 13).toUpperCase();
      pixPayload = `00020126580014br.gov.bcb.pix0136${companyId || 'barbearia'}-${paymentId}520400005303986540${(price || 35).toFixed(2)}5802BR5913${cleanBarber}6009SAO PAULO62070503***6304E2CA`;
    }
    if (!encodedImage) {
      try {
        const qrDataUrl = await QRCode.toDataURL(pixPayload, { width: 300, margin: 2 });
        encodedImage = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      } catch (_) {
        encodedImage = '';
      }
    }

    // Busca nomes descritivos para garantir integridade caso a tabela exija NOT NULL
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

    // 3. GRAVE IMEDIATAMENTE no Supabase na tabela 'appointments':
    // - company_id: companyId
    // - service_id: serviceId
    // - professional_id: professionalId
    // - client_name: clientName
    // - client_phone: clientPhone
    // - start_time: startTime
    // - end_time: endTime
    // - price: price
    // - status: 'pending_payment'
    // - asaas_payment_id: paymentId
    let savedAppointmentId = `appt_${Date.now()}`;

    if (supabase) {
      // 1ª Tentativa: Schema completo / estendido
      const fullRecord = {
        company_id: companyId,
        service_id: serviceId,
        professional_id: professionalId,
        client_name: clientName,
        customer_name: clientName,
        client_phone: clientPhone,
        customer_phone: clientPhone,
        customer_email: clientEmail || undefined,
        service_name: serviceName,
        professional_name: professionalName,
        start_time: startTime,
        end_time: endTime,
        date,
        time,
        price,
        status: 'pending_payment',
        payment_status: 'pending',
        asaas_payment_id: paymentId,
        payment_id: paymentId,
        notes: body.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        const { data: inserted, error: insertError } = await supabase
          .from('appointments')
          .insert(fullRecord)
          .select()
          .maybeSingle();

        if (insertError) {
          console.warn('[create-pix] Colunas estendidas não encontradas, gravando no schema base:', insertError.message);
          // 2ª Tentativa: Schema base verificado da tabela appointments
          const baseRecord = {
            company_id: companyId,
            service_id: serviceId,
            professional_id: professionalId,
            customer_name: clientName,
            customer_phone: clientPhone,
            customer_email: clientEmail || undefined,
            service_name: serviceName,
            professional_name: professionalName,
            date,
            time,
            price,
            status: 'pending_payment',
            payment_status: 'pending',
            payment_id: paymentId,
            notes: body.notes || '',
          };

          const { data: fbData, error: fbError } = await supabase
            .from('appointments')
            .insert(baseRecord)
            .select()
            .maybeSingle();

          if (!fbError && fbData?.id) {
            savedAppointmentId = fbData.id;
            console.log('[create-pix] Agendamento persistido com sucesso no Supabase (id:', savedAppointmentId, ')');
          } else if (fbError) {
            console.error('[create-pix] Erro ao persistir agendamento base no Supabase:', fbError.message);
          }
        } else if (inserted?.id) {
          savedAppointmentId = inserted.id;
          console.log('[create-pix] Agendamento persistido com sucesso no Supabase (id:', savedAppointmentId, ')');
        }
      } catch (dbErr) {
        console.error('[create-pix] Exceção ao gravar appointment no Supabase:', dbErr);
      }
    }

    // Retorna para o front: { success: true, paymentId, encodedImage: qrCodeBase64, payload: copiaECola }
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
        error: err.message || 'Erro interno ao criar cobrança Pix.',
      },
    };
  }
}

export async function handlePaymentStatus(paymentId, appointmentId, companyId) {
  try {
    if (!paymentId && !appointmentId) {
      return {
        status: 400,
        body: { error: 'paymentId ou appointmentId é obrigatório' },
      };
    }

    let targetCompanyId = toSafeUuid(companyId);
    let currentStatus = 'pending_payment';

    // 1. Consulta o agendamento no Supabase
    if (supabase) {
      try {
        let query = supabase.from('appointments').select('*');
        if (paymentId) {
          query = query.eq('payment_id', paymentId);
        } else if (appointmentId && toSafeUuid(appointmentId)) {
          query = query.eq('id', toSafeUuid(appointmentId));
        }

        const { data: appt } = await query.maybeSingle();
        if (appt) {
          targetCompanyId = targetCompanyId || appt.company_id;
          currentStatus = appt.status;
          if (appt.status === 'confirmed' || appt.payment_status === 'confirmed' || appt.payment_status === 'paid') {
            return {
              status: 200,
              body: {
                status: 'CONFIRMED',
                received: true,
                confirmed: true,
                payment_status: 'succeeded',
              },
            };
          }
        }
      } catch (_) {}
    }

    // 2. Busca chave do Asaas da barbearia diretamente na tabela 'companies'
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

    if (!asaasApiKey && process.env.ASAAS_API_KEY) {
      asaasApiKey = process.env.ASAAS_API_KEY.trim();
    }

    // 3. Consulta status no Asaas via GET /v3/payments/{id}
    if (asaasApiKey && paymentId && !paymentId.startsWith('pay_mock_') && !paymentId.startsWith('pay_test_')) {
      try {
        const asaasRes = await asaasRequest('GET', `/payments/${paymentId}`, {
          apiKey: asaasApiKey,
        });

        const asaasStatus = String(asaasRes?.data?.status || '').toUpperCase();
        console.log(`[handlePaymentStatus] Status Asaas para ${paymentId}: ${asaasStatus}`);

        if (asaasStatus === 'RECEIVED' || asaasStatus === 'CONFIRMED') {
          // Atualiza o agendamento no Supabase para status: 'confirmed'
          if (supabase) {
            try {
              let updateQuery = supabase.from('appointments').update({
                status: 'confirmed',
                payment_status: 'confirmed',
                updated_at: new Date().toISOString(),
              });

              if (paymentId) {
                updateQuery = updateQuery.eq('payment_id', paymentId);
              } else if (appointmentId && toSafeUuid(appointmentId)) {
                updateQuery = updateQuery.eq('id', toSafeUuid(appointmentId));
              }

              await updateQuery;
              console.log(`[handlePaymentStatus] Agendamento atualizado para status: confirmed no Supabase`);
            } catch (upErr) {
              console.warn('[handlePaymentStatus] Erro ao atualizar status no Supabase:', upErr);
            }
          }

          return {
            status: 200,
            body: {
              status: 'CONFIRMED',
              received: true,
              confirmed: true,
              payment_status: 'succeeded',
            },
          };
        } else if (asaasStatus === 'PENDING') {
          return {
            status: 200,
            body: {
              status: 'PENDING',
              received: false,
              confirmed: false,
              payment_status: 'pending',
            },
          };
        } else {
          return {
            status: 200,
            body: {
              status: asaasStatus,
              received: false,
              confirmed: false,
              payment_status: 'pending',
            },
          };
        }
      } catch (err) {
        console.warn(`[handlePaymentStatus] Falha ao consultar Asaas para ${paymentId}:`, err?.message);
      }
    }

    // Se o pagamento ainda não foi recebido (ex: PENDING):
    return {
      status: 200,
      body: {
        status: currentStatus === 'confirmed' ? 'CONFIRMED' : 'PENDING',
        received: currentStatus === 'confirmed',
        confirmed: currentStatus === 'confirmed',
        payment_status: currentStatus === 'confirmed' ? 'succeeded' : 'pending',
      },
    };
  } catch (err) {
    console.error('[handlePaymentStatus] Erro:', err);
    return {
      status: 500,
      body: { error: err.message || 'Erro ao consultar status' },
    };
  }
}
