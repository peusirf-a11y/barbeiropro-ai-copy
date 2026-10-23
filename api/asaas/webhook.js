// /api/asaas/webhook.js — Endpoint Serverless seguro para Webhooks oficiais do Asaas
import { handleAsaasWebhook } from '../../src/api/asaasWebhook.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true, status: 'healthy', service: 'asaas-webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Use POST.' });
  }

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
    } catch (_) {
      body = {};
    }
  } else if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }

  req.body = body || {};
  return handleAsaasWebhook(req, res);
}
