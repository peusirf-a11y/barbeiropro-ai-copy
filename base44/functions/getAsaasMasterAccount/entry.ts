// getAsaasMasterAccount — diagnóstico: devolve nome/CNPJ/email da conta Asaas
// master (a que recebe as assinaturas SaaS das barbearias). Lê secrets do
// app (ASAAS_API_KEY, ASAAS_BASE_URL, ASAAS_ENVIRONMENT, ASAAS_WALLET_ID),
// chama GET /myAccount e devolve os campos identificadores.
//
// Acesso: super admin apenas. Não retorna a API key bruta.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '<unset>';
  const prefix = key.startsWith('$aact_prod_') ? '$aact_prod_'
    : key.startsWith('$aact_hmlg_') ? '$aact_hmlg_'
    : key.slice(0, 6);
  return `${prefix}…${key.slice(-4)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const apiKey = Deno.env.get('ASAAS_API_KEY');
    const environment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
    const baseUrl = Deno.env.get('ASAAS_BASE_URL')
      || (environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
    const walletId = Deno.env.get('ASAAS_WALLET_ID') || null;

    if (!apiKey) {
      return Response.json({ ok: false, error: 'asaas_not_configured', environment, baseUrl }, { status: 503 });
    }

    const res = await fetch(`${baseUrl}/myAccount`, {
      method: 'GET',
      headers: { Accept: 'application/json', access_token: apiKey },
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }

    if (!res.ok) {
      return Response.json({
        ok: false,
        status: res.status,
        environment,
        baseUrl,
        api_key_preview: maskApiKey(apiKey),
        walletId,
        message: data?.errors?.[0]?.description || data?.message || `HTTP ${res.status}`,
      }, { status: res.status });
    }

    return Response.json({
      ok: true,
      environment,
      baseUrl,
      api_key_preview: maskApiKey(apiKey),
      walletId,
      account: {
        name: data?.name || null,
        tradingName: data?.tradingName || null,
        email: data?.email || null,
        cpfCnpj: data?.cpfCnpj || null,
        personType: data?.personType || null,
        companyType: data?.companyType || null,
        phone: data?.phone || data?.mobilePhone || null,
        site: data?.site || null,
        city: data?.city || null,
        state: data?.state || null,
        country: data?.country || null,
        walletId: data?.walletId || null,
      },
    });
  } catch (error) {
    console.error('[getAsaasMasterAccount] error:', error?.message);
    return Response.json({ ok: false, error: 'unexpected_error', message: error?.message }, { status: 500 });
  }
});