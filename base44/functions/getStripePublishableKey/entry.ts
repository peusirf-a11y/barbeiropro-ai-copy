// Endpoint público que devolve a STRIPE_TEST_PUBLISHABLE_KEY.
// TEST MODE: somente chaves de teste (pk_test_) são aceitas. pk_live_ é bloqueada.

Deno.serve(async () => {
  const key = Deno.env.get('STRIPE_TEST_PUBLISHABLE_KEY') || '';
  if (!key) {
    console.error('[getStripePublishableKey] TEST_MODE: STRIPE_TEST_PUBLISHABLE_KEY ausente.');
    return Response.json({ error: 'TEST_MODE: STRIPE_TEST_PUBLISHABLE_KEY ausente.' }, { status: 500 });
  }
  if (key.startsWith('pk_live_')) {
    console.error('[getStripePublishableKey] TEST_MODE: chave LIVE detectada — bloqueada.');
    return Response.json({ error: 'TEST_MODE: chave LIVE bloqueada. Use pk_test_.' }, { status: 500 });
  }
  if (!key.startsWith('pk_test_')) {
    console.error('[getStripePublishableKey] TEST_MODE: chave inválida.');
    return Response.json({ error: 'TEST_MODE: chave inválida — deve começar com pk_test_.' }, { status: 500 });
  }
  return Response.json({ publishable_key: key, test_mode: true });
});