// Suíte conceitual: cobre as garantias do fluxo de cartão hosted no booking público
// via Asaas (Etapa 2B+). Foco: nunca tocar em PAN/CVV, idempotência por método,
// invoiceUrl preservado, fallback resiliente quando o gateway está fora.
//
// Executar via runHardeningTests/runFoundationTests (mesma convenção do projeto).

export const bookingCardPaymentTests = {
  name: 'booking_card_payment',
  scenarios: [
    {
      id: 'pan_cvv_never_touched',
      description: 'createAsaasBookingPayment NUNCA recebe ou loga dados de cartão.',
      assert: (input) => {
        const forbidden = ['card_number', 'cardNumber', 'pan', 'cvv', 'ccv', 'card_cvv', 'security_code'];
        const flat = JSON.stringify(input || {}).toLowerCase();
        return forbidden.every(k => !flat.includes(`"${k.toLowerCase()}"`));
      },
    },
    {
      id: 'method_card_returns_invoice_url',
      description: 'Quando payment_method=card o backend devolve asaas_invoice_url.',
      assertResponse: (res) => res?.payment_method === 'card' && typeof res?.asaas_invoice_url === 'string' && res.asaas_invoice_url.startsWith('http'),
    },
    {
      id: 'method_pix_returns_qr',
      description: 'Quando payment_method=pix o backend devolve qr_code_url ou copy_paste.',
      assertResponse: (res) => res?.payment_method === 'pix' && (!!res?.pix?.qr_code_url || !!res?.pix?.copy_paste),
    },
    {
      id: 'idempotency_per_method',
      description: 'Mesmo appointment com métodos diferentes gera Payments diferentes (idempotencyKey inclui método).',
      assertKeys: (k1, k2) => k1 === 'bk_pay:apt_1:pix' && k2 === 'bk_pay:apt_1:card' && k1 !== k2,
    },
    {
      id: 'invalid_method_rejected',
      description: 'payment_method=boleto retorna 400 invalid_payment_method.',
      assertError: (err) => err?.status === 400 && err?.body?.error === 'invalid_payment_method',
    },
    {
      id: 'asaas_failure_rollback',
      description: 'Quando Asaas falha após criar Appointment, status vai pra cancelado/failed e slot é liberado.',
      assertRollback: (appt) => appt.status === 'cancelado' && appt.payment_status === 'failed',
    },
    {
      id: 'webhook_is_source_of_truth',
      description: 'Frontend não confia em popup fechado — só marca pago quando getAsaasBookingStatus devolver succeeded.',
      assertFlow: (events) => events.includes('webhook_received') && events.includes('appointment_marked_paid'),
    },
    {
      id: 'tenant_isolation',
      description: 'service_id e professional_id devem pertencer ao company_id; caso contrário, 404.',
      assertError: (err) => err?.status === 404 && ['service_not_found', 'professional_not_found'].includes(err?.body?.error),
    },
  ],
};

export default bookingCardPaymentTests;