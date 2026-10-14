// Express / Node.js Webhook Router do Asaas para O CORTE / BarberPass
// Trata eventos de pagamento, cobrança gerada, vencida, confirmada e estornada de forma autônoma.

import { Company, FinancialEntry } from './entities';

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
  const startedAt = Date.now();
  const eventId = req.body?.id || `evt_${Date.now()}`;
  const eventType = req.body?.event || 'UNKNOWN';
  const payment = req.body?.payment || {};

  try {
    // 1. Validação do Token do Webhook
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN || 'barberpass_asaas_token';
    const receivedToken = req.headers?.['asaas-access-token'] || req.headers?.['x-asaas-access-token'] || '';

    if (process.env.NODE_ENV === 'production' && !constantTimeEquals(receivedToken, expectedToken)) {
      console.warn('[Asaas Webhook] Token inválido recebido:', receivedToken);
      if (res) return res.status(401).json({ error: 'UNAUTHORIZED' });
      return { status: 401, body: { error: 'UNAUTHORIZED' } };
    }

    console.info(`[Asaas Webhook] Processando evento: ${eventType} (ID: ${eventId})`);

    let outcome = { handled: false, eventType };

    // 2. Tratamento Independente por Tipo de Evento
    switch (eventType) {
      case 'PAYMENT_CREATED': {
        // Cobrança gerada
        outcome = {
          handled: true,
          status: 'CREATED',
          message: `Cobrança ${payment.id} gerada com sucesso para R$ ${payment.value}`,
        };
        break;
      }

      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        // Pagamento confirmado/recebido
        const customerId = payment.customer;
        const value = payment.value;
        const externalRef = payment.externalReference;

        // Atualiza a empresa vinculada para ACTIVE
        const companies = await Company.list();
        const targetCompany = companies.find(c => c.id === externalRef || c.asaas_customer_id === customerId) || companies[0];

        if (targetCompany) {
          await Company.update(targetCompany.id, {
            billing_status: 'ACTIVE',
            status: 'active',
            last_payment_at: new Date().toISOString(),
          });
        }

        // Registra entrada financeira
        await FinancialEntry.create({
          company_id: targetCompany?.id || 'comp_demo_01',
          description: `Assinatura Asaas - ${payment.description || 'Plano O CORTE'}`,
          type: 'income',
          amount: value || 99,
          payment_method: payment.billingType || 'CREDIT_CARD',
          status: 'paid',
          asaas_payment_id: payment.id,
        });

        outcome = {
          handled: true,
          status: 'CONFIRMED',
          company_id: targetCompany?.id,
          message: `Pagamento de R$ ${value} processado com sucesso.`,
        };
        break;
      }

      case 'PAYMENT_OVERDUE': {
        // Cobrança vencida
        const externalRef = payment.externalReference;
        const companies = await Company.list();
        const targetCompany = companies.find(c => c.id === externalRef || c.asaas_customer_id === payment.customer);

        if (targetCompany) {
          await Company.update(targetCompany.id, {
            billing_status: 'PAST_DUE',
            past_due_since: new Date().toISOString(),
          });
        }

        outcome = {
          handled: true,
          status: 'PAST_DUE',
          company_id: targetCompany?.id,
          message: `Cobrança ${payment.id} está vencida. Status alterado para PAST_DUE.`,
        };
        break;
      }

      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_DELETED': {
        // Pagamento estornado ou deletado
        const externalRef = payment.externalReference;
        const companies = await Company.list();
        const targetCompany = companies.find(c => c.id === externalRef || c.asaas_customer_id === payment.customer);

        if (targetCompany) {
          await Company.update(targetCompany.id, {
            billing_status: 'CANCELED',
            status: 'blocked',
          });
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
        // Assinatura cancelada no Asaas
        outcome = {
          handled: true,
          status: 'SUBSCRIPTION_DELETED',
          message: `Assinatura ${req.body?.subscription?.id} encerrada no Asaas.`,
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
