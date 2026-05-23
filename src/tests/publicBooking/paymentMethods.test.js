// Garante que o fluxo público de booking aceita apenas os métodos suportados
// pela Etapa 2B+ (PIX e CREDIT_CARD via hosted Asaas) e bloqueia o resto.

export const paymentMethodsTests = {
  name: 'public_booking_payment_methods',
  scenarios: [
    {
      id: 'accepts_pix',
      input: { payment_method: 'pix' },
      assertResult: (res) => res?.success === true && res.payment_method === 'pix',
    },
    {
      id: 'accepts_card',
      input: { payment_method: 'card' },
      assertResult: (res) => res?.success === true && res.payment_method === 'card' && !!res.asaas_invoice_url,
    },
    {
      id: 'rejects_boleto',
      input: { payment_method: 'boleto' },
      assertResult: (res) => res?.error === 'invalid_payment_method',
    },
    {
      id: 'rejects_stripe_legacy',
      input: { payment_method: 'stripe' },
      assertResult: (res) => res?.error === 'invalid_payment_method',
    },
    {
      id: 'default_pix_when_omitted',
      input: {},
      assertResult: (res) => res?.payment_method === 'pix',
    },
    {
      id: 'case_insensitive',
      input: { payment_method: 'CARD' },
      assertResult: (res) => res?.payment_method === 'card',
    },
    {
      id: 'requires_pix_enabled_on_company',
      description: 'asaas_pix_enabled=false bloqueia ambos PIX e cartão (mesma flag liga todo o checkout Asaas público).',
      assertResult: (res) => res?.error === 'asaas_pix_not_enabled',
    },
    {
      id: 'requires_cpf',
      input: { customer_cpf: '' },
      assertResult: (res) => res?.error === 'cpf_required',
    },
    {
      id: 'rate_limit_applies_to_all_methods',
      description: 'Limite de 5 tentativas/hora por telefone vale igual pra PIX e cartão.',
      assertResult: (res) => res?.error === 'rate_limited',
    },
  ],
};

export default paymentMethodsTests;