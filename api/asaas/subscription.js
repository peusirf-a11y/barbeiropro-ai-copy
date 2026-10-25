// /api/asaas/subscription.js — Serverless endpoint alternativo
import { handleAsaasSubscription, handleSyncAsaasSubscription } from '../../src/server/subscribeHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const query = req.query || {};
    const result = await handleSyncAsaasSubscription({
      company_id: query.companyId || query.company_id,
      subscription_id: query.subscriptionId || query.subscription_id,
      email: query.email,
    });
    return res.status(result.status).json(result.body);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize GET ou POST.' });
  }

  let body = req.body;
  if (!body && typeof req.on === 'function') {
    try {
      let bodyStr = '';
      for await (const chunk of req) {
        bodyStr += chunk;
      }
      body = JSON.parse(bodyStr);
    } catch (_) {}
  } else if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }

  const result = await handleAsaasSubscription(body || {});
  return res.status(result.status).json(result.body);
}
