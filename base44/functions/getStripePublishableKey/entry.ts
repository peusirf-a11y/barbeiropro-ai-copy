// Endpoint PÚBLICO que devolve a publishable key + ambiente ativo.
// Seleciona a chave conforme STRIPE_ENVIRONMENT ('test' | 'live').
// NUNCA expõe a secret. Apenas a publishable.

Deno.serve(async () => {
  try {
    const env = (Deno.env.get('STRIPE_ENVIRONMENT') || 'test').toLowerCase();
    const isLive = env === 'live';
    const key = (isLive ? Deno.env.get('STRIPE_PUBLISHABLE_KEY') : Deno.env.get('STRIPE_TEST_PUBLISHABLE_KEY')) || '';
    const expectedPrefix = isLive ? 'pk_live_' : 'pk_test_';

    if (!key) {
      console.error(`[getStripePublishableKey] missing publishable key for environment=${env}`);
      return Response.json({ error: `Publishable key missing for environment=${env}` }, { status: 500 });
    }
    if (!key.startsWith(expectedPrefix)) {
      console.error(`[getStripePublishableKey] prefix mismatch: env=${env} expected=${expectedPrefix}`);
      return Response.json({ error: `Publishable key prefix mismatch for environment=${env}` }, { status: 500 });
    }

    console.log(`[stripe] environment=${env}`);
    // Compat: mantém chaves antigas (publishable_key, test_mode) E novas (publishableKey, environment).
    return Response.json({
      publishableKey: key,
      environment: env,
      publishable_key: key,
      test_mode: !isLive,
    });
  } catch (error) {
    console.error('[getStripePublishableKey] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});