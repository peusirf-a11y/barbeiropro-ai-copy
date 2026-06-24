// getPublicPlans — endpoint público (sem auth) que devolve os planos
// visíveis publicamente (visibility='public' + active=true), ordenados
// por sort_order. É a fonte da verdade dos preços exibidos no checkout
// e na landing, evitando que valores hardcoded fiquem desatualizados
// quando o Master edita os planos.
//
// Resposta: { plans: [{ id, name, price_monthly, features, limits, sort_order, stripe_price_id }] }
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Service role: a entidade Plan tem visibility/permissions controlados; usuários
    // deslogados (visitantes da landing/checkout) não podem ler direto.
    const raw = await base44.asServiceRole.entities.Plan.filter(
      { visibility: 'public', active: true },
      'sort_order',
      50,
    );

    const plans = raw.map(p => ({
      id: p.id,
      name: p.name,
      price_monthly: Number(p.price_monthly) || 0,
      features: Array.isArray(p.features) ? p.features : [],
      limits: p.limits || {},
      sort_order: Number(p.sort_order) || 0,
      stripe_price_id: p.stripe_price_id || null,
    }));

    return Response.json({ plans }, {
      headers: {
        // Cache curto: master edita e em até 30s reflete na landing/checkout.
        'Cache-Control': 'public, max-age=30',
      },
    });
  } catch (error) {
    console.error('[getPublicPlans] erro:', error.message);
    return Response.json({ plans: [] }, { status: 200 });
  }
});