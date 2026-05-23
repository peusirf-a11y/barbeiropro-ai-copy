// Idempotência: Master pode clicar "Migrar agora" várias vezes — só a primeira faz algo.

export const migrationIdempotencyTests = {
  name: 'asaas_migration_idempotency',
  scenarios: [
    {
      id: 'replay_returns_existing_subscription',
      description: 'Chamar migrateCompanySaasToAsaas 2x na mesma company retorna a mesma asaas_subscription_id (replay=true).',
      assertReplay: (call1, call2) => call1.asaas_subscription_id === call2.asaas_subscription_id
        && call2.replay === true,
    },
    {
      id: 'no_duplicate_asaas_subscriptions',
      description: 'Nenhuma company termina com 2 Asaas Subscriptions ativas — idempotencyKey "mig_sub:{company_id}:{plan}" garante.',
      assertSingle: (asaasCalls) => {
        const subs = asaasCalls.filter(c => c.path === '/subscriptions' && c.method === 'POST');
        const keys = new Set(subs.map(c => c.idempotencyKey));
        return subs.length === keys.size;
      },
    },
    {
      id: 'migrated_state_blocks_retry',
      description: 'Company com migration_status=migrated retorna 200 replay sem tocar em nada.',
      assertNoOp: (c, response) => response.replay === true
        && response.migration_status === 'migrated',
    },
    {
      id: 'pending_state_blocks_retry',
      description: 'Company com migration_status=pending_first_payment retorna 200 replay com asaas_subscription_id atual.',
      assertReuse: (c, response) => response.replay === true
        && response.asaas_subscription_id === c.asaas_subscription_id,
    },
    {
      id: 'customer_idempotent_by_email',
      description: 'POST /customers usa externalReference=email — se já existe Customer Asaas pro email, reusa.',
      assertCustomerReuse: (call) => call.method === 'GET' && call.path === '/customers' && call.query?.externalReference,
    },
    {
      id: 'webhook_replay_safe',
      description: 'asaasWebhook PAYMENT_CONFIRMED chega 2x → 1º cancela Stripe, 2º devolve replay=true.',
      assertWebhook: (events) => events[0].migration_completed === true && events[1].replay === true,
    },
  ],
};

export default migrationIdempotencyTests;