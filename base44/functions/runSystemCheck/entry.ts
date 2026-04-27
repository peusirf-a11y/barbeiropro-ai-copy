// runSystemCheck — diagnóstico de produção (admin-only)
// Verifica: Z-API, Stripe, contagem de empresas em trial, automations ativas.
// NÃO envia mensagens reais — apenas valida conexões e configuração.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

Deno.serve(async (req) => {
  console.log('JOB START: runSystemCheck');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.is_super_admin) {
      return Response.json({ success: false, error: 'Forbidden: Super Admin only' }, { status: 403 });
    }

    const result = {
      whatsapp: 'unknown',
      email: 'unknown',
      stripe: 'unknown',
      trial_companies: 0,
      blocked_companies: 0,
      checked_at: new Date().toISOString(),
    };

    // --- Z-API ---
    try {
      const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
      const token = Deno.env.get('ZAPI_TOKEN');
      const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
      const isPlaceholder = (v) => !v || ['pending', 'todo', 'placeholder', 'test'].includes(String(v).toLowerCase());
      if (isPlaceholder(instanceId) || isPlaceholder(token)) {
        result.whatsapp = 'not_configured';
      } else {
        const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
        const headers = {};
        if (clientToken) headers['Client-Token'] = clientToken;
        const res = await fetch(url, { headers });
        const data = await res.json().catch(() => ({}));
        result.whatsapp = res.ok && data?.connected ? 'ok' : 'disconnected';
        result.whatsapp_detail = data;
      }
    } catch (err) {
      console.error('whatsapp check failed:', err.message);
      result.whatsapp = 'error';
      result.whatsapp_error = err.message;
    }

    // --- Stripe ---
    try {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (!stripeKey) {
        result.stripe = 'not_configured';
      } else {
        const stripe = new Stripe(stripeKey);
        // Chamada leve para validar a chave
        await stripe.products.list({ limit: 1 });
        result.stripe = 'ok';
      }
    } catch (err) {
      console.error('stripe check failed:', err.message);
      result.stripe = 'error';
      result.stripe_error = err.message;
    }

    // --- Email (Core integration disponível?) ---
    result.email = base44.asServiceRole.integrations?.Core?.SendEmail ? 'ok' : 'not_available';

    // --- Empresas em trial / bloqueadas ---
    try {
      const trialing = await base44.asServiceRole.entities.Company.filter({ subscription_status: 'trialing' }, '-created_date', 1000);
      result.trial_companies = trialing?.length || 0;
      const blocked = await base44.asServiceRole.entities.Company.filter({ status: 'blocked' }, '-created_date', 1000);
      result.blocked_companies = blocked?.length || 0;
    } catch (err) {
      console.error('company count failed:', err.message);
      result.companies_error = err.message;
    }

    console.log('JOB END: runSystemCheck', result);
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error('JOB ERROR: runSystemCheck:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});