# Template `getEnv` para backend functions — F2 Foundation Sprint

A plataforma Base44 **não permite local imports em `functions/`** (cada function é deployada independente). Por isso o helper `lib/env.js` (frontend) tem um **gêmeo inline** que cada function copia.

## Como usar em uma function nova

Cole o bloco abaixo no topo do arquivo, logo após os imports `npm:`:

```js
// ── getEnv inline (F2 — Foundation Sprint) ──────────────────────────
// Espelha lib/env.js do frontend. Centraliza leitura de Deno.env.get com
// validação + defaults + fail-fast. Cada function copia este bloco porque
// Base44 não permite local imports em functions/.
const _ENV_SCHEMA = {
  STRIPE_SECRET_KEY:           { required: true,  validate: v => v.startsWith('sk_') },
  STRIPE_PUBLISHABLE_KEY:      { required: true,  validate: v => v.startsWith('pk_') },
  STRIPE_WEBHOOK_SECRET:       { required: true },
  STRIPE_WEBHOOK_SECRET_CONNECT: { required: false },
  STRIPE_TEST_SECRET_KEY:      { required: false, validate: v => v.startsWith('sk_test_') },
  STRIPE_TEST_PUBLISHABLE_KEY: { required: false, validate: v => v.startsWith('pk_test_') },
  STRIPE_TEST_WEBHOOK_SECRET:  { required: false },
  STRIPE_TEST_WEBHOOK_SECRET_CONNECT: { required: false },
  STRIPE_ENVIRONMENT:          { required: false, default: 'test', enum: ['test', 'live'] },
  BASE44_APP_ID:               { required: false },
  ZAPI_INSTANCE_ID:            { required: false },
  ZAPI_TOKEN:                  { required: false },
  ZAPI_CLIENT_TOKEN:           { required: false },
  BOOKING_RATE_LIMIT_PER_HOUR: { required: false, default: 5,  parse: Number },
  SLOT_RESERVATION_TTL_SECONDS:{ required: false, default: 90, parse: Number },
  ENABLE_SLOT_LOCK:            { required: false, default: true, parse: v => v !== 'false' },
};
function getEnv(name) {
  const spec = _ENV_SCHEMA[name];
  if (!spec) throw new Error(`[env] Unknown var: ${name}. Add to _ENV_SCHEMA.`);
  const raw = Deno.env.get(name);
  if (raw == null || raw === '') {
    if (spec.required) throw new Error(`[env] Missing required env: ${name}`);
    return spec.default ?? null;
  }
  if (spec.enum && !spec.enum.includes(raw)) {
    throw new Error(`[env] Invalid ${name}: expected ${spec.enum.join('|')}, got ${raw}`);
  }
  if (spec.validate && !spec.validate(raw)) {
    throw new Error(`[env] Invalid ${name}: failed validation`);
  }
  return spec.parse ? spec.parse(raw) : raw;
}
// ────────────────────────────────────────────────────────────────────
```

## Como migrar uma function existente

**Antes:**
```js
const apiKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!apiKey) throw new Error('Missing STRIPE_SECRET_KEY');
if (!apiKey.startsWith('sk_')) throw new Error('Invalid key');
```

**Depois:**
```js
const apiKey = getEnv('STRIPE_SECRET_KEY'); // valida + fail-fast automático
```

## Regras

1. **NUNCA** chamar `Deno.env.get` direto fora deste bloco.
2. Se precisar de uma var nova, **adicionar ao schema** antes de usar.
3. Defaults devem ser explícitos no schema, não inline no caller.

## Migração da Stripe (recomendada)

Foundation Sprint começa por **5 functions Stripe** (maior risco de mismatch):
- `createBookingPaymentIntent`
- `stripeWebhook`
- `createCheckoutSession`
- `createCustomerPlanCheckout`
- `createConnectOnboardingLink`

Resto migra incremental quando cada function for tocada por outro motivo.