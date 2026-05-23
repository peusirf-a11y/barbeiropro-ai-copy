// Rollback de migração: cenários onde Asaas falha e o sistema precisa preservar
// o estado Stripe original sem deixar dados parciais.

export const rollbackMigrationTests = {
  name: 'asaas_rollback_migration',
  scenarios: [
    {
      id: 'asaas_customer_creation_fails',
      description: 'Se POST /customers falhar, Company.migration_status=failed; nenhum asaas_subscription_id é gravado.',
      assertRollback: (c) => c.migration_status === 'failed'
        && c.asaas_subscription_id == null
        && c.billing_provider === 'stripe',
    },
    {
      id: 'asaas_subscription_creation_fails',
      description: 'Se Customer criou mas Subscription falhar, asaas_customer_id pode persistir (idempotente) MAS migration_status=failed.',
      assertRollback: (c) => c.migration_status === 'failed'
        && c.asaas_subscription_id == null,
    },
    {
      id: 'retry_after_failed_state',
      description: 'Com migration_status=failed, Master pode tentar de novo — função aceita nova chamada e retoma fluxo.',
      assertCanRetry: (c) => c.migration_status === 'failed' || c.migration_status === 'not_migrated',
    },
    {
      id: 'audit_log_for_failures',
      description: 'AdminAuditLog severity=critical é criado em cada falha com error_code descritivo.',
      assertLog: (log) => log.severity === 'critical'
        && log.metadata?.error_code?.startsWith('asaas_'),
    },
    {
      id: 'no_email_on_failure',
      description: 'Quando migração falha antes do passo 6, nenhum email é enviado ao owner.',
      assertNoEmail: (calls) => !calls.some(c => c.fn === 'SendEmail'),
    },
    {
      id: 'stripe_intact_after_rollback',
      description: 'Após rollback, Stripe continua cobrando normalmente — webhook Stripe segue ativo.',
      assertStripeAlive: (c, stripeWebhookCalls) => c.stripe_subscription_id != null
        && stripeWebhookCalls.some(w => w.type === 'invoice.payment_succeeded'),
    },
  ],
};

export default rollbackMigrationTests;