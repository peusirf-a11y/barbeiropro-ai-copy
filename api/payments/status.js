// /api/payments/status.js — Serverless endpoint para Vercel / Node
import { handlePaymentStatus } from '../../src/server/appointmentsPixHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, access_token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let body = req.body;
  if (!body && req.method === 'POST' && typeof req.on === 'function') {
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

  const query = req.query || {};
  const parsedBody = body || {};

  const paymentId = query.paymentId || query.payment_id || parsedBody.paymentId || parsedBody.payment_id;
  const appointmentId = query.appointmentId || query.appointment_id || parsedBody.appointmentId || parsedBody.appointment_id;
  const companyId = query.companyId || query.company_id || parsedBody.companyId || parsedBody.company_id;

  const result = await handlePaymentStatus(paymentId, appointmentId, companyId);
  return res.status(result.status).json(result.body);
}
