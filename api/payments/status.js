// /api/payments/status.js — Serverless endpoint para Vercel / Node
// Consulta o status real do pagamento no Asaas (GET /v3/payments/{id}) e só cria/confirma o agendamento se RECEIVED ou CONFIRMED.
import { handlePaymentStatus } from '../../src/server/appointmentsPixHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

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

  // Bloqueia tentativas de manipulação direta de status sem validação de pagamento real no Asaas
  const attemptedDirectStatus = String(
    req.query?.status ||
    body?.status ||
    body?.payment_status ||
    body?.booking?.status ||
    body?.booking?.payment_status ||
    ''
  ).toLowerCase();

  if (
    !paymentId &&
    ['confirmed', 'confirmado', 'received', 'paid', 'succeeded', 'active'].includes(attemptedDirectStatus)
  ) {
    return res.status(403).json({
      status: 'FORBIDDEN',
      received: false,
      confirmed: false,
      error: 'Manipulação direta de status bloqueada. O status só é confirmado via validação oficial na API do Asaas.',
    });
  }

  // Sanitiza bookingData removendo qualquer campo de status enviado pelo cliente
  const rawBooking = body?.booking || body || null;
  let safeBookingData = null;
  if (rawBooking && typeof rawBooking === 'object') {
    const {
      status: _s,
      payment_status: _ps,
      confirmed: _c,
      received: _r,
      paid: _p,
      paid_online: _po,
      asaas_api_key: _ak,
      ...restBooking
    } = rawBooking;
    safeBookingData = restBooking;
  }

  const result = await handlePaymentStatus(paymentId, appointmentId, companyId, safeBookingData);
  return res.status(result.status).json(result.body);
}

