// app/api/whatsapp/[action]/route.js — Next.js App Router Dynamic Catch-All Route
// Consolida status, connect, qrcode, pairing, send, logout e webhook numa única Serverless Function.

import { handleWhatsAppUnifiedAction } from '../../../../src/server/evolutionWhatsAppHandler.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function createResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    },
  });
}

export async function GET(request, context) {
  const { params } = context || {};
  const resolvedParams = await Promise.resolve(params);
  const action = resolvedParams?.action || 'status';

  const { searchParams } = new URL(request.url);
  const query = Object.fromEntries(searchParams.entries());

  const mockReq = {
    method: 'GET',
    query,
    body: {},
  };

  const result = await handleWhatsAppUnifiedAction(action, mockReq);
  return createResponse(result.body || result, result.status || 200);
}

export async function POST(request, context) {
  const { params } = context || {};
  const resolvedParams = await Promise.resolve(params);
  const action = resolvedParams?.action || 'connect';

  const { searchParams } = new URL(request.url);
  const query = Object.fromEntries(searchParams.entries());

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    body = {};
  }

  const mockReq = {
    method: 'POST',
    query,
    body,
  };

  const result = await handleWhatsAppUnifiedAction(action, mockReq);
  return createResponse(result.body || result, result.status || 200);
}

export async function DELETE(request, context) {
  const { params } = context || {};
  const resolvedParams = await Promise.resolve(params);
  const action = resolvedParams?.action || 'logout';

  const { searchParams } = new URL(request.url);
  const query = Object.fromEntries(searchParams.entries());

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    body = {};
  }

  const mockReq = {
    method: 'DELETE',
    query,
    body,
  };

  const result = await handleWhatsAppUnifiedAction(action, mockReq);
  return createResponse(result.body || result, result.status || 200);
}
