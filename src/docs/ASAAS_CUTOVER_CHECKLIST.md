# Cutover Asaas — Checklist de Desligamento Stripe

> Pré-requisitos e ordem para a **Etapa 5** (desligamento definitivo do Stripe).
> Este checklist NÃO deve ser executado enquanto qualquer item estiver pendente.

## Gates obrigatórios

### G1 — Zero Companies cobrando via Stripe
```
COUNT(Company WHERE billing_provider='stripe') = 0
COUNT(Company WHERE billing_provider='asaas_pending') = 0
```
- Painel `/master/assinaturas` → filtro "Stripe ativo" + "Aguardando 1º pgto" precisam estar zerados.
- Companies em `failed` precisam ser resolvidas (re-migrar ou marcar como inativas).

### G2 — Stripe Dashboard limpo
- [ ] Nenhuma Stripe Subscription com status `active`, `trialing` ou `past_due`.
- [ ] Nenhuma Stripe PaymentIntent pendente.
- [ ] Stripe Connect Accounts ativas → confirmadas como histórico read-only.

### G3 — Período de estabilidade
- [ ] Mínimo **30 dias** sem incidente de cobrança Asaas após última migração.
- [ ] Mínimo **2 ciclos** completos de cobrança recorrente Asaas sem falha sistêmica.

### G4 — Backup e auditoria
- [ ] Export completo da Company (CSV) preservando todos os `stripe_*`.
- [ ] AdminAuditLog dos últimos 90 dias arquivado.
- [ ] PrivacyAuditLog idem.
- [ ] Snapshot das entidades CustomerSubscription com `stripe_*` populado.

### G5 — Comunicação interna
- [ ] Time de suporte avisado do cutover.
- [ ] Talking points para owners curiosos sobre o que aconteceu com a "conta Stripe".

## Ordem de desligamento (após gates verdes)

### 1. Frontend
- [ ] Remover `StripeConnectCard` de `pages/app/AppPagamentos`.
- [ ] Remover `getStripePublishableKey` invocations.
- [ ] Remover componentes `CardPaymentBox` (Stripe Elements) — manter `CardPaymentBoxAsaas`.
- [ ] Remover imports `@stripe/react-stripe-js`, `@stripe/stripe-js` do `package.json`.

### 2. Backend functions
Arquivar (não deletar — manter como histórico):
- [ ] `createCheckoutSession`
- [ ] `createBookingPaymentIntent`
- [ ] `createCustomerPlanCheckout`
- [ ] `createConnectOnboardingLink`
- [ ] `createCustomerPortalSession`
- [ ] `getConnectAccountStatus` / `getCompanyConnectStatus`
- [ ] `inspectStripeAccount`
- [ ] `syncStripePixStatus`
- [ ] `syncCustomerPlanToStripe`
- [ ] `getBookingPaymentStatus`
- [ ] `getStripePublishableKey`
- [ ] `stripeWebhook` ← último a desligar (após confirmar zero eventos chegando por 7 dias)

### 3. Secrets
- [ ] `STRIPE_FREEZE` (já não tem efeito útil)
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_ENVIRONMENT`

Recomendado: **manter por mais 30 dias após arquivar functions** caso precise reabrir alguma. Depois remover.

### 4. Stripe Dashboard
- [ ] Cancelar webhook endpoint do `stripeWebhook`.
- [ ] Desativar Stripe Connect platform.
- [ ] Marcar a conta Stripe como inativa (NÃO deletar — Stripe mantém histórico fiscal).

### 5. Schema (opcional, NÃO recomendado)
Os campos `stripe_*` na `Company` e `CustomerSubscription` são **histórico read-only**.
Manter para sempre. Apenas adicionar `description: "[legado pré-cutover Asaas]"` se quiser sinalizar.

### 6. Documentação
- [ ] Atualizar `ASAAS_MIGRATION.md` → Etapa 5 marcada como ✅ entregue com data.
- [ ] Atualizar `README` do projeto se houver menção a Stripe.
- [ ] Arquivar `STRIPE_PIX_CONNECT.md`, `STRIPE_TEST_WEBHOOK_SETUP.md` em pasta `docs/legacy/`.

## Sinais de que NÃO está pronto pra cutover

- ❌ Qualquer Company em `pending_first_payment` há mais de 14 dias.
- ❌ Webhook Asaas com taxa de falha > 1% nos últimos 7 dias.
- ❌ Reclamações de owners sobre cobrança duplicada nos últimos 30 dias.
- ❌ Algum fluxo de UI ainda chamando `createCheckoutSession` ou `createBookingPaymentIntent`.
- ❌ Logs do `stripeWebhook` mostrando eventos chegando regularmente.

## Plano de rollback do cutover (paranoia)

Após executar a Etapa 5, se algo der errado nos primeiros 7 dias:
1. Re-set `STRIPE_FREEZE=0` (reativa cobrança).
2. Restaurar functions arquivadas.
3. Setar `STRIPE_*` secrets de volta.
4. Reabrir webhook Stripe.

A reversibilidade só é garantida se G4 (backup) foi cumprido.

## Aprovação final

Cutover só executa com:
- ✅ Aprovação por escrito do owner do produto.
- ✅ Backup completo da database confirmado.
- ✅ Janela de manutenção comunicada (não obrigatória — operação é não-disruptiva — mas recomendada).