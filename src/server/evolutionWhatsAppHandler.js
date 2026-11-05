// src/server/evolutionWhatsAppHandler.js
// Motor Central e Multitenant da Evolution API v2 para O CORTE.
// Consolida status, criação de instância, QR Code, Pairing Code, envio e logout num único pipeline.
// Persiste e sincroniza com a tabela 'company_whatsapp_instances' no Supabase via Service Role.

import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://ijitvgzcbvguacsveccy.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaXR2Z3pjYnZndWFjc3ZlY2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MjEwODcsImV4cCI6MjEwNzQ5NzA4N30.9WYMFFf6oG2KIl4TpcHDAicV6w9BocIUN6gbSlq6Q_g';

/**
 * Cliente Supabase com Service Role Key para ignorar RLS
 * e permitir que as rotas de WhatsApp atualizem instâncias sem barreiras de autenticação do browser.
 */
export function getSupabaseAdmin() {
  const env = (typeof process !== 'undefined' && process.env) || {};
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE ||
    env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_ANON_KEY;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Obtém as configurações da Evolution API configurada na VPS (Easypanel).
 */
export function getEvolutionConfig() {
  const env = (typeof process !== 'undefined' && process.env) || {};
  const baseUrl = (env.EVOLUTION_API_URL || env.VITE_EVOLUTION_API_URL || '').replace(/\/$/, '');
  const apiKey = (env.EVOLUTION_API_KEY || env.VITE_EVOLUTION_API_KEY || '').trim();

  return {
    baseUrl,
    apiKey,
    isConfigured: Boolean(baseUrl && apiKey),
  };
}

/**
 * Gera um identificador único, determinístico e seguro para a instância da barbearia.
 * Exemplo: 'ocorte_vintagebarber_a1b2c3d4'
 */
export function resolveInstanceName(companyId, companySlug = '') {
  if (!companyId) return 'ocorte_default';
  const cleanSlug = String(companySlug || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 16);
  const shortId = String(companyId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  return `ocorte_${cleanSlug || 'barber'}_${shortId}`;
}

/**
 * Normaliza número para o padrão internacional (E.164 sem o '+').
 * Brasil: DDD + Número = 55 + DDD + Número.
 */
export function normalizeWhatsAppNumber(raw) {
  if (!raw) return null;
  let clean = String(raw).replace(/\D/g, '');
  if (!clean) return null;
  if (clean.length <= 11 && !clean.startsWith('55')) {
    clean = `55${clean}`;
  }
  return clean;
}

/**
 * 1. Consulta o status da conexão da instância no Supabase e na Evolution API.
 */
export async function handleGetWhatsAppStatus(customInstance, companyId) {
  const { baseUrl, apiKey, isConfigured } = getEvolutionConfig();

  if (!isConfigured) {
    return {
      status: 200,
      body: {
        success: false,
        connected: false,
        state: 'disconnected',
        error: 'Credenciais da Evolution API não configuradas na VPS (EVOLUTION_API_URL e EVOLUTION_API_KEY).',
        needsConfig: true,
      },
    };
  }

  const sb = getSupabaseAdmin();
  let instanceName = customInstance;

  // Se passou companyId, busca do banco ou gera o nome padronizado
  if (companyId && (!instanceName || instanceName === 'ocorte')) {
    try {
      const { data: instData } = await sb
        .from('company_whatsapp_instances')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (instData?.instance_name) {
        instanceName = instData.instance_name;
      } else {
        const { data: comp } = await sb.from('companies').select('id, slug').eq('id', companyId).maybeSingle();
        instanceName = resolveInstanceName(companyId, comp?.slug);
      }
    } catch (_) {}
  }

  instanceName = instanceName || 'ocorte';

  try {
    const res = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
    });

    if (res.status === 404) {
      return {
        status: 200,
        body: {
          success: true,
          connected: false,
          state: 'not_found',
          instance: instanceName,
        },
      };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        status: 200,
        body: {
          success: false,
          connected: false,
          state: 'error',
          error: `Erro ao consultar status na Evolution API: ${errText || 'Servidor inacessível'}`,
        },
      };
    }

    const data = await res.json().catch(() => ({}));
    const rawState = data?.instance?.state || data?.state || 'close';
    const isConnected = rawState === 'open' || rawState === 'connected';

    // Atualiza status no banco se companyId foi fornecido
    if (companyId) {
      try {
        await sb.from('company_whatsapp_instances').upsert({
          company_id: companyId,
          instance_name: instanceName,
          status: isConnected ? 'open' : rawState,
          updated_at: new Date().toISOString(),
          ...(isConnected ? { connected_at: new Date().toISOString() } : {}),
        }, { onConflict: 'company_id' });
      } catch (_) {}
    }

    return {
      status: 200,
      body: {
        success: true,
        connected: isConnected,
        state: isConnected ? 'open' : rawState,
        instance: instanceName,
      },
    };
  } catch (err) {
    return {
      status: 200,
      body: {
        success: false,
        connected: false,
        state: 'error',
        error: `Não foi possível conectar à VPS da Evolution API: ${err.message}`,
      },
    };
  }
}

/**
 * 2. Conecta a instância via QR Code ou Pairing Code (código de 8 dígitos digitado no telemóvel).
 * Garante criação da instância na Evolution API (POST /instance/create) e registra no Supabase.
 */
export async function handleConnectWhatsApp({ companyId, customInstance, phoneNumber, method = 'qr' }) {
  const { baseUrl, apiKey, isConfigured } = getEvolutionConfig();

  if (!isConfigured) {
    return {
      status: 500,
      body: {
        success: false,
        error: 'Credenciais da Evolution API não configuradas no servidor (EVOLUTION_API_URL / EVOLUTION_API_KEY).',
      },
    };
  }

  const sb = getSupabaseAdmin();
  let instanceName = customInstance;

  // Resolve nome da instância do tenant
  if (companyId && (!instanceName || instanceName === 'ocorte')) {
    try {
      const { data: comp } = await sb.from('companies').select('id, slug, name').eq('id', companyId).maybeSingle();
      instanceName = resolveInstanceName(companyId, comp?.slug);
    } catch (_) {
      instanceName = resolveInstanceName(companyId);
    }
  }

  instanceName = instanceName || 'ocorte';
  const headers = {
    'Content-Type': 'application/json',
    'apikey': apiKey,
  };

  try {
    // Passo A: Verifica se já está conectada
    const checkStatus = await handleGetWhatsAppStatus(instanceName, companyId);
    if (checkStatus?.body?.connected) {
      return {
        status: 200,
        body: {
          success: true,
          connected: true,
          state: 'open',
          instance: instanceName,
          qrCode: null,
          pairingCode: null,
        },
      };
    }

    // Passo B: Garante a criação da instância se não existir (idempotente)
    try {
      await fetch(`${baseUrl}/instance/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instanceName,
          token: '',
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });
    } catch (_) {}

    // Passo C: Solicita a conexão
    // Se for método 'pairing' ou houver número de telemóvel fornecido, passa ?number=55...
    const cleanNumber = phoneNumber ? normalizeWhatsAppNumber(phoneNumber) : null;
    const isPairing = method === 'pairing' || Boolean(cleanNumber);

    const connectUrl = cleanNumber
      ? `${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}?number=${encodeURIComponent(cleanNumber)}`
      : `${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`;

    console.info(`[Evolution WhatsApp] Conectando ${instanceName} via ${isPairing ? `Pairing Code (${cleanNumber})` : 'QR Code'} em ${connectUrl}`);

    const connectRes = await fetch(connectUrl, {
      method: 'GET',
      headers,
    });

    if (!connectRes.ok) {
      const errText = await connectRes.text().catch(() => '');
      return {
        status: 502,
        body: {
          success: false,
          connected: false,
          error: `Falha ao conectar à Evolution API (HTTP ${connectRes.status}): ${errText || 'Resposta inválida da VPS'}`,
        },
      };
    }

    const connectData = await connectRes.json().catch(() => ({}));

    // Verifica se já abriu
    const isAlreadyOpen = connectData?.instance?.state === 'open' || connectData?.state === 'open';
    if (isAlreadyOpen) {
      if (companyId) {
        try {
          await sb.from('company_whatsapp_instances').upsert({
            company_id: companyId,
            instance_name: instanceName,
            status: 'open',
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'company_id' });
        } catch (_) {}
      }
      return {
        status: 200,
        body: {
          success: true,
          connected: true,
          state: 'open',
          instance: instanceName,
          qrCode: null,
          pairingCode: null,
        },
      };
    }

    // Extrai Base64 do QR Code e Código de Pareamento
    const rawBase64 = connectData?.base64 || connectData?.qrcode?.base64 || '';
    let formattedQrCode = null;
    if (rawBase64) {
      formattedQrCode = rawBase64.startsWith('data:') ? rawBase64 : `data:image/png;base64,${rawBase64}`;
    }

    const pairingCode = connectData?.pairingCode || connectData?.qrcode?.pairingCode || null;
    const rawCode = connectData?.code || connectData?.qrcode?.code || null;

    // Atualiza o registro no Supabase
    if (companyId) {
      try {
        await sb.from('company_whatsapp_instances').upsert({
          company_id: companyId,
          instance_name: instanceName,
          phone_number: cleanNumber,
          connection_type: isPairing ? 'pairing_code' : 'qr',
          status: 'connecting',
          last_qr_code: formattedQrCode,
          last_pairing_code: pairingCode || rawCode,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id' });
      } catch (dbErr) {
        console.warn('[Evolution WhatsApp] Aviso ao salvar estado no Supabase:', dbErr.message);
      }
    }

    return {
      status: 200,
      body: {
        success: true,
        connected: false,
        state: isPairing && pairingCode ? 'pairing' : 'qr',
        instance: instanceName,
        qrCode: formattedQrCode,
        pairingCode: pairingCode || rawCode,
        code: rawCode,
        method: isPairing ? 'pairing' : 'qr',
      },
    };
  } catch (err) {
    return {
      status: 500,
      body: {
        success: false,
        connected: false,
        error: `Falha de conexão com a Evolution API na VPS: ${err.message}`,
      },
    };
  }
}

/**
 * 3. Envia mensagem de texto via Evolution API v2.
 */
export async function handleSendWhatsAppMessage({ phone, message, customInstance, companyId }) {
  const { baseUrl, apiKey, isConfigured } = getEvolutionConfig();

  if (!isConfigured) {
    return {
      status: 200,
      body: {
        success: true,
        simulated: true,
        reason: 'Evolution API não configurada na VPS. Mensagem simulada.',
      },
    };
  }

  const normalizedPhone = normalizeWhatsAppNumber(phone);
  if (!normalizedPhone) {
    return {
      status: 400,
      body: { success: false, error: 'Número de telefone inválido para envio via WhatsApp.' },
    };
  }

  let instance = customInstance;
  if (!instance && companyId) {
    const sb = getSupabaseAdmin();
    try {
      const { data: inst } = await sb.from('company_whatsapp_instances').select('instance_name').eq('company_id', companyId).maybeSingle();
      instance = inst?.instance_name;
    } catch (_) {}
  }

  instance = instance || 'ocorte';

  const headers = {
    'Content-Type': 'application/json',
    'apikey': apiKey,
  };

  try {
    const res = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        number: normalizedPhone,
        text: message,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data?.message || data?.error || `Erro HTTP ${res.status} da Evolution API`;
      return {
        status: 502,
        body: { success: false, error: errorMsg, response: data },
      };
    }

    return {
      status: 200,
      body: { success: true, simulated: false, response: data },
    };
  } catch (err) {
    return {
      status: 500,
      body: {
        success: false,
        error: `Erro ao disparar mensagem para a Evolution API: ${err.message}`,
      },
    };
  }
}

/**
 * 4. Desconecta (logout) da instância na VPS e atualiza no Supabase.
 */
export async function handleLogoutWhatsAppInstance(customInstance, companyId) {
  const { baseUrl, apiKey, isConfigured } = getEvolutionConfig();

  if (!isConfigured) {
    return {
      status: 400,
      body: { success: false, error: 'Evolution API não configurada.' },
    };
  }

  let instance = customInstance;
  const sb = getSupabaseAdmin();

  if (!instance && companyId) {
    try {
      const { data: inst } = await sb.from('company_whatsapp_instances').select('instance_name').eq('company_id', companyId).maybeSingle();
      instance = inst?.instance_name;
    } catch (_) {}
  }

  instance = instance || 'ocorte';

  try {
    const res = await fetch(`${baseUrl}/instance/logout/${encodeURIComponent(instance)}`, {
      method: 'DELETE',
      headers: { 'apikey': apiKey },
    });

    const data = await res.json().catch(() => ({}));

    if (companyId) {
      try {
        await sb.from('company_whatsapp_instances').update({
          status: 'disconnected',
          last_qr_code: null,
          last_pairing_code: null,
          disconnected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('company_id', companyId);
      } catch (_) {}
    }

    return {
      status: 200,
      body: { success: true, message: 'Instância desconectada com sucesso.', data },
    };
  } catch (err) {
    return {
      status: 500,
      body: { success: false, error: `Falha ao desconectar instância: ${err.message}` },
    };
  }
}

/**
 * 5. Webhook receiver da Evolution API (evento CONNECTION_UPDATE).
 */
export async function handleEvolutionWebhook(body) {
  const sb = getSupabaseAdmin();
  const event = body?.event || body?.type;
  const instance = body?.instance;
  const state = body?.data?.state || body?.data?.status;

  console.log(`[Evolution Webhook] Evento: "${event}" | Instância: "${instance}" | Estado: "${state}"`);

  if (instance && (event === 'connection.update' || event === 'CONNECTION_UPDATE')) {
    const isOpen = state === 'open' || state === 'connected';
    const isClose = state === 'close' || state === 'closed' || state === 'disconnected';

    try {
      await sb.from('company_whatsapp_instances').update({
        status: isOpen ? 'open' : isClose ? 'disconnected' : 'connecting',
        ...(isOpen ? { connected_at: new Date().toISOString() } : {}),
        ...(isClose ? { disconnected_at: new Date().toISOString(), last_qr_code: null, last_pairing_code: null } : {}),
        updated_at: new Date().toISOString(),
      }).eq('instance_name', instance);
    } catch (err) {
      console.warn('[Evolution Webhook] Erro ao sincronizar webhook no banco:', err.message);
    }
  }

  return { status: 200, body: { received: true } };
}

/**
 * ROTEADOR CENTRAL UNIFICADO:
 * Despacha qualquer ação de WhatsApp (status, connect, send, logout, webhook)
 * para reduzir a contagem de Serverless Functions na Vercel a APENAS 1.
 */
export async function handleWhatsAppUnifiedAction(action, req) {
  const method = (req.method || 'GET').toUpperCase();
  const query = req.query || {};
  const body = req.body || {};

  const companyId = query.company_id || query.companyId || body.company_id || body.companyId;
  const customInstance = query.instance || query.instanceName || body.instance || body.instanceName;
  const phoneNumber = query.phone || query.number || body.phone || body.number || body.phoneNumber;
  const connectMethod = query.method || body.method || (phoneNumber ? 'pairing' : 'qr');
  const message = body.message || query.message;

  const normalizedAction = String(action || query.action || 'status').toLowerCase().trim();

  switch (normalizedAction) {
    case 'status':
    case 'get-status':
      return await handleGetWhatsAppStatus(customInstance, companyId);

    case 'connect':
    case 'qrcode':
    case 'pairing':
      return await handleConnectWhatsApp({
        companyId,
        customInstance,
        phoneNumber,
        method: connectMethod,
      });

    case 'send':
    case 'send-message':
      if (method !== 'POST') {
        return { status: 405, body: { error: 'Método não permitido. Utilize POST para envio.' } };
      }
      return await handleSendWhatsAppMessage({
        phone: phoneNumber,
        message,
        customInstance,
        companyId,
      });

    case 'logout':
    case 'disconnect':
      return await handleLogoutWhatsAppInstance(customInstance, companyId);

    case 'webhook':
      return await handleEvolutionWebhook(body);

    default:
      return {
        status: 400,
        body: {
          success: false,
          error: `Ação desconhecida: "${action}". Ações suportadas: status, connect, send, logout, webhook.`,
        },
      };
  }
}
