// /api/appointments/create.js — Serverless endpoint para Vercel / Node
import { handleCreateAppointment } from '../../src/server/appointmentsPixHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
      if (bodyStr) {
        body = JSON.parse(bodyStr);
      }
    } catch (_) {}
  } else if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }

  const result = await handleCreateAppointment(body || {});
  return res.status(result.status).json(result.body);
}
