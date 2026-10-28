// Express / Node.js Webhook Router do Asaas para O CORTE
// Trata eventos de pagamento, cobrança gerada, vencida, confirmada e estornada de forma autônoma.

import { Company, FinancialEntry } from './entities';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/**
  * Processador central de Webhook Asaas.
  * @param {object} req - Objeto de requisição Express ou Fetch API
  * @param {object} res - Objeto de resposta opcional
  */
export async function handleAsaasWebhook(req, res) {
  if (req?.method === 'GET' || req?.method === 'HEAD' || req?.method === 'OPTIONS') {
    const payload = { ok: true, status: 'healthy', service: 'asaas-webhook' };
    if (res) return res.status(200).json(payload);
    return { status: 200, body: payload };
  }

  const startedAt = Date.now();
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const eventId = body.id || `evt_${Date.now()}`;
  const eventType = typeof body.event === 'string' ? body.event.trim() : '';
  const payment = body.payment && typeof body.payment === 'object' ? body.payment : null;
  const subscription = body.subscription && typeof body.subscription === 'object' ? body.subscription : null;

  try {
    // 1. Validação estrita do Token do Webhook (asaas-access-token)
    const expectedToken = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
    const receivedToken = String(
      req.headers?.['asaas-access-token'] ||
      req.headers?.['x-asaas-access-token'] ||
      ''
    ).trim();

    if (!expectedToken || !receivedToken || !constantTimeEquals(receivedToken, expectedToken)) {
      console.warn('[Asaas Webhook] Acesso negado: token de webhook ausente ou inválido.');
      if (res) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Webhook token inválido.' });
      return { status: 401, body: { error: 'UNAUTHORIZED', message: 'Webhook token inválido.' } };
    }

    // 2. Validação dos parâmetros esperados no payload
    if (!eventType || (!payment?.id && eventType !== 'SUBSCRIPTION_DELETED')) {
      if (res) return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Parâmetros obrigatórios (event, payment.id) ausentes.' });
      return { status: 400, body: { error: 'INVALID_PAYLOAD', message: 'Parâmetros obrigatórios (event, payment.id) ausentes.' } };
    }

    if (payment?.id && !/^pay_[a-zA-Z0-9_]+$/.test(String(payment.id))) {
      if (res) return res.status(400).json({ error: 'INVALID_PAYMENT_ID', message: 'Formato de payment.id inválido.' });
      return { status: 400, body: { error: 'INVALID_PAYMENT_ID', message: 'Formato de payment.id inválido.' } };
    }

    console.info(`[Asaas Webhook] Processando evento: ${eventType} (ID: ${eventId})`);

    let outcome = { handled: false, eventType };

    // 3. Tratamento Independente por Tipo de Evento
    switch (eventType) {
      case 'PAYMENT_CREATED': {
        outcome = {
          handled: true,
          status: 'CREATED',
          message: `Cobrança ${payment.id} gerada com sucesso para R$ ${payment.value}`,
        };
        break;
      }

      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        const customerId = payment.customer;
        const subId = payment.subscription;
        const value = Number(payment.value || 0);
        const externalRef = payment.externalReference;

        // 3A. Verifica se o pagamento corresponde a um agendamento Pix/Cartão na tabela 'appointments'
        let matchedAppointment = null;
        if (isSupabaseConfigured && supabase && payment.id) {
          try {
            const { data: apptRow } = await supabase
              .from('appointments')
              .select('id, company_id, status, payment_status')
              .or(`payment_id.eq.${payment.id},asaas_payment_id.eq.${payment.id}`)
              .maybeSingle();

            if (apptRow?.id) {
              matchedAppointment = apptRow;
              await supabase
                .from('appointments')
                .update({
                  status: 'confirmado',
                  payment_status: 'confirmed',
                  paid: true,
                })
                .eq('id', apptRow.id);
            }
          } catch (_) {}
        }

        // 3B. Identifica estritamente a empresa vinculada (SEM fallback para companies[0] para proteger isolamento multi-tenant)
        const companies = await Company.list();
        const targetCompany = companies.find(
          (c) =>
            (externalRef && String(c.id) === String(externalRef)) ||
            (subId && String(c.asaas_subscription_id) === String(subId)) ||
            (customerId && String(c.asaas_customer_id) === String(customerId))
        );

        if (!targetCompany && !matchedAppointment) {
          if (res) return res.status(404).json({ error: 'COMPANY_NOT_FOUND', message: 'Empresa ou agendamento correspondente ao pagamento não encontrado.' });
          return { status: 404, body: { error: 'COMPANY_NOT_FOUND', message: 'Empresa ou agendamento correspondente ao pagamento não encontrado.' } };
        }

        // Valida o status real da cobrança diretamente na API oficial do Asaas se houver chave configurada no servidor
        const masterApiKey = (process.env.ASAAS_API_KEY || '').trim();
        if (masterApiKey && targetCompany) {
          const isSandbox = masterApiKey.includes('hmlg') || masterApiKey.includes('sandbox');
          const baseUrl = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
          const verifyRes = await fetch(`${baseUrl}/payments/${encodeURIComponent(payment.id)}`, {
            method: 'GET',
            headers: {
              'access_token': masterApiKey,
              'Accept': 'application/json',
              'User-Agent': 'OCorte-App',
            },
          });
          const verifiedPayment = await verifyRes.json().catch(() => null);
          const verifiedStatus = String(verifiedPayment?.status || '').toUpperCase();
          if (!verifyRes.ok || !['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(verifiedStatus)) {
            if (res) return res.status(400).json({ error: 'UNVERIFIED_PAYMENT_STATUS', message: 'Status do pagamento não confirmado na API do Asaas.' });
            return { status: 400, body: { error: 'UNVERIFIED_PAYMENT_STATUS', message: 'Status do pagamento não confirmado na API do Asaas.' } };
          }
        }

        if (targetCompany) {
          const updateData = {
            billing_status: 'ACTIVE',
            status: 'active',
            subscription_status: 'active',
            last_payment_at: new Date().toISOString(),
          };
          try {
            if (isSupabaseConfigured && supabase) {
              await supabase.from('companies').update(updateData).eq('id', targetCompany.id);
            }
          } catch (_) {}
          await Company.update(targetCompany.id, updateData);

          await FinancialEntry.create({
            company_id: targetCompany.id,
            description: `Assinatura Asaas - ${payment.description || 'Plano O CORTE'}`,
            type: 'income',
            amount: value || 99,
            payment_method: payment.billingType || 'CREDIT_CARD',
            status: 'paid',
            asaas_payment_id: payment.id,
          });
        }

        outcome = {
          handled: true,
          status: 'CONFIRMED',
          company_id: targetCompany?.id || matchedAppointment?.company_id || null,
          appointment_id: matchedAppointment?.id || null,
          message: `Pagamento de R$ ${value} processado com sucesso.`,
        };
        break;
      }

      case 'PAYMENT_OVERDUE': {
        const externalRef = payment.externalReference;
        const subId = payment.subscription;
        const companies = await Company.list();
        const targetCompany = companies.find(
          (c) =>
            (externalRef && String(c.id) === String(externalRef)) ||
            (subId && String(c.asaas_subscription_id) === String(subId)) ||
            (payment.customer && String(c.asaas_customer_id) === String(payment.customer))
        );

        if (targetCompany) {
          const overduePayload = {
            billing_status: 'OVERDUE',
            subscription_status: 'overdue',
            past_due_since: new Date().toISOString(),
          };
          try {
            if (isSupabaseConfigured && supabase) {
              await supabase.from('companies').update(overduePayload).eq('id', targetCompany.id);
            }
          } catch (_) {}
          await Company.update(targetCompany.id, overduePayload);
        }

        outcome = {
          handled: true,
          status: 'OVERDUE',
          company_id: targetCompany?.id,
          message: `Cobrança ${payment.id} está vencida. Status alterado para OVERDUE.`,
        };
        break;
      }

      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_DELETED': {
        const externalRef = payment.externalReference;
        const subId = payment.subscription;
        const companies = await Company.list();
        const targetCompany = companies.find(
          (c) =>
            (externalRef && String(c.id) === String(externalRef)) ||
            (subId && String(c.asaas_subscription_id) === String(subId)) ||
            (payment.customer && String(c.asaas_customer_id) === String(payment.customer))
        );

        if (targetCompany) {
          const refundPayload = {
            billing_status: 'CANCELED',
            subscription_status: 'canceled',
            status: 'blocked',
          };
          try {
            if (isSupabaseConfigured && supabase) {
              await supabase.from('companies').update(refundPayload).eq('id', targetCompany.id);
            }
          } catch (_) {}
          await Company.update(targetCompany.id, refundPayload);
        }

        outcome = {
          handled: true,
          status: 'REFUNDED',
          company_id: targetCompany?.id,
          message: `Pagamento ${payment.id} estornado.`,
        };
        break;
      }

      case 'SUBSCRIPTION_DELETED': {
        const subId = subscription?.id || payment?.subscription || body.id;
        const customerId = subscription?.customer || payment?.customer;
        const externalRef = subscription?.externalReference || payment?.externalReference;
        const companies = await Company.list();
        const targetCompany = companies.find(
          (c) =>
            (subId && String(c.asaas_subscription_id) === String(subId)) ||
            (externalRef && String(c.id) === String(externalRef)) ||
            (customerId && String(c.asaas_customer_id) === String(customerId))
        );

        if (targetCompany) {
          const canceledPayload = {
            subscription_status: 'canceled',
            billing_status: 'CANCELED',
            updated_at: new Date().toISOString(),
          };
          try {
            if (isSupabaseConfigured && supabase) {
              await supabase.from('companies').update(canceledPayload).eq('id', targetCompany.id);
            }
          } catch (_) {}
          await Company.update(targetCompany.id, canceledPayload);
        }

        outcome = {
          handled: true,
          status: 'SUBSCRIPTION_DELETED',
          company_id: targetCompany?.id || null,
          message: `Assinatura ${subId} encerrada no Asaas.`,
        };
        break;
      }

      default: {
        outcome = {
          handled: false,
          reason: 'EVENT_NOT_SUBSCRIBED',
          eventType,
        };
        break;
      }
    }

    const durationMs = Date.now() - startedAt;
    console.info(`[Asaas Webhook] Evento ${eventType} finalizado em ${durationMs}ms:`, outcome);

    const responsePayload = {
      ok: true,
      event_id: eventId,
      outcome,
      duration_ms: durationMs,
    };

    if (res) return res.status(200).json(responsePayload);
    return { status: 200, body: responsePayload };
  } catch (err) {
    console.error('[Asaas Webhook] Erro crítico no processamento:', err);
    if (res) return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    return { status: 500, body: { error: 'INTERNAL_SERVER_ERROR', message: err.message } };
  }
}
