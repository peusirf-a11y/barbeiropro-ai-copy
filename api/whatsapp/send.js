// Next.js Route Handler / Serverless Function para envio de mensagens via Evolution API
import { handleSendWhatsAppMessage } from '../../src/server/evolutionWhatsAppHandler.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { phone, message, instance } = req.body || {};
  const result = await handleSendWhatsAppMessage({ phone, message, customInstance: instance });

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(result.status).json(result.body);
}
