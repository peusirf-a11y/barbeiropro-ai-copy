// /api/asaas/webhook.js — Endpoint Serverless Vercel para Webhooks do Asaas
// Suporta a rota pública https://ocorte.vercel.app/api/asaas/webhook
// Garante retorno HTTP 200 contínuo para evitar que o Asaas pause a fila de webhooks.

import { handleAsaasWebhook } from '../../src/api/asaasWebhook.js';

export default async function handler(req, res) {
  try {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, asaas-access-token, x-asaas-access-token, authorization');
    }

    const method = (req.method || 'GET').toUpperCase();

    // 1. Health check e pré-verificação de conexão do Asaas
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      if (res && typeof res.status === 'function') {
        return res.status(200).json({
          received: true,
          status: 'healthy',
          service: 'asaas-webhook-ocorte',
          time: new Date().toISOString(),
        });
      }
      return;
    }

    // 2. Extração segura do body em ambientes Vercel Serverless / Node.js
    let body = req.body;
    if (!body && typeof req.on === 'function') {
      try {
        let bodyStr = '';
        for await (const chunk of req) {
          bodyStr += chunk;
        }
        if (bodyStr) {
          body = JSON.parse(bodyStr);
        }
      } catch (parseErr) {
        console.warn('[Asaas Webhook Serverless] Aviso ao processar stream do body:', parseErr.message);
        body = {};
      }
    } else if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseErr) {
        console.warn('[Asaas Webhook Serverless] Aviso ao fazer parse de string JSON:', parseErr.message);
        body = {};
      }
    }

    req.body = body || {};

    // 3. Execução do handler central protegido
    return await handleAsaasWebhook(req, res);
  } catch (err) {
    // 4. Barreira final anti-crash: mesmo em falha grave, responde HTTP 200 para não pausar a fila do Asaas
    console.error('[Asaas Webhook Serverless] ❌ Erro fatal no handler /api/asaas/webhook:', err.message, err.stack);
    if (res && typeof res.status === 'function') {
      return res.status(200).json({
        received: true,
        handled: false,
        error: err.message || 'Erro capturado no handler serverless.',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
