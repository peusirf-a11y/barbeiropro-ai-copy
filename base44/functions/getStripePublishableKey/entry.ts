// Endpoint PÚBLICO que devolve a publishable key + ambiente ativo.
// Seleciona a chave conforme STRIPE_ENVIRONMENT ('test' | 'live').
// NUNCA expõe a secret. Apenas a publishable.

Deno.serve(async () => {
  try {
    const key = Deno.env.get('STRIPE_PUBLISHABLE_KEY') || '';
    if (!key) {
      console.error('[getStripePublishableKey] STRIPE_PUBLISHABLE_KEY missing');
      return Response.json({ error: 'STRIPE_PUBLISHABLE_KEY missing' }, { status: 500 });
    }
    // Compat: mantém chaves antigas (publishable_key, test_mode) E novas (publishableKey, environment).
    return Response.json({
      publishableKey: key,
      environment: 'live',
      publishable_key: key,
      test_mode: false,
    });
  } catch (error) {
    console.error('[getStripePublishableKey] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});