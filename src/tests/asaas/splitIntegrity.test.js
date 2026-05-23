// Garante que o split automático para a subaccount da barbearia só é aplicado
// quando a subaccount está APROVADA. Cobertura conceitual — roda em ambiente
// de testes do projeto (runHardeningTests).

export const splitIntegrityTests = {
  name: 'asaas_split_integrity',
  scenarios: [
    {
      id: 'split_only_when_subaccount_active',
      description: 'Payment body inclui split apenas quando asaas_subaccount_status==="active" E walletId presente.',
      cases: [
        { company: { asaas_subaccount_wallet_id: 'wal_1', asaas_subaccount_status: 'active' }, expectSplit: true },
        { company: { asaas_subaccount_wallet_id: 'wal_1', asaas_subaccount_status: 'pending' }, expectSplit: false },
        { company: { asaas_subaccount_wallet_id: 'wal_1', asaas_subaccount_status: 'rejected' }, expectSplit: false },
        { company: { asaas_subaccount_wallet_id: '',     asaas_subaccount_status: 'active' }, expectSplit: false },
        { company: {},                                                                         expectSplit: false },
      ],
    },
    {
      id: 'default_percentage_100',
      description: 'Sem asaas_split_percentage definido, o repasse é 100% pra barbearia.',
      assertSplit: (split) => Array.isArray(split) && split[0]?.percentualValue === 100,
    },
    {
      id: 'custom_percentage_respected',
      description: 'asaas_split_percentage=85 produz percentualValue=85.',
      input: { asaas_split_percentage: 85 },
      assertSplit: (split) => split[0]?.percentualValue === 85,
    },
    {
      id: 'split_works_for_both_methods',
      description: 'Split é aplicado igual em PIX e CREDIT_CARD (paymentBody construído antes do billingType).',
      assertParity: (pixBody, cardBody) => JSON.stringify(pixBody.split) === JSON.stringify(cardBody.split),
    },
    {
      id: 'no_split_no_silent_failure',
      description: 'Sem subaccount, o Payment é aceito normalmente (cobrança cai na master O CORTE).',
      assertFallback: (res) => res?.success === true && res?.asaas_payment_id,
    },
    {
      id: 'wallet_id_never_leaks_to_frontend',
      description: 'Response do createAsaasBookingPayment não devolve walletId/subaccount_id (PII de tenant).',
      assertResponse: (res) => {
        const flat = JSON.stringify(res || {});
        return !flat.includes('wallet_id') && !flat.includes('subaccount_id');
      },
    },
  ],
};

export default splitIntegrityTests;