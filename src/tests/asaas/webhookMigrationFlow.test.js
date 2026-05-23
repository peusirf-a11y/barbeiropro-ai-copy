// Fluxo end-to-end do webhook na migração: confirma o 1º pagamento Asaas,
// cancela Stripe atomicamente, marca Company como migrated.

export const webhookMigrationFlowTests = {
  name: 'asaas_webhook_migration_flow',
  scenarios: [
    {
      id: 'detects_migration_via_billing_provider',
      description: 'asaasWebhook detecta migração checando billing_provider="asaas_pending" + migration_status="pending_first_payment".',
      assertDetection: (company) => company.billing_provider === 'asaas_pending'
        && company.migration_status === 'pending_first_payment',
    },
    {
      id: 'updates_company_atomically',
      description: 'Um único Company.update seta billing_provider=asaas, migration_status=migrated, asaas_first_payment_confirmed_at e limpa stripe_pending_cancellation_at.',
      assertAfterUpdate: (c) => c.billing_provider === 'asaas'
        && c.migration_status === 'migrated'
        && c.asaas_first_payment_confirmed_at != null
        && c.stripe_pending_cancellation_at == null,
    },
    {
      id: 'cancels_stripe_via_api',
      description: 'cancelStripeAfterAsaasConfirmation chama DELETE /v1/subscriptions/{id} com STRIPE_SECRET_KEY.',
      assertStripeCall: (call) => call.method === 'DELETE'
        && call.url.includes('/v1/subscriptions/')
        && call.headers.Authorization?.startsWith('Bearer'),
    },
    {
      id: 'stripe_404_treated_as_success',
      description: 'Se Stripe devolver 404 (sub já cancelada), helper retorna ok=true reason=already_gone.',
      assertSuccess: (result) => result.ok === true && result.reason === 'already_gone',
    },
    {
      id: 'audit_log_subscription_cancelled',
      description: 'AdminAuditLog SUBSCRIPTION_CANCELLED é criado quando webhook completa migração.',
      assertLog: (log) => log.action === 'SUBSCRIPTION_CANCELLED'
        && log.metadata?.action_subtype === 'saas_migration_completed',
    },
    {
      id: 'non_migration_payment_unaffected',
      description: 'Pagamentos Asaas de Company que NÃO está em migração seguem o fluxo normal (status=active sem mexer em billing_provider).',
      assertNormalFlow: (c) => c.billing_provider === 'asaas' && !c.migration_status,
    },
    {
      id: 'stripe_cancel_failure_logged',
      description: 'Se cancelar Stripe falhar (5xx/network), migração ainda finaliza no Asaas; erro é logado para tratamento manual.',
      assertResilience: (c, stripeResult) => c.migration_status === 'migrated'
        && stripeResult.ok === false,
    },
  ],
};

export default webhookMigrationFlowTests;