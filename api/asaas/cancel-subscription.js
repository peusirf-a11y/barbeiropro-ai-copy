// /api/asaas/cancel-subscription.js — Endpoint serverless para cancelamento definitivo de assinatura SaaS no Asaas e Supabase
import { handleCancelAsaasSubscription } from '../../src/server/subscribeHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Utilize POST ou DELETE.',
    });
  }

  let body = req.body;
  if (!body && typeof req.on === 'function') {
    try {
      let bodyStr = '';
      for await (const chunk of req) {
        bodyStr += chunk;
      }
      if (bodyStr) body = JSON.parse(bodyStr);
    } catch (_) {}
  } else if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }

  const query = req.query || {};
  const mergedPayload = {
    ...(body || {}),
    company_id: body?.company_id || body?.companyId || query.company_id || query.companyId,
    subscription_id:
      body?.subscription_id || body?.subscriptionId || query.subscription_id || query.subscriptionId,
    email: body?.email || query.email,
  };

  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const result = await handleCancelAsaasSubscription(mergedPayload, authHeader);
  return res.status(result.status).json(result.body);
}
