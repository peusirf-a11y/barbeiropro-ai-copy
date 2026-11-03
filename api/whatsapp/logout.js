// Next.js Route Handler / Serverless Function para desconectar/logout da instância Evolution API
import { handleLogoutWhatsAppInstance } from '../../src/server/evolutionWhatsAppHandler.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed. Use POST or DELETE.' });
  }

  const instance = req.body?.instance || req.query?.instance;
  const result = await handleLogoutWhatsAppInstance(instance);

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(result.status).json(result.body);
}
