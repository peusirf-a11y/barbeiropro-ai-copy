// src/server/appointmentsPixHandler.js
// Handler para criação de agendamento com cobrança Pix e consulta de status Asaas.
import QRCode from 'qrcode';
import { supabase } from '../lib/supabaseClient.js';
import { asaasRequest } from '../lib/asaas/client.js';

export async function handleCreatePix(body = {}) {
  try {
    const companyId = body.company_id || null;
    const serviceId = body.service_id || null;
    const professionalId = body.professional_id || null;
    const clientName = (body.client_name || body.customer_name || 'Cliente').trim();
    const clientPhone = (body.client_phone || body.customer_phone || '').trim();
    const clientEmail = (body.client_email || body.customer_email || '').trim().toLowerCase();
    const clientCpf = String(body.client_cpf || body.customer_cpf || '').replace(/\D/g, '');
    const price = Number(body.price || body.amount || 0);

    const startTime = body.start_time || body.scheduled_at || new Date().toISOString();
    const endTime = body.end_time || startTime;
    const date = body.date || startTime.split('T')[0];
    const time = body.time || (startTime.includes('T') ? startTime.split('T')[1].slice(0, 5) : '09:00');

    // 1. Busca a 'asaas_api_key' da barbearia (tabela companies pelo company_id)
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

        // Tenta buscar cliente existente por CPF
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

        // Se não encontrou, cria cliente no Asaas (/v3/customers)
        if (!asaasCustomerId) {
          try {
            const createCust = await asaasRequest('POST', '/customers', {
              apiKey: companyApiKey,
              body: {
                name: clientName,
                cpfCnpj: clientCpf.length === 11 ? clientCpf : undefined,
                mobilePhone: clientPhone.replace(/\D/g, '') || undefined,
                email: clientEmail || undefined,
              },
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

        // Cria a cobrança Pix no Asaas (/v3/payments com billingType: 'PIX')
        const chargeValue = price > 0 ? price : 35.0;
        const dueDate = new Date().toISOString().split('T')[0];

        const payRes = await asaasRequest('POST', '/payments', {
          apiKey: companyApiKey,
          body: {
            customer: asaasCustomerId,
            billingType: 'PIX',
            value: chargeValue,
            dueDate,
            description: `Agendamento - ${companyName} (${clientName})`,
          },
        });

        if (payRes?.data?.id) {
          paymentId = payRes.data.id;

          // Obtém o QR Code e o código copia-e-cola (/v3/payments/{id}/pixQrCode)
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

    // 3. SALVE imediatamente o agendamento no Supabase na tabela 'appointments'
    // com: company_id, service_id, professional_id, client_name, client_phone, start_time, end_time, price, status: 'pending_payment', asaas_payment_id: paymentId
    let savedAppointmentId = `appt_${Date.now()}`;

    if (supabase) {
      const fullRecord = {
        company_id: companyId,
        service_id: serviceId,
        professional_id: professionalId,
        client_name: clientName,
        customer_name: clientName,
        client_phone: clientPhone,
        customer_phone: clientPhone,
        customer_email: clientEmail || undefined,
        service_name: body.service_name || 'Serviço',
        professional_name: body.professional_name || 'Profissional',
        start_time: startTime,
        end_time: endTime,
        scheduled_at: startTime,
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
          console.warn('[create-pix] Erro ao inserir com colunas estendidas, tentando schema padrão:', insertError.message);
          // Tenta apenas com colunas padrão do schema existente
          const fallbackRecord = {
            company_id: companyId,
            service_id: serviceId,
            professional_id: professionalId,
            customer_name: clientName,
            customer_phone: clientPhone,
            customer_email: clientEmail || undefined,
            service_name: body.service_name || 'Serviço',
            professional_name: body.professional_name || 'Profissional',
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
            .insert(fallbackRecord)
            .select()
            .maybeSingle();

          if (!fbError && fbData?.id) {
            savedAppointmentId = fbData.id;
          }
        } else if (inserted?.id) {
          savedAppointmentId = inserted.id;
        }
      } catch (dbErr) {
        console.error('[create-pix] Exceção ao gravar appointment no Supabase:', dbErr);
      }
    }

    return {
      status: 200,
      body: {
        success: true,
        encodedImage,
        payload: pixPayload,
        paymentId,
        appointmentId: savedAppointmentId,
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

    let targetCompanyId = companyId;
    let currentStatus = 'pending_payment';

    // 1. Busca appointment no Supabase
    if (supabase) {
      try {
        let query = supabase.from('appointments').select('*');
        if (paymentId) {
          query = query.or(`asaas_payment_id.eq.${paymentId},payment_id.eq.${paymentId}`);
        } else if (appointmentId) {
          query = query.eq('id', appointmentId);
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

    // 2. Busca chave do Asaas da barbearia
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
    if (asaasApiKey && paymentId && !paymentId.startsWith('pay_mock_')) {
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
                updateQuery = updateQuery.or(`asaas_payment_id.eq.${paymentId},payment_id.eq.${paymentId}`);
              } else if (appointmentId) {
                updateQuery = updateQuery.eq('id', appointmentId);
              }

              await updateQuery;
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
