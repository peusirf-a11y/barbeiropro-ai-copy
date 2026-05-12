// Retorna o QR Code da instância Z-API para conectar o WhatsApp.
// Também retorna o status atual da conexão.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const token = Deno.env.get('ZAPI_TOKEN');
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!instanceId || !token) {
      return Response.json({ error: 'Credenciais Z-API não configuradas.' }, { status: 500 });
    }

    const headers = {
      'Content-Type': 'application/json',
      'Client-Token': clientToken || '',
    };

    // Primeiro verifica o status da conexão
    const statusRes = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/status`,
      { headers }
    );
    const statusData = await statusRes.json();

    // Se já está conectado, não precisa de QR
    if (statusData.connected) {
      return Response.json({ connected: true, status: 'connected' });
    }

    // Busca o QR Code
    const qrRes = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code/image`,
      { headers }
    );

    if (!qrRes.ok) {
      const errText = await qrRes.text();
      console.error('[getWhatsAppQRCode] Z-API error:', errText);
      return Response.json({ error: 'Não foi possível obter o QR Code.', detail: errText }, { status: 502 });
    }

    // Z-API retorna a imagem diretamente ou um JSON com value
    const contentType = qrRes.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const json = await qrRes.json();
      // { value: "data:image/png;base64,..." }
      return Response.json({ connected: false, qrCode: json.value || json.qrCode });
    }

    // É imagem — converte para base64
    const buffer = await qrRes.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const mimeType = contentType.split(';')[0].trim() || 'image/png';

    return Response.json({
      connected: false,
      qrCode: `data:${mimeType};base64,${base64}`,
    });

  } catch (error) {
    console.error('[getWhatsAppQRCode] erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});