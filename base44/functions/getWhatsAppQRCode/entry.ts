// Retorna o QR Code / pairing code da instância Evolution API v2 para conectar o WhatsApp.
// Também retorna o status atual da conexão (state: "open" = conectado).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const baseUrl  = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '');
    const apiKey   = Deno.env.get('EVOLUTION_API_KEY');
    const instance = Deno.env.get('EVOLUTION_INSTANCE') || 'ocorte';

    if (!baseUrl || !apiKey) {
      return Response.json({
        error: 'Credenciais da Evolution API não configuradas na VPS (defina EVOLUTION_API_URL e EVOLUTION_API_KEY).'
      }, { status: 500 });
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    };

    // 1. Verifica o estado atual da conexão
    const stateRes = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`, { headers }).catch(err => {
      throw new Error(`Falha ao contactar a VPS da Evolution API: ${err.message}`);
    });

    // Se a instância não existe ainda (404), dispara a criação automática
    if (stateRes.status === 404) {
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
      } catch (createErr) {
        console.warn('[getWhatsAppQRCode] Aviso ao criar instância:', createErr?.message);
      }
    } else if (stateRes.ok) {
      const stateData = await stateRes.json().catch(() => ({}));
      const rawState = stateData?.instance?.state || stateData?.state;
      if (rawState === 'open' || rawState === 'connected') {
        return Response.json({ connected: true, status: 'open', instance });
      }
    }

    // 2. Solicita o QR Code / pairing code na Evolution API v2
    const connectRes = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instance)}`, { headers });

    if (!connectRes.ok) {
      const errText = await connectRes.text().catch(() => '');
      console.error('[getWhatsAppQRCode] Evolution API connect error:', errText);
      return Response.json({
        error: 'Não foi possível obter o QR Code da Evolution API na VPS.',
        detail: errText,
      }, { status: 502 });
    }

    const connectData = await connectRes.json().catch(() => ({}));

    // Verifica se já conectou
    const isOpen = connectData?.instance?.state === 'open' || connectData?.state === 'open';
    if (isOpen) {
      return Response.json({ connected: true, status: 'open', instance });
    }

    // Evolution API v2 retorna:
    // - connectData.base64 ou connectData.qrcode.base64
    // - connectData.pairingCode ou connectData.qrcode.pairingCode
    // - connectData.code ou connectData.qrcode.code
    const rawBase64 = connectData?.base64 || connectData?.qrcode?.base64 || '';
    let qrCode = null;

    if (rawBase64) {
      qrCode = rawBase64.startsWith('data:')
        ? rawBase64
        : `data:image/png;base64,${rawBase64}`;
    }

    return Response.json({
      connected: false,
      status: connectData?.state || 'close',
      instance,
      qrCode,
      pairingCode: connectData?.pairingCode || connectData?.qrcode?.pairingCode || null,
      code: connectData?.code || connectData?.qrcode?.code || null,
    });

  } catch (error) {
    console.error('[getWhatsAppQRCode] erro:', error.message);
    return Response.json({
      error: `Erro ao conectar com a Evolution API: ${error.message}. Verifique se a VPS está online.`
    }, { status: 500 });
  }
});