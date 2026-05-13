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

    // 2. Solicita o QR Code / pairing code
    const connectRes = await fetch(`${baseUrl}/instance/connect/${instance}`, { headers });

    if (!connectRes.ok) {
      const errText = await connectRes.text();
      console.error('[getWhatsAppQRCode] Evolution API connect error:', errText);
      return Response.json({ error: 'Não foi possível obter o QR Code.', detail: errText }, { status: 502 });
    }

    const connectData = await connectRes.json();
    console.log('[getWhatsAppQRCode] connect response keys:', Object.keys(connectData));

    // connectData.code = string base64 do QR (ex: "2@abc...")
    // connectData.pairingCode = código de pareamento alfanumérico (ex: "WZYEH1YY")
    // Precisamos montar a data URI para exibir como imagem no frontend
    const rawCode = connectData.code || '';
    let qrCode = null;

    if (rawCode) {
      // Se já vier como data URI, usa direto; caso contrário empacota
      if (rawCode.startsWith('data:')) {
        qrCode = rawCode;
      } else {
        // Evolution API retorna o base64 do PNG diretamente
        qrCode = `data:image/png;base64,${rawCode}`;
      }
    }

    return Response.json({
      connected: false,
      status: state || 'close',
      qrCode,
      pairingCode: connectData.pairingCode || null,
    });

  } catch (error) {
    console.error('[getWhatsAppQRCode] erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});