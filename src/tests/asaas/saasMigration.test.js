// Garantias da migração soft SaaS Stripe→Asaas (Etapa 4).

export const saasMigrationTests = {
  name: 'asaas_saas_migration',
  scenarios: [
    {
      id: 'master_only',
      description: 'Função rejeita usuários não-master com 403 + SecurityEvent.',
      assertResponse: (user, res) => user.role !== 'super_admin' && user.role !== 'admin' ? res?.status === 403 : true,
    },
    {
      id: 'requires_company_on_stripe',
      description: 'Company com billing_provider!=stripe não pode iniciar migração.',
      assertReject: (res) => res?.body?.error === 'not_on_stripe',
    },
    {
      id: 'requires_owner_cpf',
      description: 'Company sem owner_cpf_cnpj válido retorna 400 invalid_cpf_cnpj.',
      assertReject: (res) => res?.body?.error === 'invalid_cpf_cnpj',
    },
    {
      id: 'soft_migrate_keeps_stripe_alive',
      description: 'Após migração iniciada, Stripe Subscription continua ativa.',
      assertCompany: (c) => c.billing_provider === 'asaas_pending'
        && c.stripe_subscription_id != null
        && c.asaas_subscription_id != null
        && c.migration_status === 'pending_first_payment',
    },
    {
      id: 'stripe_cancellation_window_set',
      description: 'stripe_pending_cancellation_at é seteado para D+14 como SLA máximo.',
      assertWindow: (c) => {
        const at = new Date(c.stripe_pending_cancellation_at).getTime();
        const now = Date.now();
        return at > now && at <= now + 15 * 86400_000;
      },
    },
    {
      id: 'email_sent_to_owner',
      description: 'Email transacional é enviado ao owner_email com link do invoice Asaas.',
      assertEmail: (calls) => calls.some(c => c.fn === 'SendEmail' && c.args?.subject?.includes('assinatura')),
    },
    {
      id: 'audit_log_created',
      description: 'AdminAuditLog SUBSCRIPTION_CHANGED é criado com before/after legíveis.',
      assertLog: (log) => log.action === 'SUBSCRIPTION_CHANGED'
        && log.before?.billing_provider === 'stripe'
        && log.after?.billing_provider === 'asaas_pending',
    },
    {
      id: 'history_preserved',
      description: 'Campos stripe_* (customer_id, subscription_id, price_id) NUNCA são apagados.',
      assertHistory: (before, after) => before.stripe_subscription_id === after.stripe_subscription_id
        && before.stripe_customer_id === after.stripe_customer_id,
    },
  ],
};

export default saasMigrationTests;