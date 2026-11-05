// /api/whatsapp/[action].js — Rota Dinâmica Unificada Serverless para Vercel
// Consolida TODAS as operações de WhatsApp num único arquivo para não ultrapassar
// o limite de 12 Serverless Functions do plano Hobby da Vercel.

import { handleWhatsAppUnifiedAction } from '../../src/server/evolutionWhatsAppHandler.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extrai o body de streams se necessário
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
    } catch (_) {
      body = {};
    }
  } else if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }

  req.body = body || {};

  // Determina a ação da rota dinâmica: /api/whatsapp/[action] ou ?action=...
  const query = req.query || {};
  let action = query.action;

  // Fallback se a URL for lida diretamente
  if (!action && req.url) {
    const parts = req.url.split('?')[0].split('/');
    action = parts[parts.length - 1];
  }

  try {
    const result = await handleWhatsAppUnifiedAction(action, req);
    return res.status(result.status || 200).json(result.body || result);
  } catch (err) {
    console.error(`[WhatsApp API Unificada] Erro na ação "${action}":`, err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro interno no processamento do WhatsApp.',
    });
  }
}
