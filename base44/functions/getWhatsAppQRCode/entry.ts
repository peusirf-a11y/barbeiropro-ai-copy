// Retorna o QR Code / pairing code da instância Evolution API para conectar o WhatsApp.
// Também retorna o status atual da conexão (state: "open" = conectado).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const baseUrl  = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/$/, '');
    const apiKey   = Deno.env.get('EVOLUTION_API_KEY');
    const instance = Deno.env.get('EVOLUTION_INSTANCE');

    if (!baseUrl || !apiKey || !instance) {
      return Response.json({ error: 'Credenciais Evolution API não configuradas.' }, { status: 500 });
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    };

    // 1. Verifica o estado atual da conexão
    const stateRes = await fetch(`${baseUrl}/instance/connectionState/${instance}`, { headers });
    const stateData = await stateRes.json();
    console.log('[getWhatsAppQRCode] connectionState:', JSON.stringify(stateData));

    const state = stateData?.instance?.state;

    if (state === 'open') {
      return Response.json({ connected: true, status: 'open' });
    }

    // 2. Solicita o QR Code ou pairing code
    const body = await req.json().catch(() => ({}));
    const phoneNumber = body?.phone || null;

    let qrCode = null;
    let pairingCode = null;

    if (phoneNumber) {
      // Modo pairing code: endpoint dedicado da Evolution API
      const pairingRes = await fetch(`${baseUrl}/instance/pairingCode/${instance}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: phoneNumber }),
      });
      const pairingData = await pairingRes.json();
      console.log('[getWhatsAppQRCode] pairingCode response:', JSON.stringify(pairingData));
      pairingCode = pairingData?.code || pairingData?.pairingCode || null;

      if (!pairingCode) {
        // Fallback: tenta via query param no connect
        const connectRes2 = await fetch(`${baseUrl}/instance/connect/${instance}?number=${encodeURIComponent(phoneNumber)}`, { headers });
        const connectData2 = await connectRes2.json();
        console.log('[getWhatsAppQRCode] fallback connect response:', JSON.stringify(connectData2));
        pairingCode = connectData2?.pairingCode || null;
      }
    } else {
      // Modo QR Code normal
      const connectRes = await fetch(`${baseUrl}/instance/connect/${instance}`, { headers });
      if (!connectRes.ok) {
        const errText = await connectRes.text();
        console.error('[getWhatsAppQRCode] Evolution API connect error:', errText);
        return Response.json({ error: 'Não foi possível obter o QR Code.', detail: errText }, { status: 502 });
      }
      const connectData = await connectRes.json();
      console.log('[getWhatsAppQRCode] connect response:', JSON.stringify({ keys: Object.keys(connectData), pairingCode: connectData.pairingCode }));

      if (connectData.base64) {
        qrCode = connectData.base64.startsWith('data:')
          ? connectData.base64
          : `data:image/png;base64,${connectData.base64}`;
      }
      pairingCode = connectData.pairingCode || null;
    }

    console.log('[getWhatsAppQRCode] result — pairingCode:', pairingCode, '| qrCode:', !!qrCode);

    return Response.json({
      connected: false,
      status: state || 'close',
      qrCode,
      pairingCode,
    });

  } catch (error) {
    console.error('[getWhatsAppQRCode] erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});