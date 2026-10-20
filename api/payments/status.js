// /api/payments/status.js — Serverless endpoint para Vercel / Node
// Consulta o status real do pagamento no Asaas (GET /v3/payments/{id}) e só cria/confirma o agendamento se RECEIVED ou CONFIRMED.
import { handlePaymentStatus } from '../../src/server/appointmentsPixHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use GET ou POST.' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }

  const paymentId =
    req.query?.paymentId ||
    req.query?.payment_id ||
    body?.paymentId ||
    body?.payment_id;
  const appointmentId =
    req.query?.appointmentId ||
    req.query?.appointment_id ||
    body?.appointmentId ||
    body?.appointment_id;
  const companyId =
    req.query?.companyId ||
    req.query?.company_id ||
    body?.companyId ||
    body?.company_id;
  const bookingData = body?.booking || body || null;

  const result = await handlePaymentStatus(paymentId, appointmentId, companyId, bookingData);
  return res.status(result.status).json(result.body);
}
