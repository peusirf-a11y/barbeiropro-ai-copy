// getAsaasSaasStatus — devolve o status atual da assinatura SaaS no Asaas.
// Usado pela tela CheckoutSuccess (polling fallback caso o webhook demore).
//
// Input: { company_id } OU { email }
// Output: { subscription_status, asaas_account_status, payment_url, latest_invoice }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getAsaasConfig() {
  const apiKey = Deno.env.get('ASAAS_API_KEY');
  const environment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
  const baseUrl = Deno.env.get('ASAAS_BASE_URL')
    || (environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
  return { apiKey, baseUrl, isConfigured: !!apiKey };
}

async function asaasGet(path, query) {
  const cfg = getAsaasConfig();
  if (!cfg.isConfigured) return null;
  let url = `${cfg.baseUrl}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v != null) qs.append(k, String(v));
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const res = await fetch(url, {
    headers: { 'access_token': cfg.apiKey, 'Accept': 'application/json' },
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { company_id, email } = body;

    let company = null;
    if (company_id) {
      try { company = await sdk.entities.Company.get(company_id); } catch { company = null; }
    } else if (email) {
      const list = await sdk.entities.Company.filter({ owner_email: String(email).toLowerCase() }, '-created_date', 1);
      company = list?.[0] || null;
    }
    if (!company) {
      return Response.json({ error: 'company_not_found' }, { status: 404 });
    }

    // Busca a invoice mais recente no Asaas
    let latestInvoice = null;
    if (company.asaas_subscription_id) {
      const payments = await asaasGet(`/subscriptions/${company.asaas_subscription_id}/payments`, { limit: 1 });
      const p = payments?.data?.[0];
      if (p) {
        latestInvoice = {
          id: p.id,
          status: p.status,
          due_date: p.dueDate,
          value: p.value,
          invoice_url: p.invoiceUrl || p.bankSlipUrl || null,
        };
      }
    }

    return Response.json({
      company_id: company.id,
      subscription_status: company.subscription_status || 'trialing',
      asaas_account_status: company.asaas_account_status || 'pending',
      trial_ends_at: company.trial_ends_at,
      payment_url: company.asaas_payment_link_url || latestInvoice?.invoice_url || null,
      latest_invoice: latestInvoice,
    });
  } catch (err) {
    console.error('[getAsaasSaasStatus] error:', err.message);
    return Response.json({ error: 'internal_error', message: err.message }, { status: 500 });
  }
});