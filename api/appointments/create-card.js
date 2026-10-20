// /api/appointments/create-card.js — Serverless endpoint para Vercel / Node
// Processa cobrança com Cartão de Crédito no Asaas e confirma o agendamento no Supabase
import { handleCreateCardPayment } from '../../src/server/appointmentsPixHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }

  const result = await handleCreateCardPayment(body || {});
  return res.status(result.status).json(result.body);
}
