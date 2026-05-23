# Stripe — Registro de Desligamento (Etapa 5)

> Documento histórico. Lista exatamente o que foi removido do projeto na Etapa 5
> da migração Stripe → Asaas. Mantido para auditoria e em caso de necessidade de
> recuperação dos arquivos via histórico de versões.

## Data do desligamento
Etapa 5 executada em 2026-05-23.

## Pré-condições (gates G1-G5)
Ver `docs/ASAAS_CUTOVER_CHECKLIST.md`. Resumo:
- Todas as Companies em `billing_provider='asaas'` ou `not_migrated` com Stripe sub já cancelada manualmente.
- Webhook Asaas estável por 30+ dias.
- Backup completo da database confirmado.

## Backend functions deletadas

| Function | Responsabilidade | Substituto |
|----------|-----------------|------------|
| `createCheckoutSession` | Stripe Checkout para SaaS | `createAsaasSaasCheckout` |
| `createBookingPaymentIntent` | PIX/cartão booking via Stripe | `createAsaasBookingPayment` |
| `getBookingPaymentStatus` | Polling Stripe | `getAsaasBookingStatus` |
| `createCustomerPlanCheckout` | Plano cliente final Stripe Connect | `createAsaasCustomerPlanCheckout` |
| `createConnectOnboardingLink` | KYC Stripe Connect | `createAsaasSubaccount` |
| `createCustomerPortalSession` | Stripe Billing Portal | Link direto da fatura Asaas |
| `getConnectAccountStatus` | Status Connect account | `getAsaasSubaccountStatus` |
| `getCompanyConnectStatus` | Idem | `getAsaasSubaccountStatus` |
| `inspectStripeAccount` | Diagnóstico Stripe | n/a |
| `syncStripePixStatus` | Sync PIX capability | Webhook `ACCOUNT_STATUS_UPDATED` |
| `syncCustomerPlanToStripe` | Sync Plan→Stripe Product/Price | n/a (Asaas usa value direto) |
| `getStripePublishableKey` | Expor publishable key ao frontend | n/a |
| `stripeWebhook` | Handler de eventos Stripe | `asaasWebhook` |

## Frontend removido

- `components/billing/StripeConnectCard` — onboarding Stripe Connect
- `components/booking/CardPaymentBox` — Stripe Elements para cartão
- `components/master/StripeEnvMismatchBanner` — banner de mismatch live/test

## Frontend editado

- `pages/app/AppPagamentos` — removido import e uso do `StripeConnectCard`. Textos atualizados (Stripe → Asaas) no FAQ e nos cards de benefícios.
- `pages/app/AppAssinatura` — substituído botão "Gerenciar assinatura no portal Stripe" por "Abrir fatura Asaas" (link direto do `Company.asaas_payment_link_url`).
- `pages/Checkout` — comentário atualizado removendo referência à "Etapa 2 da migração" (agora completa).

## O que NÃO foi removido (intencional)

### Schema
Campos `stripe_*` nas entidades **Company**, **CustomerSubscription**, **Commission** permanecem como histórico read-only. Razão: auditoria fiscal, conciliação contábil, rastreabilidade de comissões pagas.

### Enum `AdminAuditLog.action`
Valores `STRIPE_CONNECTED`, `STRIPE_DISCONNECTED` ficam no enum — logs antigos referenciam.

### Pacotes npm
`@stripe/react-stripe-js`, `@stripe/stripe-js`, `stripe` permanecem em `package.json`. Sem código importando, ficam como peso-morto. Remover manualmente via `npm uninstall` quando conveniente:

```bash
npm uninstall @stripe/react-stripe-js @stripe/stripe-js stripe
```

### Secrets
`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ENVIRONMENT`, `STRIPE_FREEZE` permanecem na configuração. Sem código lendo, são inofensivos.

**Ação manual recomendada após 30 dias de estabilidade**: deletar no dashboard Base44.

### Webhook endpoint no Stripe Dashboard
Permanece configurado, mas como a function `stripeWebhook` não existe mais, qualquer evento retorna 404 — inofensivo. **Ação manual**: desativar o endpoint no Stripe Dashboard para parar tentativas de delivery.

## Verificações pós-cutover

```
# Buscar referências residuais a Stripe no código (devem ser apenas docs/schema/comments)
grep -ri "stripe" --include="*.js" --include="*.jsx" src/ | grep -v "test" | grep -v "stripe_"
```

Resultados aceitáveis:
- Strings em docs/legacy/.
- Campos `stripe_*` em entities (histórico).
- Comentários em código novo referenciando a migração.

Resultados inaceitáveis:
- `import` de `@stripe/*` em qualquer page/component ativo.
- Chamada `base44.functions.invoke('stripe*')`.

## Rollback de emergência

Se nos próximos 7 dias houver incidente que exija reativar Stripe:

1. Recuperar functions deletadas via histórico de versões do Base44.
2. Restaurar `components/billing/StripeConnectCard` e referências em `AppPagamentos`/`AppAssinatura`.
3. Confirmar que secrets `STRIPE_*` ainda estão setados.
4. Reativar endpoint webhook no Stripe Dashboard.

Após 7 dias sem incidentes, considerar o cutover irreversível e proceder com a limpeza manual de secrets/packages.