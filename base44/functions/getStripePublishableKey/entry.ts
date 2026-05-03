// Endpoint público que devolve a STRIPE_PUBLISHABLE_KEY.
// Necessário porque o frontend público não tem acesso a env vars do backend.
// A publishable key é segura para expor (é desenhada para isso pelo Stripe).

Deno.serve(async () => {
  const key = Deno.env.get('STRIPE_PUBLISHABLE_KEY') || '';
  return Response.json({ publishable_key: key });
});