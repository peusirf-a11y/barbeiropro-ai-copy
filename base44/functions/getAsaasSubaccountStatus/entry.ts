// getAsaasSubaccountStatus — Etapa 2C+
// Retorna o estado atual da subaccount Asaas vinculada à Company. Opcionalmente
// consulta o Asaas (GET /accounts/{id}) para detectar transição pending→active
// quando o webhook ACCOUNT_STATUS_UPDATED ainda não chegou.
//
// Auth: admin/owner da Company. Tenant isolation rígido.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getAsaasConfig() {
  const apiKey = Deno.env.get('ASAAS_API_KEY');
  const environment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
  const baseUrl = Deno.env.get('ASAAS_BASE_URL')
    || (environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
  return { apiKey, baseUrl, isConfigured: !!apiKey };
}

async function asaasGet(path) {
  const cfg = getAsaasConfig();
  if (!cfg.isConfigured) return null;
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    headers: { 'access_token': cfg.apiKey, 'Accept': 'application/json' },
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

// Mapeia status do Asaas → status interno simplificado.
function mapAsaasStatus(raw) {
  if (!raw) return 'pending';
  const s = String(raw).toUpperCase();
  if (s === 'APPROVED' || s === 'ACTIVE') return 'active';
  if (s === 'REJECTED' || s === 'BLOCKED' || s === 'DISABLED') return 'rejected';
  return 'pending';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { company_id, force_check } = body;
    if (!company_id) return Response.json({ error: 'company_id_required' }, { status: 400 });

    const company = await sdk.entities.Company.get(company_id).catch(() => null);
    if (!company) return Response.json({ error: 'company_not_found' }, { status: 404 });

    const isOwner = company.owner_email === user.email;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) return Response.json({ error: 'forbidden' }, { status: 403 });

    let currentStatus = company.asaas_subaccount_status || null;

    // Force check: sincroniza com Asaas
    if (force_check && company.asaas_subaccount_id) {
      const acc = await asaasGet(`/accounts/${company.asaas_subaccount_id}`);
      if (acc) {
        const newStatus = mapAsaasStatus(acc.status || acc.accountStatus);
        if (newStatus !== currentStatus) {
          await sdk.entities.Company.update(company.id, {
            asaas_subaccount_status: newStatus,
            asaas_subaccount_onboarding_url: acc.onboardingUrl || company.asaas_subaccount_onboarding_url,
          }).catch(() => {});
          currentStatus = newStatus;
        }
      }
    }

    return Response.json({
      connected: !!company.asaas_subaccount_id,
      asaas_subaccount_id: company.asaas_subaccount_id || null,
      wallet_id: company.asaas_subaccount_wallet_id || null,
      status: currentStatus,
      split_mode: company.asaas_split_mode || (company.asaas_subaccount_id ? 'automatic' : null),
      onboarding_url: company.asaas_subaccount_onboarding_url || null,
      split_percentage: Number.isFinite(Number(company.asaas_split_percentage)) ? company.asaas_split_percentage : 100,
      pix_enabled: !!company.asaas_pix_enabled,
      owner_cpf_cnpj: company.owner_cpf_cnpj || null,
    });
  } catch (err) {
    console.error('[getAsaasSubaccountStatus] error', err);
    return Response.json({ error: 'internal_error', message: err.message }, { status: 500 });
  }
});