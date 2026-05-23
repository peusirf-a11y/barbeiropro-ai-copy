// createAsaasSubaccount — Etapa 2C+
// Cria uma SUBACCOUNT Asaas (conta-filha) para a barbearia receber repasses
// automáticos via split. O recebimento da subaccount é a wallet própria da barbearia,
// totalmente segregada da conta master O CORTE.
//
// Endpoint Asaas: POST /accounts  (Account White Label / Subcontas)
//   Docs: https://docs.asaas.com/reference/criar-subconta
//
// Auth: admin/owner da Company. Tenant isolation: só pode criar para a própria empresa.
// Idempotência: se já existe asaas_subaccount_id na Company, devolve estado atual sem recriar.
// Audit log: AdminAuditLog action='STRIPE_CONNECTED' reaproveitado (categoria genérica de billing).
// Rollback seguro: erro Asaas não persiste nada, marca SecurityEvent.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getAsaasConfig() {
  const apiKey = Deno.env.get('ASAAS_API_KEY');
  const environment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
  const baseUrl = Deno.env.get('ASAAS_BASE_URL')
    || (environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
  return { apiKey, baseUrl, isConfigured: !!apiKey };
}

function digitsOnly(v) { return String(v || '').replace(/\D+/g, ''); }
function sanitizeCpfCnpj(v) { const d = digitsOnly(v); return (d.length === 11 || d.length === 14) ? d : null; }
function sanitizePhone(v) { const d = digitsOnly(v); return (d.length >= 10 && d.length <= 13) ? d : null; }

async function asaasFetch(method, path, { body, query, idempotencyKey } = {}) {
  const cfg = getAsaasConfig();
  if (!cfg.isConfigured) { const e = new Error('ASAAS_API_KEY not configured'); e.code = 'asaas_not_configured'; e.status = 503; throw e; }
  let url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v != null) qs.append(k, String(v));
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'access_token': cfg.apiKey,
    'User-Agent': 'OCorte-SaaS/1.0 (+subaccount)',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    clearTimeout(t);
    const txt = await res.text();
    let data = null;
    if (txt) { try { data = JSON.parse(txt); } catch { data = txt; } }
    if (!res.ok) {
      const e = new Error(extractErr(data) || `HTTP ${res.status}`);
      e.code = res.status === 401 ? 'asaas_unauthorized' : res.status === 400 ? 'asaas_bad_request' : 'asaas_error';
      e.status = res.status; e.details = data;
      throw e;
    }
    return data;
  } catch (err) {
    clearTimeout(t);
    if (err.code) throw err;
    if (err.name === 'AbortError') { const e = new Error('asaas timeout'); e.code = 'asaas_timeout'; e.status = 504; throw e; }
    const e = new Error(err.message || 'network'); e.code = 'asaas_network'; e.status = 502; throw e;
  }
}

function extractErr(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.slice(0, 200);
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors.map(e => e?.description || e?.code).filter(Boolean).join('; ');
  return data?.message || data?.error || null;
}

Deno.serve(async (req) => {
  const corrId = crypto.randomUUID().split('-')[0];
  const startedAt = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { company_id } = body;
    if (!company_id) return Response.json({ error: 'company_id_required' }, { status: 400 });

    // ─── Tenant isolation ────────────────────────────────────────────
    const company = await sdk.entities.Company.get(company_id).catch(() => null);
    if (!company) return Response.json({ error: 'company_not_found' }, { status: 404 });
    const isOwner = company.owner_email === user.email;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      console.warn('[createAsaasSubaccount] forbidden', { corrId, user: user.email, company_id });
      await sdk.entities.SecurityEvent.create({
        event_type: 'cross_tenant_attempt', severity: 'high',
        company_id, actor_email: user.email,
        route: 'createAsaasSubaccount',
        details: { reason: 'not_owner' }, blocked: true,
      }).catch(() => {});
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    // ─── Idempotência por Company ────────────────────────────────────
    if (company.asaas_subaccount_id) {
      console.log('[createAsaasSubaccount] already exists', { corrId, company_id, sub: company.asaas_subaccount_id });
      return Response.json({
        ok: true,
        already_exists: true,
        asaas_subaccount_id: company.asaas_subaccount_id,
        wallet_id: company.asaas_subaccount_wallet_id || null,
        status: company.asaas_subaccount_status || 'pending',
        onboarding_url: company.asaas_subaccount_onboarding_url || null,
      });
    }

    // ─── Validação dos dados necessários ─────────────────────────────
    const cpfNorm = sanitizeCpfCnpj(body.cpf_cnpj || company.owner_cpf_cnpj);
    if (!cpfNorm) return Response.json({ error: 'cpf_cnpj_required', message: 'Informe o CPF ou CNPJ do responsável.' }, { status: 400 });

    // ─── BLOQUEIO PF: Asaas não permite subaccount com CPF ──────────
    // Devolve erro amigável já traduzido — frontend usa este código pra rotear
    // o usuário pro modo manual (enableAsaasManualMode).
    if (cpfNorm.length === 11) {
      console.log('[createAsaasSubaccount] cpf_blocked → suggest manual mode', { corrId, company_id });
      return Response.json({
        error: 'cnpj_required',
        message: 'Para recebimento automático direto na sua conta, é necessário CNPJ ou MEI. Você pode começar agora no modo de repasse manual (a O CORTE recebe e repassa para você).',
        suggest_manual_mode: true,
      }, { status: 400 });
    }

    const addr = body.address_details || company.address_details || {};
    const postalCode = digitsOnly(addr.postal_code);
    const province = addr.neighborhood;
    const address = addr.line1;
    const addressNumber = body.address_number || addr.address_number;
    const city = addr.city;
    const state = addr.state;
    if (!postalCode || !address || !addressNumber || !city || !state) {
      return Response.json({
        error: 'address_incomplete',
        message: 'Preencha CEP, endereço, número, bairro, cidade e UF antes de ativar.',
      }, { status: 400 });
    }

    const ownerName = body.name || company.owner_name || company.name;
    const email = body.email || company.owner_email;
    if (!ownerName || !email) return Response.json({ error: 'missing_owner_data' }, { status: 400 });
    const mobilePhone = sanitizePhone(body.mobile_phone || company.whatsapp || company.phone) || undefined;

    const companyType = company.business_type === 'mei' ? 'MEI'
      : company.business_type === 'cnpj' ? (cpfNorm.length === 14 ? 'LIMITED' : 'INDIVIDUAL')
      : 'INDIVIDUAL';

    // Asaas exige birthDate quando é conta com CPF (INDIVIDUAL/MEI). CNPJ (LIMITED) não precisa.
    // Formato esperado: YYYY-MM-DD.
    const needsBirthDate = cpfNorm.length === 11;
    const birthDate = String(body.birth_date || '').trim();
    if (needsBirthDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        return Response.json({
          error: 'birth_date_required',
          message: 'Informe a data de nascimento do responsável (exigência do Asaas).',
        }, { status: 400 });
      }
    }

    // ─── Cria subaccount no Asaas ────────────────────────────────────
    let account = null;
    try {
      account = await asaasFetch('POST', '/accounts', {
        idempotencyKey: `subacc:${company.id}`,
        body: {
          name: ownerName,
          email,
          cpfCnpj: cpfNorm,
          mobilePhone,
          companyType,
          address,
          addressNumber: String(addressNumber),
          province,
          postalCode,
          // birthDate obrigatório para CPF (INDIVIDUAL/MEI); ignorado para CNPJ.
          birthDate: needsBirthDate ? birthDate : undefined,
        },
      });
    } catch (err) {
      console.error('[createAsaasSubaccount] asaas error', { corrId, code: err.code, status: err.status, msg: err.message, details: err.details });
      await sdk.entities.SecurityEvent.create({
        event_type: 'suspicious_payload', severity: 'medium',
        company_id, actor_email: user.email,
        route: 'createAsaasSubaccount',
        details: { code: err.code, asaas_err: String(err.message || '').slice(0, 200) },
        blocked: false,
      }).catch(() => {});
      return Response.json({ error: err.code || 'asaas_error', message: err.message || 'Falha ao criar conta Asaas.' }, { status: err.status || 502 });
    }

    const apiKey = account.apiKey || '';
    const apiKeyPreview = apiKey ? `***${apiKey.slice(-8)}` : '';
    const walletId = account.walletId || account.id;
    const onboardingUrl = account.onboardingUrl || null;

    // Persiste na Company
    await sdk.entities.Company.update(company.id, {
      asaas_subaccount_id: account.id,
      asaas_subaccount_wallet_id: walletId,
      asaas_subaccount_status: 'pending',
      asaas_subaccount_api_key_preview: apiKeyPreview,
      asaas_subaccount_onboarding_url: onboardingUrl || undefined,
      asaas_split_percentage: Number.isFinite(Number(company.asaas_split_percentage)) ? company.asaas_split_percentage : 100,
      asaas_split_mode: 'automatic',
      // Habilita PIX automaticamente (já que agora tem destino de split).
      asaas_pix_enabled: true,
    });

    // Audit log
    await sdk.entities.AdminAuditLog.create({
      actor: user.email,
      actor_role: isAdmin ? 'admin' : (user.role || 'admin'),
      company_id,
      target_entity: 'Company', target_id: company.id,
      action: 'STRIPE_CONNECTED',
      after: { asaas_subaccount_id: account.id, asaas_subaccount_status: 'pending', wallet_id: walletId },
      severity: 'info',
      metadata: { provider: 'asaas', subaccount: true },
    }).catch(() => {});

    console.log('[createAsaasSubaccount] ok', {
      corrId, company_id, sub: account.id, latency_ms: Date.now() - startedAt,
    });

    return Response.json({
      ok: true,
      asaas_subaccount_id: account.id,
      wallet_id: walletId,
      status: 'pending',
      onboarding_url: onboardingUrl,
    });
  } catch (err) {
    console.error('[createAsaasSubaccount] fatal', { corrId, msg: err.message, stack: err.stack });
    return Response.json({ error: 'internal_error', message: err.message }, { status: 500 });
  }
});