// app/api/asaas/webhook/route.js — Next.js App Router Route Handler para Webhooks do Asaas
// Compatível com deploys Next.js / Vercel App Router para https://ocorte.vercel.app/api/asaas/webhook

import { handleAsaasWebhook } from '@/api/asaasWebhook.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function createJsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, asaas-access-token, x-asaas-access-token, authorization',
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, asaas-access-token, x-asaas-access-token, authorization',
    },
  });
}

export async function GET() {
  return createJsonResponse({
    received: true,
    status: 'healthy',
    service: 'asaas-webhook-nextjs-app-router',
    timestamp: new Date().toISOString(),
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function POST(request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch (parseErr) {
      console.warn('[Asaas Webhook App Router] Aviso ao ler payload JSON:', parseErr.message);
      body = {};
    }

    // Extrai headers da requisição Web Request
    const headers = {};
    if (request.headers && typeof request.headers.forEach === 'function') {
      request.headers.forEach((val, key) => {
        headers[key.toLowerCase()] = val;
      });
    }

    const mockReq = {
      method: 'POST',
      headers,
      body,
    };

    let resultData = null;
    let statusCode = 200;

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resultData = data;
        return this;
      },
    };

    const outcome = await handleAsaasWebhook(mockReq, mockRes);
    const finalData = resultData || outcome?.body || { received: true };

    // Garante retorno 200 para o painel do Asaas não pausar a fila
    return createJsonResponse(finalData, 200);
  } catch (err) {
    console.error('[Asaas Webhook App Router] ❌ Erro fatal no handler POST:', err.message, err.stack);
    return createJsonResponse({
      received: true,
      handled: false,
      error: err.message || 'Erro capturado no route handler do App Router.',
      timestamp: new Date().toISOString(),
    }, 200);
  }
}
