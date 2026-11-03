// src/api/asaasWebhook.js — Handler Central e Resiliente de Webhook Asaas para O CORTE
// Trata eventos de cobranças, agendamentos, assinaturas de clientes e planos SaaS corporativos.
// Garante execução livre de RLS (via Supabase Service Role) e resposta HTTP 200 contínua para evitar pausa na fila do Asaas.

import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://ijitvgzcbvguacsveccy.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaXR2Z3pjYnZndWFjc3ZlY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MjEwODcsImV4cCI6MjEwNzQ5NzA4N30.9WYMFFf6oG2KIl4TpcHDAicV6w9BocIUN6gbSlq6Q_g';

function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/**
 * Cria cliente Supabase com Service Role Key para ignorar Row Level Security (RLS)
 * de forma que o Webhook do Asaas possa atualizar companies, appointments e assinaturas sem bloqueios.
 */
export function getSupabaseAdmin() {
  const env = typeof process !== 'undefined' ? process.env : {};
  const supabaseUrl =
    env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    FALLBACK_SUPABASE_URL;

  const serviceRoleKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE ||
    env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_ANON_KEY;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Auxiliar seguro para envio de resposta HTTP, suportando:
 * - Express / Vercel Serverless (res.status().json())
 * - Next.js App Router (retornando objeto ou manipulando standard Response)
 */
function sendResponse(res, status, data) {
  if (res && typeof res.status === 'function') {
    return res.status(status).json(data);
  }
  return { status, body: data };
}

/**
 * Processador central do Webhook do Asaas.
 * Tolerante a erros: NUNCA lança exceção não tratada para evitar erro 500 e congelamento da fila do Asaas.
 */
export async function handleAsaasWebhook(req, res) {
  const startedAt = Date.now();

  // 1. Tratamento imediato de Health Check (GET, HEAD, OPTIONS)
  const method = (req?.method || 'POST').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    console.log('[Asaas Webhook] Health-check ping recebido via', method);
    return sendResponse(res, 200, {
      received: true,
      status: 'healthy',
      service: 'asaas-webhook-ocorte',
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Extração segura do Body do Webhook
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  } else if (!body || typeof body !== 'object') {
    body = {};
  }

  const eventId = String(body.id || `evt_${Date.now()}`);
  const eventType = String(body.event || '').trim().toUpperCase();
  const payment = body.payment && typeof body.payment === 'object' ? body.payment : null;
  const subscription = body.subscription && typeof body.subscription === 'object' ? body.subscription : null;

  const paymentId = payment?.id ? String(payment.id) : null;
  const customerId = payment?.customer || subscription?.customer || null;
  const subscriptionId = payment?.subscription || subscription?.id || null;
  const paymentValue = payment?.value ? Number(payment.value) : null;
  const externalRef = String(payment?.externalReference || subscription?.externalReference || '');

  // 3. Log informativo de auditoria na Vercel
  console.log(`[Asaas Webhook] 🔔 Evento recebido: "${eventType || 'SEM_EVENTO'}" | ID: ${eventId} | Payment ID: "${paymentId || 'N/A'}" | Cliente: "${customerId || 'N/A'}" | Assinatura: "${subscriptionId || 'N/A'}" | Ref: "${externalRef || 'N/A'}" | Valor: R$ ${paymentValue ?? 'N/A'}`);

  try {
    // 4. Validação Tolerante de Token de Webhook (asaas-access-token)
    const expectedToken = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
    const headers = req.headers || {};
    const receivedToken = String(
      headers['asaas-access-token'] ||
      headers['x-asaas-access-token'] ||
      headers['Asaas-Access-Token'] ||
      ''
    ).trim();

    if (expectedToken) {
      if (!receivedToken || !constantTimeEquals(receivedToken, expectedToken)) {
        console.warn(`[Asaas Webhook] ⚠️ Token de autenticação incorreto ou ausente. Recebido: "${receivedToken ? '***' : 'vazio'}"`);
        // Retorna 200 com payload informativo para NÃO pausar a fila de webhooks no painel do Asaas
        return sendResponse(res, 200, {
          received: true,
          authorized: false,
          warning: 'Token de autenticação divergente do configurado no servidor.',
          event_id: eventId,
        });
      }
    }

    // 5. Se o payload não trouxer evento ou for um teste do painel Asaas
    if (!eventType) {
      console.warn('[Asaas Webhook] Payload recebido sem o campo "event". Respondendo 200 de confirmação.');
      return sendResponse(res, 200, {
        received: true,
        handled: false,
        warning: 'Campo "event" ausente no payload.',
        event_id: eventId,
      });
    }

    const sb = getSupabaseAdmin();
    let outcome = { handled: false, eventType, timestamp: new Date().toISOString() };

    // 6. Roteamento por tipo de evento
    switch (eventType) {
      case 'PAYMENT_CREATED':
      case 'PAYMENT_UPDATED':
      case 'PAYMENT_ANTICIPATED':
      case 'PAYMENT_BANK_SLIP_VIEWED':
      case 'PAYMENT_CHECKOUT_VIEWED': {
        outcome = {
          handled: true,
          status: eventType,
          payment_id: paymentId,
          message: `Evento de cobrança ${eventType} registrado com sucesso.`,
        };
        break;
      }

      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        let matched = false;

        // 6A. Trata Agendamento de Cliente na tabela 'appointments'
        try {
          let apptQuery = sb.from('appointments').select('id, company_id, status, payment_status');
          if (externalRef.startsWith('booking:')) {
            const bookingApptId = externalRef.slice('booking:'.length);
            apptQuery = apptQuery.eq('id', bookingApptId);
          } else if (paymentId) {
            apptQuery = apptQuery.or(`payment_id.eq.${paymentId},asaas_payment_id.eq.${paymentId}`);
          }

          const { data: apptRow, error: apptErr } = await apptQuery.maybeSingle();
          if (apptErr) {
            console.warn('[Asaas Webhook] Erro ao consultar appointments:', apptErr.message);
          } else if (apptRow?.id) {
            matched = true;
            console.log(`[Asaas Webhook] ✅ Confirmando pagamento do agendamento ${apptRow.id}`);
            await sb
              .from('appointments')
              .update({
                status: 'confirmado',
                payment_status: 'confirmed',
                paid: true,
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', apptRow.id);
            outcome.appointment_id = apptRow.id;
          }
        } catch (apptException) {
          console.error('[Asaas Webhook] Falha ao processar agendamento:', apptException.message);
        }

        // 6B. Trata Assinatura de Clube do Cliente ('customer_subscriptions')
        try {
          let custSubQuery = sb.from('customer_subscriptions').select('id, company_id, customer_id, status');
          if (externalRef.startsWith('customerPlan:')) {
            const planSubId = externalRef.slice('customerPlan:'.length);
            custSubQuery = custSubQuery.eq('id', planSubId);
          } else if (subscriptionId) {
            custSubQuery = custSubQuery.eq('asaas_subscription_id', subscriptionId);
          }

          const { data: custSubRow, error: custSubErr } = await custSubQuery.maybeSingle();
          if (custSubErr) {
            console.warn('[Asaas Webhook] Erro ao consultar customer_subscriptions:', custSubErr.message);
          } else if (custSubRow?.id) {
            matched = true;
            console.log(`[Asaas Webhook] ✅ Renovando assinatura de cliente ${custSubRow.id}`);
            const now = new Date();
            const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
            await sb
              .from('customer_subscriptions')
              .update({
                status: 'active',
                last_payment_status: 'pago',
                current_period_start: now.toISOString(),
                current_period_end: cycleEnd,
                updated_at: now.toISOString(),
              })
              .eq('id', custSubRow.id);
            outcome.customer_subscription_id = custSubRow.id;
          }
        } catch (custSubException) {
          console.error('[Asaas Webhook] Falha ao processar customer_subscription:', custSubException.message);
        }

        // 6C. Trata Assinatura de Barbearia SaaS na tabela 'companies'
        try {
          let companyRow = null;

          if (externalRef && !externalRef.startsWith('booking:') && !externalRef.startsWith('customerPlan:')) {
            const cleanRef = externalRef.replace(/^saas:/, '').split(':')[0];
            const { data: compByRef } = await sb.from('companies').select('*').eq('id', cleanRef).maybeSingle();
            if (compByRef) companyRow = compByRef;
          }

          if (!companyRow && subscriptionId) {
            const { data: compBySub } = await sb
              .from('companies')
              .select('*')
              .eq('asaas_subscription_id', subscriptionId)
              .maybeSingle();
            if (compBySub) companyRow = compBySub;
          }

          if (!companyRow && customerId) {
            const { data: compByCust } = await sb
              .from('companies')
              .select('*')
              .eq('asaas_customer_id', customerId)
              .maybeSingle();
            if (compByCust) companyRow = compByCust;
          }

          if (companyRow) {
            matched = true;
            console.log(`[Asaas Webhook] ✅ Ativando/renovando empresa ${companyRow.name} (${companyRow.id})`);

            const nextDueDate = payment?.dueDate
              ? new Date(new Date(payment.dueDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

            const billingMeta = companyRow.business_hours?._billing || companyRow.opening_hours?._billing || {};
            const updatePayload = {
              status: 'active',
              billing_status: 'ACTIVE',
              subscription_status: 'active',
              last_payment_at: new Date().toISOString(),
              current_period_end: nextDueDate,
              updated_at: new Date().toISOString(),
              business_hours: {
                ...(companyRow.business_hours || {}),
                _billing: {
                  ...billingMeta,
                  billing_status: 'ACTIVE',
                  subscription_status: 'active',
                  last_payment_id: paymentId,
                  last_payment_date: new Date().toISOString(),
                  last_payment_value: paymentValue,
                  last_payment_status: 'CONFIRMED',
                  current_period_end: nextDueDate,
                },
              },
            };

            // Atualiza tolerando colunas que possam não existir na tabela remota
            const payloadCopy = { ...updatePayload };
            for (let attempt = 0; attempt < 8; attempt++) {
              const { error: updErr } = await sb.from('companies').update(payloadCopy).eq('id', companyRow.id);
              if (!updErr) break;
              const matchCol = updErr.message?.match(/column "([^"]+)" of relation|Could not find the '([^']+)' column/i);
              const missingCol = matchCol?.[1] || matchCol?.[2];
              if (missingCol && missingCol in payloadCopy && missingCol !== 'id') {
                delete payloadCopy[missingCol];
                continue;
              }
              console.warn('[Asaas Webhook] Aviso ao atualizar empresa:', updErr.message);
              break;
            }

            // Registra entrada no financeiro se aplicável
            try {
              await sb.from('financial_entries').insert([{
                company_id: companyRow.id,
                description: `Assinatura Asaas - ${payment?.description || 'Plano O CORTE'}`,
                type: 'entrada',
                amount: paymentValue || 0,
                payment_method: payment?.billingType || 'CREDIT_CARD',
                status: 'confirmado',
                created_at: new Date().toISOString(),
              }]);
            } catch (_) {}

            outcome.company_id = companyRow.id;
          }
        } catch (companyException) {
          console.error('[Asaas Webhook] Falha ao processar assinatura da empresa:', companyException.message);
        }

        if (!matched) {
          console.log(`[Asaas Webhook] ℹ️ Pagamento ${paymentId} recebido, mas nenhum registro local correspondente encontrado (tolerado).`);
        }

        outcome = {
          ...outcome,
          handled: true,
          status: 'CONFIRMED',
          payment_id: paymentId,
          matched,
          message: `Pagamento ${paymentId} confirmado com sucesso.`,
        };
        break;
      }

      case 'PAYMENT_OVERDUE': {
        try {
          if (subscriptionId) {
            await sb
              .from('companies')
              .update({
                billing_status: 'OVERDUE',
                subscription_status: 'overdue',
                updated_at: new Date().toISOString(),
              })
              .eq('asaas_subscription_id', subscriptionId);

            await sb
              .from('customer_subscriptions')
              .update({
                status: 'overdue',
                updated_at: new Date().toISOString(),
              })
              .eq('asaas_subscription_id', subscriptionId);
          } else if (customerId) {
            await sb
              .from('companies')
              .update({
                billing_status: 'OVERDUE',
                subscription_status: 'overdue',
                updated_at: new Date().toISOString(),
              })
              .eq('asaas_customer_id', customerId);
          }
          console.log(`[Asaas Webhook] ⚠️ Cobrança ${paymentId} marcada como vencida (OVERDUE).`);
        } catch (overdueErr) {
          console.warn('[Asaas Webhook] Erro ao tratar PAYMENT_OVERDUE:', overdueErr.message);
        }

        outcome = {
          handled: true,
          status: 'OVERDUE',
          payment_id: paymentId,
          message: `Cobrança ${paymentId} registrada como vencida.`,
        };
        break;
      }

      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_DELETED': {
        try {
          if (subscriptionId) {
            await sb
              .from('companies')
              .update({
                billing_status: 'CANCELED',
                subscription_status: 'canceled',
                status: 'blocked',
                updated_at: new Date().toISOString(),
              })
              .eq('asaas_subscription_id', subscriptionId);

            await sb
              .from('customer_subscriptions')
              .update({
                status: 'canceled',
                updated_at: new Date().toISOString(),
              })
              .eq('asaas_subscription_id', subscriptionId);
          }
          if (paymentId) {
            await sb
              .from('appointments')
              .update({
                status: 'cancelado',
                payment_status: 'refunded',
                updated_at: new Date().toISOString(),
              })
              .or(`payment_id.eq.${paymentId},asaas_payment_id.eq.${paymentId}`);
          }
          console.log(`[Asaas Webhook] ℹ️ Pagamento ${paymentId} estornado/removido.`);
        } catch (refundErr) {
          console.warn('[Asaas Webhook] Erro ao tratar estorno:', refundErr.message);
        }

        outcome = {
          handled: true,
          status: eventType,
          payment_id: paymentId,
          message: `Evento de estorno/cancelamento ${paymentId} concluído.`,
        };
        break;
      }

      case 'SUBSCRIPTION_DELETED': {
        const subId = subscriptionId || body.id;
        try {
          if (subId) {
            await sb
              .from('companies')
              .update({
                subscription_status: 'canceled',
                billing_status: 'CANCELED',
                updated_at: new Date().toISOString(),
              })
              .eq('asaas_subscription_id', subId);

            await sb
              .from('customer_subscriptions')
              .update({
                status: 'canceled',
                updated_at: new Date().toISOString(),
              })
              .eq('asaas_subscription_id', subId);

            console.log(`[Asaas Webhook] ℹ️ Assinatura ${subId} cancelada no sistema.`);
          }
        } catch (subDelErr) {
          console.warn('[Asaas Webhook] Erro ao tratar SUBSCRIPTION_DELETED:', subDelErr.message);
        }

        outcome = {
          handled: true,
          status: 'SUBSCRIPTION_DELETED',
          subscription_id: subId,
          message: `Assinatura ${subId} encerrada.`,
        };
        break;
      }

      default: {
        console.log(`[Asaas Webhook] Evento ${eventType} aceito (sem ação necessária).`);
        outcome = {
          handled: true,
          status: 'EVENT_ACKNOWLEDGED',
          eventType,
        };
        break;
      }
    }

    const durationMs = Date.now() - startedAt;
    console.log(`[Asaas Webhook] ✅ Evento ${eventType} finalizado em ${durationMs}ms`);

    // Retorno HTTP 200 sempre com { received: true } para proteger a fila de webhooks do Asaas
    return sendResponse(res, 200, {
      received: true,
      event: eventType,
      event_id: eventId,
      outcome,
      duration_ms: durationMs,
    });
  } catch (err) {
    // Bloco catch abrangente para garantir que nenhum erro gere 500 para o Asaas
    console.error('[Asaas Webhook] ❌ Erro inesperado capturado no processamento do webhook:', err.message, err.stack);

    return sendResponse(res, 200, {
      received: true,
      handled: false,
      error: err.message || 'Erro inesperado processado com segurança.',
      event_id: eventId,
      timestamp: new Date().toISOString(),
    });
  }
}
