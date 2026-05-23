// Garante que nenhuma Company é cobrada simultaneamente por Stripe E Asaas
// durante a janela de migração soft.

export const doubleChargeProtectionTests = {
  name: 'asaas_double_charge_protection',
  scenarios: [
    {
      id: 'stripe_only_during_pending',
      description: 'Durante billing_provider="asaas_pending", apenas Stripe cobra (Asaas só gera invoice mas não cobra na master ainda).',
      flow: ['migration_started', 'stripe_invoice_paid', 'asaas_first_invoice_pending'],
      assertActive: (c) => c.billing_provider === 'asaas_pending' && c.migration_status === 'pending_first_payment',
    },
    {
      id: 'stripe_cancel_only_after_asaas_confirm',
      description: 'Stripe SÓ é cancelado quando webhook Asaas recebe PAYMENT_RECEIVED/CONFIRMED.',
      assertOrder: (events) => {
        const idx1 = events.indexOf('asaas_payment_confirmed');
        const idx2 = events.indexOf('stripe_subscription_canceled');
        return idx1 >= 0 && idx2 > idx1;
      },
    },
    {
      id: 'asaas_failure_keeps_stripe',
      description: 'Se criar Asaas Subscription falhar, Company fica migration_status=failed mas Stripe NUNCA é tocado.',
      assertFailure: (c) => c.migration_status === 'failed'
        && c.billing_provider === 'stripe'
        && c.stripe_subscription_id != null,
    },
    {
      id: 'stripe_cancel_idempotent',
      description: 'Webhook duplicado não causa double-cancel — Stripe 404 é tratado como already_gone.',
      assertReplay: (webhookCall1, webhookCall2) => webhookCall2.outcome.replay === true,
    },
    {
      id: 'never_two_active_billing_providers',
      description: 'Nunca existe estado onde billing_provider!="asaas_pending" E stripe e asaas estão ambos cobrando.',
      assertInvariant: (c) => {
        const both = c.stripe_subscription_id && c.asaas_subscription_id;
        if (!both) return true;
        return c.billing_provider === 'asaas_pending' || c.migration_status === 'migrated';
      },
    },
  ],
};

export default doubleChargeProtectionTests;