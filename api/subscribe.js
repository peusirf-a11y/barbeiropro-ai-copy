// /api/subscribe.js — Serverless endpoint para Vercel / Edge / Node
import { handleAsaasSubscription } from '../src/server/subscribeHandler.js';

export default async function handler(req, res) {
  // Configuração de CORS para chamadas seguras
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, access_token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
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
