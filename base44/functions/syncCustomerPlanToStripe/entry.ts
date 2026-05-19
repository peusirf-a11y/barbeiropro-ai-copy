// Sincroniza um CustomerPlan (plano de assinatura que a barbearia oferece a clientes finais)
// como Product + Price recorrente na conta Stripe Connect da própria barbearia.
//
// Fluxo:
//   - Plano sem stripe_price_id ainda → cria Product + Price e salva o stripe_price_id no plano.
//   - Plano com stripe_price_id e mudou nome/descrição → atualiza o Product na Stripe (Price é imutável).
//   - Plano com stripe_price_id e MUDOU PREÇO → cria um novo Price (o antigo é arquivado), atualiza stripe_price_id.
//   - Plano com active=false → arquiva o Product na Stripe.
//
// Esta função é chamada pela automation entity-trigger em CustomerPlan.create/update.
// Também pode ser chamada manualmente passando { plan_id }.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

function getStripeSecret() {
  const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  return key;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Suporta dois formatos:
    //   1) Automation entity payload: { event: { entity_id }, data: {...} }
    //   2) Chamada manual: { plan_id: "..." }
    const planId = body?.plan_id || body?.event?.entity_id;
    if (!planId) {
      return Response.json({ error: 'plan_id ausente' }, { status: 400 });
    }

    const plan = body?.data || await base44.asServiceRole.entities.CustomerPlan.get(planId);
    if (!plan) {
      console.error('[syncCustomerPlanToStripe] plano não encontrado:', planId);
      return Response.json({ error: 'plano não encontrado' }, { status: 404 });
    }

    const company = await base44.asServiceRole.entities.Company.get(plan.company_id);
    if (!company) {
      console.error('[syncCustomerPlanToStripe] company não encontrada:', plan.company_id);
      return Response.json({ error: 'company não encontrada' }, { status: 404 });
    }

    const connectAccountId = company.stripe_connect_account_id;
    if (!connectAccountId) {
      console.log(`[syncCustomerPlanToStripe] skip: company ${company.id} sem Stripe Connect`);
      return Response.json({ skipped: true, reason: 'no_connect_account' });
    }

    const stripe = new Stripe(getStripeSecret(), { apiVersion: '2024-06-20' });
    const stripeOpts = { stripeAccount: connectAccountId };

    const priceCents = Math.round(Number(plan.price_monthly || 0) * 100);
    if (priceCents <= 0) {
      console.log(`[syncCustomerPlanToStripe] skip: preço inválido (${plan.price_monthly})`);
      return Response.json({ skipped: true, reason: 'invalid_price' });
    }

    let stripeProductId = plan.stripe_product_id || null;
    let stripePriceId = plan.stripe_price_id || null;

    // 1) Criar Product se não existe
    if (!stripeProductId) {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description || undefined,
        active: plan.active !== false,
        metadata: {
          base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
          base44_plan_id: plan.id,
          base44_company_id: company.id,
        },
      }, stripeOpts);
      stripeProductId = product.id;
      console.log(`[syncCustomerPlanToStripe] product criado: ${stripeProductId}`);
    } else {
      // Atualiza nome/descrição/active no product existente
      await stripe.products.update(stripeProductId, {
        name: plan.name,
        description: plan.description || undefined,
        active: plan.active !== false,
      }, stripeOpts);
    }

    // 2) Criar Price se não existe ou se preço mudou
    let needsNewPrice = !stripePriceId;
    if (stripePriceId && !needsNewPrice) {
      // Compara preço atual no Stripe x preço no plano
      const currentPrice = await stripe.prices.retrieve(stripePriceId, stripeOpts).catch(() => null);
      if (!currentPrice || currentPrice.unit_amount !== priceCents) {
        needsNewPrice = true;
        // Arquiva o price antigo (não pode deletar)
        if (currentPrice?.active) {
          await stripe.prices.update(stripePriceId, { active: false }, stripeOpts).catch(() => {});
        }
      }
    }

    if (needsNewPrice) {
      const price = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: priceCents,
        currency: 'brl',
        recurring: { interval: 'month' },
        metadata: {
          base44_plan_id: plan.id,
        },
      }, stripeOpts);
      stripePriceId = price.id;
      console.log(`[syncCustomerPlanToStripe] price criado: ${stripePriceId} (${priceCents} cents)`);
    }

    // 3) Persistir IDs de volta no plano (apenas se mudaram)
    const updates = {};
    if (stripeProductId !== plan.stripe_product_id) updates.stripe_product_id = stripeProductId;
    if (stripePriceId !== plan.stripe_price_id) updates.stripe_price_id = stripePriceId;
    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.CustomerPlan.update(plan.id, updates);
    }

    return Response.json({
      ok: true,
      stripe_product_id: stripeProductId,
      stripe_price_id: stripePriceId,
    });
  } catch (error) {
    console.error('[syncCustomerPlanToStripe] erro:', error?.message, error);
    return Response.json({ error: error?.message || 'erro desconhecido' }, { status: 500 });
  }
});