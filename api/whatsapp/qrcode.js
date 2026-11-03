// Next.js Route Handler / Serverless Function para obtenção do QR Code via Evolution API
import { handleGetWhatsAppQRCode } from '../../src/server/evolutionWhatsAppHandler.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const instance = req.query?.instance || req.query?.instanceName;
  const result = await handleGetWhatsAppQRCode(instance);

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(result.status).json(result.body);
}
