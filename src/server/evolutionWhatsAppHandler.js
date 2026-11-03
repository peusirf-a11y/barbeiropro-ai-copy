// Handler unificado da Evolution API v2 para WhatsApp (hospedada em VPS própria).
// Substitui integralmente a integração antiga da Z-API.
//
// Variáveis de ambiente utilizadas:
// - EVOLUTION_API_URL: URL base da VPS (ex: "https://evolution.seuservidor.com" ou "http://seu-ip:8080")
// - EVOLUTION_API_KEY: Chave de autenticação global da Evolution API
// - EVOLUTION_INSTANCE: Nome da instância WhatsApp (padrão: "ocorte")

export function getEvolutionConfig() {
  const env = (typeof process !== 'undefined' && process.env) || {};
  const baseUrl = (env.EVOLUTION_API_URL || env.VITE_EVOLUTION_API_URL || '').replace(/\/$/, '');
  const apiKey = env.EVOLUTION_API_KEY || env.VITE_EVOLUTION_API_KEY || '';
  const instance = env.EVOLUTION_INSTANCE || env.VITE_EVOLUTION_INSTANCE || 'ocorte';

  return {
    baseUrl,
    apiKey,
    instance,
    isConfigured: Boolean(baseUrl && apiKey),
  };
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
 * 1. Verifica o estado atual da conexão da instância na VPS.
 * GET /instance/connectionState/:instance
 */
export async function handleGetWhatsAppStatus(customInstance) {
  const { baseUrl, apiKey, instance: defaultInstance, isConfigured } = getEvolutionConfig();
  const instance = customInstance || defaultInstance;

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

  const headers = {
    'Content-Type': 'application/json',
    'apikey': apiKey,
  };

  try {
    const res = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`, {
      method: 'GET',
      headers,
    });

    if (res.status === 404) {
      return {
        status: 200,
        body: {
          success: true,
          connected: false,
          state: 'not_found',
          instance,
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
          error: `Erro ao consultar status na Evolution API (HTTP ${res.status}): ${errText || 'Servidor inacessível'}`,
        },
      };
    }

    const data = await res.json().catch(() => ({}));
    const rawState = data?.instance?.state || data?.state || 'close';
    const isConnected = rawState === 'open' || rawState === 'connected';

    return {
      status: 200,
      body: {
        success: true,
        connected: isConnected,
        state: isConnected ? 'open' : rawState,
        instance,
      },
    };
  } catch (err) {
    return {
      status: 200,
      body: {
        success: false,
        connected: false,
        state: 'error',
        error: `Não foi possível conectar à VPS da Evolution API: ${err.message}. Verifique se o servidor está online.`,
      },
    };
  }
}

/**
 * 2. Garante a criação da instância (caso não exista) e obtém o QR Code / Pairing Code.
 * POST /instance/create  (idempotente)
 * GET /instance/connect/:instance
 */
export async function handleGetWhatsAppQRCode(customInstance) {
  const { baseUrl, apiKey, instance: defaultInstance, isConfigured } = getEvolutionConfig();
  const instance = customInstance || defaultInstance;

  if (!isConfigured) {
    return {
      status: 500,
      body: {
        success: false,
        connected: false,
        error: 'Credenciais da Evolution API não configuradas (defina EVOLUTION_API_URL e EVOLUTION_API_KEY no ambiente da aplicação).',
      },
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': apiKey,
  };

  try {
    // Passo A: Verifica se a instância já está conectada
    const checkStatus = await handleGetWhatsAppStatus(instance);
    if (checkStatus?.body?.connected) {
      return {
        status: 200,
        body: {
          success: true,
          connected: true,
          state: 'open',
          instance,
          qrCode: null,
          pairingCode: null,
        },
      };
    }

    // Passo B: Garante a criação da instância se ela não existir
    try {
      await fetch(`${baseUrl}/instance/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instanceName: instance,
          token: '',
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });
    } catch (_) {
      // Ignora erro se já existir
    }

    // Passo C: Solicita a conexão / QR Code
    const connectRes = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instance)}`, {
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
          error: `Falha ao obter QR Code da Evolution API (HTTP ${connectRes.status}): ${errText || 'Resposta inválida da VPS'}`,
        },
      };
    }

    const connectData = await connectRes.json().catch(() => ({}));

    // Verifica se já está conectado na resposta do connect
    const isAlreadyOpen = connectData?.instance?.state === 'open' || connectData?.state === 'open';
    if (isAlreadyOpen) {
      return {
        status: 200,
        body: {
          success: true,
          connected: true,
          state: 'open',
          instance,
          qrCode: null,
          pairingCode: null,
        },
      };
    }

    // Trata imagem em Base64 retornada pela Evolution API (v2)
    const rawBase64 = connectData?.base64 || connectData?.qrcode?.base64 || '';
    let formattedQrCode = null;
    if (rawBase64) {
      formattedQrCode = rawBase64.startsWith('data:')
        ? rawBase64
        : `data:image/png;base64,${rawBase64}`;
    }

    const pairingCode = connectData?.pairingCode || connectData?.qrcode?.pairingCode || null;
    const rawCode = connectData?.code || connectData?.qrcode?.code || null;

    if (!formattedQrCode && !pairingCode && !rawCode) {
      return {
        status: 200,
        body: {
          success: true,
          connected: false,
          state: 'connecting',
          message: 'Aguardando geração do QR Code pela Evolution API. Tente atualizar em alguns segundos.',
          qrCode: null,
          pairingCode: null,
        },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        connected: false,
        state: 'qr',
        instance,
        qrCode: formattedQrCode,
        pairingCode,
        code: rawCode,
      },
    };
  } catch (err) {
    return {
      status: 500,
      body: {
        success: false,
        connected: false,
        error: `Falha de conexão com a Evolution API na VPS: ${err.message}. Verifique se o serviço está em execução.`,
      },
    };
  }
}

/**
 * 3. Envia mensagem de texto via Evolution API v2.
 * POST /message/sendText/:instance
 */
export async function handleSendWhatsAppMessage({ phone, message, customInstance }) {
  const { baseUrl, apiKey, instance: defaultInstance, isConfigured } = getEvolutionConfig();
  const instance = customInstance || defaultInstance;

  if (!isConfigured) {
    return {
      status: 200,
      body: {
        success: true,
        simulated: true,
        reason: 'Evolution API não configurada na VPS (EVOLUTION_API_URL/EVOLUTION_API_KEY ausentes). Mensagem simulada.',
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
 * 4. Desconecta (logout) ou reinicia a instância na VPS.
 * DELETE /instance/logout/:instance
 */
export async function handleLogoutWhatsAppInstance(customInstance) {
  const { baseUrl, apiKey, instance: defaultInstance, isConfigured } = getEvolutionConfig();
  const instance = customInstance || defaultInstance;

  if (!isConfigured) {
    return {
      status: 400,
      body: { success: false, error: 'Evolution API não configurada.' },
    };
  }

  try {
    const res = await fetch(`${baseUrl}/instance/logout/${encodeURIComponent(instance)}`, {
      method: 'DELETE',
      headers: { 'apikey': apiKey },
    });

    const data = await res.json().catch(() => ({}));
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
