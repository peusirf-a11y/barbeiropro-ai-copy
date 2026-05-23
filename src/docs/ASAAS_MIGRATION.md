# Migração Stripe → Asaas

> Plano incremental para substituir Stripe (Connect, Subscription, PaymentIntent, Webhooks)
> pelo Asaas, sem quebrar produção. Stripe e Asaas coexistem durante a transição via
> feature flag `Company.billing_provider`.

## Status atual

| Sprint | Escopo | Status |
|-------:|-------|--------|
| 1 | Infra base (secrets, lib/asaas, schema flag, smoke test) | ✅ entregue |
| Etapa 1 | Congelar criação Stripe (PaymentIntent, Checkout, PlanCheckout, Connect onboarding) | ✅ entregue |
| Etapa 2A | Assinatura SaaS (Starter/Pro/Enterprise) via Asaas + webhook | ✅ entregue |
| Etapa 2B | Bookings públicos PIX pelo Asaas (link público das barbearias) | ✅ entregue |
| Etapa 2B+ | Cartão (hosted Asaas) no link público com split automático | ✅ entregue |
| Etapa 2C | Assinatura de planos de clientes finais via Asaas (cartão recorrente) | ✅ entregue |
| Etapa 2C+ | Split automático Asaas (subaccount por barbearia, planos + bookings PIX) | ✅ entregue |
| Etapa 3 | Congelar Stripe na UI (somente leitura, botões ocultos) | ✅ entregue |
| Etapa 4 | Migrar assinaturas SaaS existentes para Asaas (soft migrate) | ✅ entregue |
| Etapa 5 | Desligamento final (functions Stripe removidas, UI Stripe removida) | ✅ entregue |

## Decisões arquiteturais

- **Recebimento dos clientes finais**: todos os pagamentos do link público caem na
  conta master Asaas da O CORTE (`ASAAS_WALLET_ID`). Repasse à barbearia será
  manual no início (Sprint 2). Split automático fica para fase posterior.
- **Billing SaaS**: assinaturas Starter/Pro/Enterprise migram para `Asaas Subscription`
  recorrente (PIX/boleto/cartão). Stripe continua ativo até Sprint 4 validada.
- **Feature flag**: `Company.billing_provider` (`stripe` | `asaas`, default `stripe`).
  Todo código novo respeita a flag antes de chamar gateway.
- **Sandbox first**: `ASAAS_ENVIRONMENT=sandbox` durante toda a migração. Troca
  para `production` só na Sprint 7 com aprovação explícita.

## Sprint 1 — Entregues nesta janela

### Secrets
- `ASAAS_API_KEY` — chave da API (sandbox ou prod)
- `ASAAS_WALLET_ID` — wallet master da plataforma
- `ASAAS_ENVIRONMENT` — `sandbox` | `production`
- `ASAAS_BASE_URL` — opcional, derivado do environment se vazio
- `ASAAS_WEBHOOK_TOKEN` — usado pela Sprint 5

### Bibliotecas (`lib/asaas/`)
- `config.js` — leitura de env + mascaramento da chave
- `errors.js` — `AsaasError` + `AsaasErrorCodes`
- `sanitize.js` — CPF/telefone/email normalize + scrub de payload pra log
- `client.js` — HTTP client com retry exponencial, timeout, correlation_id,
  idempotency key, logs estruturados

### Schema
- `Company.billing_provider` (default `stripe`) — feature flag
- `Company.asaas_customer_id`
- `Company.asaas_account_status`
- `Company.asaas_pix_enabled`

Campos Stripe (`stripe_customer_id`, `stripe_connect_*`, etc.) permanecem
intocados — convivência durante a migração.

### Função de validação
- `asaasPing` — super admin only. Faz `GET /finance/balance` no Asaas
  configurado e retorna ok/erro + latência + correlation_id. Use para validar
  que a chave funciona antes da Sprint 2.

## Etapa 1+3 — Congelamento (entregue)

### Backend (guard early-return)
As 4 funções de criação de fluxo Stripe agora retornam `503 stripe_freeze_active` antes de qualquer chamada Stripe:
- `createBookingPaymentIntent` — PIX/cartão no link público
- `createCheckoutSession` — assinatura SaaS (Starter/Pro/Enterprise)
- `createCustomerPlanCheckout` — assinatura de plano do cliente final
- `createConnectOnboardingLink` — KYC Stripe Connect

Mantidas intactas (read-only / legado):
- `stripeWebhook` — continua processando eventos de pagamentos já em andamento
- `getCompanyConnectStatus`, `getConnectAccountStatus`, `inspectStripeAccount` — leitura de status
- `syncStripePixStatus`, `syncCustomerPlanToStripe` — reconciliação legada
- `createCustomerPortalSession` — cliente acessa portal do Stripe (gerenciamento)

### Reversibilidade (kill-switch)
Default: congelado. Para reativar (emergência), setar secret `STRIPE_FREEZE=0`.

### Frontend (UI)
- `StripeConnectCard` — esconde botões "Conectar Stripe", "Continuar cadastro", banners de ação. Mantém leitura de status para contas já conectadas. Mostra banner "Migração em andamento".
- `BookingPaymentStep` e `PaymentMethodChooser` — não tocados. Quando o cliente final tentar pagar, o backend retorna `stripe_freeze_active` e a mensagem amigável já é exibida pelo handler de erro existente.

## Etapa 5 — Desligamento final (entregue)

### O que foi removido

**Backend functions arquivadas** (deletadas):
- `createCheckoutSession` (assinatura SaaS Stripe)
- `createBookingPaymentIntent` (PIX/cartão booking via Stripe)
- `getBookingPaymentStatus` (polling Stripe)
- `createCustomerPlanCheckout` (plano do cliente final via Stripe Connect)
- `createConnectOnboardingLink` (KYC Stripe Connect)
- `createCustomerPortalSession` (portal Billing Stripe)
- `getConnectAccountStatus` / `getCompanyConnectStatus`
- `inspectStripeAccount`
- `syncStripePixStatus`
- `syncCustomerPlanToStripe`
- `getStripePublishableKey`
- `stripeWebhook` (handler de eventos Stripe)

**Frontend removido**:
- `components/billing/StripeConnectCard`
- `components/booking/CardPaymentBox` (Stripe Elements)
- `components/master/StripeEnvMismatchBanner`
- `pages/app/AppPagamentos` — import e uso do StripeConnectCard, textos Stripe→Asaas
- `pages/app/AppAssinatura` — substitui Stripe Customer Portal por link da fatura Asaas
- `pages/Checkout` — comentários atualizados

**Docs arquivadas**:
- `docs/STRIPE_PIX_CONNECT.md` (removido)
- `docs/STRIPE_TEST_WEBHOOK_SETUP.md` (removido)
- `docs/legacy/STRIPE_DECOMMISSION.md` (NOVO — registro histórico do desligamento)

### O que foi mantido (de propósito)

**Schema (campos `stripe_*` ficam como histórico read-only)**:
- `Company.stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `stripe_connect_*` — preserva auditoria/contabilidade de companies que passaram pelo Stripe.
- `CustomerSubscription.stripe_subscription_id`, `stripe_customer_id` — idem.
- `Commission.stripe_invoice_id`, `stripe_subscription_id` — histórico de comissões Stripe pagas.
- Constante `STRIPE_*` action no enum `AdminAuditLog.action` — histórico.

**Pacotes npm** (`@stripe/react-stripe-js`, `@stripe/stripe-js`, `stripe`):
- Não há ferramenta de remoção automática do package.json. Permanecem como peso-morto.
- Ação manual: rodar `npm uninstall @stripe/react-stripe-js @stripe/stripe-js` quando conveniente.

**Secrets** (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ENVIRONMENT`, `STRIPE_FREEZE`):
- Não há ferramenta de remoção automática. Sem código lendo, ficam inócuos.
- Ação manual recomendada após 30 dias: deletar no dashboard.

**Webhook endpoint no Stripe**:
- Ação manual no dashboard Stripe: desativar o endpoint do `stripeWebhook` (a function não existe mais, então eventos retornariam 404 — inofensivo, mas é boa prática desligar).

### Garantias do cutover

- Nenhum código de produção lê/escreve no Stripe.
- Companies migradas (`billing_provider='asaas'`) continuam funcionando normalmente.
- Companies não migradas (se existir alguma esquecida) param de receber cobrança Stripe — webhook foi deletado. Master precisa migrar ou cancelar manualmente.
- Histórico fiscal Stripe está 100% preservado em fields `stripe_*` da database.

### Rollback (em emergência, primeiros 7 dias)

Ver `docs/ASAAS_CUTOVER_CHECKLIST.md` seção "Plano de rollback do cutover".

---

## Etapa 4 — Soft migrate de assinaturas SaaS Stripe → Asaas (entregue)

### Estratégia
Soft migrate — Stripe **não** é cancelado na criação. Master dispara migração por Company; backend cria Customer+Subscription Asaas em paralelo. Stripe segue cobrando até o webhook Asaas confirmar o 1º `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED`. Só ali o Stripe é cancelado.

### Schema (aditivo)
- `Company.migration_status` enum `not_migrated|pending_first_payment|migrated|failed`.
- `Company.stripe_pending_cancellation_at` — SLA máximo de coexistência (D+14).
- `Company.asaas_migration_started_at` — timestamp de início.
- `Company.asaas_first_payment_confirmed_at` — gatilho do cancelamento Stripe.
- `Company.billing_provider` ganhou enum extra `'asaas_pending'`.

Campos `stripe_*` continuam intactos como histórico read-only.

### Backend
- `migrateCompanySaasToAsaas` (NOVA, master-only):
  - Valida `billing_provider='stripe'`, plano conhecido, CPF/CNPJ do owner.
  - Idempotente: chamadas repetidas devolvem o estado atual (`replay=true`).
  - Cria Customer Asaas (externalReference=email) e Subscription mensal (`mig_sub:{company_id}:{plan}` como idempotency key).
  - Persiste `asaas_*` + `migration_status='pending_first_payment'` + `billing_provider='asaas_pending'`.
  - **NUNCA** cancela Stripe.
  - Envia email transacional via `SendEmail` (opt-out via `send_email=false`).
  - AuditLog `SUBSCRIPTION_CHANGED` severity=warning; SecurityEvent em tentativas não-master.
- `asaasWebhook` (edit): no handler de `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`, detecta se a Company está em migração (`billing_provider='asaas_pending'` + `migration_status='pending_first_payment'`). Se sim, marca como `migrated` e chama `cancelStripeAfterAsaasConfirmation`.
- `cancelStripeAfterAsaasConfirmation` (helper interno do webhook): `DELETE /v1/subscriptions/{id}` no Stripe. Trata 404 como idempotente. Logs em audit.

### Frontend (Master)
- `pages/master/MasterAssinaturas` renderiza painel novo abaixo do `PlansManager`.
- `components/master/MigrationStripeAsaasPanel` (NOVO): KPIs por status, busca/filtro, tabela expandível, botão "Migrar agora" com confirmação, leitura completa de campos da Company (Stripe + Asaas + timestamps).

### Testes (conceituais)
- `tests/asaas/saasMigration.test.js` — garantias do happy path.
- `tests/asaas/doubleChargeProtection.test.js` — nunca cobra Stripe E Asaas no mesmo ciclo.
- `tests/asaas/rollbackMigration.test.js` — falha Asaas não toca Stripe.
- `tests/asaas/migrationIdempotency.test.js` — replay seguro em retry.
- `tests/asaas/webhookMigrationFlow.test.js` — cancelamento Stripe após 1º pgto.

### Docs
- `docs/SAAS_MIGRATION_PLAYBOOK.md` (NOVO) — guia operacional do Master.
- `docs/ASAAS_CUTOVER_CHECKLIST.md` (NOVO) — gates antes de executar Etapa 5.

### Observabilidade
- Logs estruturados com `corrId`, `latency_ms`, `company_id` em todas as chamadas.
- AuditLog em início (warning), falha (critical) e conclusão (info).
- SecurityEvent em tentativas não-master.

### Reversibilidade
- `migration_status='pending_first_payment'`: cancelar Asaas Subscription no painel Asaas + setar `Company.billing_provider='stripe'` + `migration_status=null`. Stripe segue cobrando.
- `migration_status='failed'`: botão "Migrar agora" pode ser clicado novamente — idempotente.
- `migration_status='migrated'`: sem rollback automático (Stripe já foi cancelado). Para reverter: criar Stripe Subscription nova manualmente.

---

## Etapa 2B+ — Cartão no booking público via hosted Asaas (entregue)

### Decisões
- **Hosted invoice** para cartão: redirecionamos o cliente para o `invoiceUrl` do Asaas. Nunca tocamos em PAN/CVV. PCI compliance fica 100% com o Asaas, 3DS automático.
- **Boleto fora**: vencimento (1-3 dias úteis) é incompatível com a janela de 15 min do slot lock. Boleto fica disponível só em assinaturas (Etapa 2A/2C).
- **Mesma flag**: `Company.asaas_pix_enabled=true` libera PIX **e** cartão. Sem toggle separado — quem ativou subaccount já recebe ambos.
- **Split reusado**: payload de Payment inclui `split: [{ walletId, percentualValue }]` quando `asaas_subaccount_status='active'` (parity com Etapa 2C+). Funciona igual para PIX e CREDIT_CARD.

### Backend
- `createAsaasBookingPayment`:
  - Aceita `payment_method: 'pix' | 'card'` (case-insensitive). Default `pix`.
  - Para `card`, `billingType='CREDIT_CARD'`, retorna `asaas_invoice_url`.
  - Idempotency key inclui método: `bk_pay:<appointment_id>:<method>` — permite troca de método no mesmo slot sem colidir.
  - Rollback completo se Asaas falhar (appointment cancelado + slot liberado).
  - Logs estruturados com `rid`, `appt`, `method`, `split`.
- `asaasWebhook`: nenhuma mudança — branch `booking:` já trata qualquer `billingType`.
- `getAsaasBookingStatus`: nenhuma mudança — funciona para PIX e cartão.

### Frontend
- `BookingPaymentStep`: reativa opção Cartão na escolha. Quando `method='card'`, devolve para o stage `'card'` (em vez de `'pix'`).
- `CardPaymentBoxAsaas` (novo): card minimalista, botão "Pagar com cartão" → abre `invoiceUrl` em nova aba, polling 4s contra `getAsaasBookingStatus` para detectar confirmação. Botão "Já paguei, verificar" para reset manual.
- Mantido fallback resiliente: webhook é fonte da verdade; popup fechado sem pagar não cancela, só para o polling visual.

### Testes (conceituais)
- `tests/asaas/bookingCardPayment.test.js` — PAN/CVV intocados, idempotência por método, rollback Asaas, tenant isolation.
- `tests/asaas/splitIntegrity.test.js` — split só com subaccount aprovada, parity entre PIX e cartão.
- `tests/publicBooking/paymentMethods.test.js` — métodos aceitos/recusados, default, rate limit.

### Docs
- `docs/PUBLIC_BOOKING_PAYMENTS.md` (novo): fluxo end-to-end + guarantees.

### Rollback
Remover a opção "Cartão" do `BookingPaymentStep` mantém o backend funcional (apenas oculto). Para desligar 100%: validação `methodNorm !== 'pix'` no backend devolve 400. Nenhum dado é perdido.

---

## Etapa 2C+ — Split automático via subaccount Asaas (entregue)

### Decisões arquiteturais
- **Subaccount com KYC**: cada barbearia ganha uma conta-filha (Account White Label) sob a master O CORTE. Asaas faz KYC e aprova antes de liberar split.
- **Criação sob demanda**: botão explícito em `/app/configuracoes/pagamentos`. Não tocamos no onboarding.
- **Split 100%** para a barbearia por default (campo `Company.asaas_split_percentage` configurável pelo Master). O CORTE monetiza apenas a mensalidade SaaS.
- **Aplicado em**: planos do cliente final (Etapa 2C) **e** bookings PIX (Etapa 2B). Sem subaccount aprovada → fallback: tudo cai na master + repasse manual.

### Backend (novas funções)
- `createAsaasSubaccount` (admin/owner) — `POST /accounts` no Asaas. Persiste `asaas_subaccount_id`, `asaas_subaccount_wallet_id`, `asaas_subaccount_status='pending'`, `asaas_subaccount_onboarding_url`. **Idempotente por Company** (se já existe `asaas_subaccount_id`, devolve estado atual sem recriar). **Tenant isolation**: rejeita 403 + emite `SecurityEvent` quando user não é owner/admin. **Audit**: `AdminAuditLog action='STRIPE_CONNECTED'` (categoria genérica de billing). Também seta `asaas_pix_enabled=true` automaticamente.
- `getAsaasSubaccountStatus` (admin/owner) — leitura do estado salvo na Company. Com `force_check=true`, consulta `GET /accounts/{id}` no Asaas e atualiza local se status mudou. Devolve `{ connected, status, wallet_id, onboarding_url, split_percentage, pix_enabled }`.

### Backend (edits)
- `asaasWebhook` — adicionado handler `ACCOUNT_STATUS_UPDATED`. Mapeia `APPROVED|ACTIVE → active`, `REJECTED|BLOCKED|DISABLED → rejected`, demais → `pending`. Idempotente (replay devolve `{ replay: true }`). Audit log automático na transição.
- `createAsaasBookingPayment` — injeta `split: [{ walletId, percentualValue }]` no body do Payment quando `Company.asaas_subaccount_wallet_id` E `asaas_subaccount_status==='active'`. Sem isso → cobrança continua caindo na master (fallback seguro).
- `createAsaasCustomerPlanCheckout` — já tinha o split implementado (Etapa 2C), agora ativa naturalmente quando a barbearia aprova o KYC.

### Schema
- `Company.asaas_subaccount_wallet_id` (novo) — walletId usado no payload split.
- `Company.asaas_subaccount_status` enum `pending|active|rejected` (novo).
- `Company.asaas_subaccount_api_key_preview` (novo) — últimos 8 chars da apiKey emitida pelo Asaas, apenas para diagnóstico. Chave completa nunca é persistida.
- `Company.asaas_subaccount_onboarding_url` (novo) — link Asaas para completar pendências.

### Frontend
- `components/billing/AsaasSplitCard` (novo) — 4 estados visuais: sem conta (form ativação), pending (banner + link onboarding), active (banner + mini-stats), rejected (banner suporte).
- `pages/app/AppPagamentos` — renderiza `AsaasSplitCard` antes do `StripeConnectCard` (que continua read-only durante o freeze).

### Observabilidade
- Logs estruturados com `corrId`, `latency_ms`, `company_id` em todas as funções novas.
- `SecurityEvent` em tentativas cross-tenant (`createAsaasSubaccount`) e em erros 4xx do Asaas (`suspicious_payload`).
- `AdminAuditLog` em criação de subaccount e transição de status via webhook.

### Configuração do webhook Asaas
No painel master Asaas, marcar também o evento:
- `ACCOUNT_STATUS_UPDATED` (transição de KYC das subaccounts criadas pela API).
A URL e o token são os mesmos já configurados na Etapa 2A.

### Rollback seguro
- **Para uma barbearia específica**: limpar `asaas_subaccount_wallet_id` (ou setar `asaas_subaccount_status` para qualquer valor diferente de `'active'`). O backend volta a cobrar 100% na master automaticamente. A subaccount fica preservada no Asaas para reativação futura.
- **Plataforma inteira**: a função `createAsaasSubaccount` pode ser archivada (frontend exibe form de ativação, mas chamada retorna 404). Companies já com subaccount continuam recebendo split normalmente — nenhuma mudança destrutiva.

### Testes manuais (sandbox)
1. Logado como owner de uma Company, abrir `/app/configuracoes/pagamentos`.
2. Preencher CPF (use um CPF de teste válido), endereço, número.
3. Clicar em "Ativar pagamento online" → cria subaccount sandbox.
4. `Company.asaas_subaccount_status='pending'`, banner amarelo aparece.
5. No painel Asaas sandbox master, localizar a subaccount e aprovar manualmente.
6. Clicar em "Atualizar status" no card → `force_check=true` busca o Asaas e move para `active`.
7. Criar um booking PIX a partir do link público: o Payment Asaas deve ter `split` com a walletId.

## Etapa 2C — Assinatura de planos do cliente final via Asaas (entregue)

### Backend
- `createAsaasCustomerPlanCheckout` (NOVA) — substitui `createCustomerPlanCheckout`.
  - Auth via `Customer.auth_token`.
  - Anti-duplicidade (active/pending/paused) com suporte a "retomar pagamento" (resume de `pending_payment` do mesmo plano).
  - Gate de visibilidade (public/private/invite_only) com `SecurityEvent` em tentativas não autorizadas.
  - Cria/recupera Customer Asaas idempotente por `externalReference=cust:<company_id>:<customer_id>`.
  - Cria `Subscription` Asaas `CREDIT_CARD` `MONTHLY` com `value=plan.price_monthly`, `externalReference=customerPlan:<sub_id>`.
  - Busca primeira invoice (`GET /payments?subscription=...`) e devolve `invoiceUrl` para o frontend redirecionar.
  - **Preparado para split:** se `Company.asaas_subaccount_id` estiver setado, inclui `split: [{ walletId, percentualValue }]` automaticamente. Sem subaccount = recebimento centralizado na conta master, repasse manual.
- `asaasWebhook` (op novo) — branch `externalReference.startsWith('customerPlan:')`.
  - `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → `status='active'`, `last_payment_status='pago'`, `last_payment_at=now`, reseta `current_cycle_*` e `uses_remaining` (preserva ciclo mensal).
  - Idempotente: replay devolve `{ replay: true }`.
  - `PAYMENT_OVERDUE` → `last_payment_status='atrasado'` (já era tratado para SaaS, agora reaproveitado).
  - `SUBSCRIPTION_DELETED` → `status='canceled'`.

### Schema
- `CustomerSubscription.asaas_subscription_id`, `asaas_customer_id`, `asaas_invoice_url` (novos).
- `Company.asaas_subaccount_id`, `asaas_split_percentage` (novos, opcionais — preparam Etapa 2C+).

### Frontend
- `pages/public/CustomerPlans.jsx` — invoca `createAsaasCustomerPlanCheckout`. Removido o gate `plan.stripe_price_id` (Asaas não precisa de Price pré-criado).

### O que NUNCA é chamado mais (em fluxos novos)
- `createCustomerPlanCheckout` (Stripe) — fica como legado read-only até Etapa 5.
- `syncCustomerPlanToStripe` — automation segue ativa mas inofensiva (Plano sem `stripe_connect_account_id` da empresa é ignorado naturalmente). Não desligar ainda para não quebrar barbearias que ainda usam Stripe legado.

### Como testar (sandbox)
1. Cliente logado em `/cliente/:slug` (precisa ter `cpf_cnpj` cadastrado no Customer, ou o checkout retorna 400 `cpf_required`).
2. Acessar `/cliente/:slug/planos`, clicar em "Assinar este plano".
3. Backend cria Customer + Subscription no Asaas sandbox → redireciona para `invoiceUrl`.
4. Preencher cartão de teste no painel Asaas.
5. Webhook `PAYMENT_CONFIRMED` → `CustomerSubscription.status='active'` + `last_payment_status='pago'`.

### Pré-requisito do cliente
O `Customer` precisa ter `cpf_cnpj` preenchido. Se ausente, o checkout retorna erro amigável. A coleta desse campo no fluxo de cadastro/login do cliente fica como tarefa de UX (não bloqueia esta etapa).

### Rollback
Reverter o op do `pages/public/CustomerPlans` para chamar `createCustomerPlanCheckout` + setar `STRIPE_FREEZE=0`. A função Asaas e os campos novos permanecem sem efeito.

## Etapa 2B — Bookings públicos PIX via Asaas (entregue)

### Backend (novas funções)
- `createAsaasBookingPayment` (PÚBLICA, sem auth) — substitui `createBookingPaymentIntent`.
  - Espelha todos os guards do original: rate limit IP+telefone, slot lock atômico, idempotência Base44, validação autoritativa de service/professional/bloqueios, reuse de tentativa anterior do mesmo telefone.
  - Cria Customer Asaas com `externalReference=cust:<company_id>:<customer_id>` (idempotente).
  - Cria Payment PIX com `dueDate=hoje`, `externalReference=booking:<appointment_id>`.
  - Busca QR via `GET /payments/{id}/pixQrCode` e devolve `qr_code_url` (data URL) + `copy_paste`.
  - Guard: requer `Company.asaas_pix_enabled=true` (substitui o check Stripe Connect).
- `getAsaasBookingStatus` (PÚBLICA) — substitui `getBookingPaymentStatus`.
  - Lê Appointment local. Com `force_check=true` consulta `/payments/{id}` no Asaas e marca `paid_online` se status ∈ {CONFIRMED, RECEIVED, RECEIVED_IN_CASH}.

### Backend (webhook)
- `asaasWebhook` ganhou branch para `externalReference.startsWith('booking:')`.
  - PAYMENT_CONFIRMED/RECEIVED → atualiza Appointment para `status='agendado'`, `payment_status='succeeded'`, `paid_online=true`, `paid=true`, `paid_at`.
  - Idempotente: se já estava `succeeded`, retorna `replay`.

### Frontend
- `BookingPaymentStep` — invoca `createAsaasBookingPayment`; UI reduzida a PIX (cartão oculto durante a migração); lê `data.pix` em vez de `client_secret`.
- `PixPaymentBox` — polling chama `getAsaasBookingStatus`.

### Como habilitar uma barbearia para receber PIX via Asaas
Na Company do tenant, setar `asaas_pix_enabled=true` (campo já existe no schema). Não requer onboarding/KYC adicional — todo o recebimento cai na conta master Asaas da O CORTE. **Repasse à barbearia é manual nesta fase** (split automático entra em Etapa 2B+).

### Rollback
Reverter os 2 ops de `BookingPaymentStep` e o op de `PixPaymentBox` para voltar a chamar `createBookingPaymentIntent` + `getBookingPaymentStatus`. Setar `STRIPE_FREEZE=0`. As novas funions ficam ociosas, sem impacto.

## Etapa 2A — Assinatura SaaS via Asaas (entregue)

### Backend
- `createAsaasSaasCheckout` (NOVA) — substitui o `createCheckoutSession` do Stripe.
  - Recebe `plan` (`starter|pro|enterprise`) + dados da empresa + `cpf_cnpj` (obrigatório Asaas) + `payment_method` opcional (PIX/BOLETO/CREDIT_CARD/UNDEFINED).
  - Cria/recupera Customer Asaas (idempotência via externalReference=email).
  - Cria Subscription mensal com `nextDueDate = hoje + 7 dias` (cobre trial).
  - Cria/atualiza Company local com `billing_provider='asaas'`, `subscription_status='trialing'`, `asaas_customer_id`, `asaas_subscription_id`, `asaas_payment_link_url`.
  - Atribui referral via `partnerAttribute` quando vem do programa de parceiros.
- `asaasWebhook` (NOVA) — recebe eventos do Asaas com idempotência (`IdempotencyKey`).
  - Auth: header `asaas-access-token` validado constant-time contra `ASAAS_WEBHOOK_TOKEN`.
  - Eventos tratados: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`, `SUBSCRIPTION_DELETED`.
  - Resolve a Company pelo `asaas_subscription_id` (fallback: `asaas_customer_id`) e atualiza `subscription_status` + `is_blocked_by_billing`.
- `getAsaasSaasStatus` (NOVA) — polling fallback para a tela CheckoutSuccess.

### Schema
- `Company.billing_provider` agora tem default `'asaas'` (novas empresas).
- `Company.asaas_subscription_id`, `Company.asaas_payment_link_url`, `Company.owner_cpf_cnpj` adicionados.

### Frontend
- `pages/Checkout.jsx` — chama `createAsaasSaasCheckout`, exige CPF/CNPJ no formulário, redireciona para `invoiceUrl` do Asaas (cliente escolhe PIX/Boleto/Cartão lá). Texto "via Stripe" → "via Asaas".

### Webhook do Asaas — configuração manual
No painel Asaas (Configurações → Integrações → Webhooks):
1. URL: `https://<seu-dominio>/api/functions/asaasWebhook`
2. Eventos: marcar `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`, `SUBSCRIPTION_DELETED`.
3. Token de autenticação: colar o valor de `ASAAS_WEBHOOK_TOKEN` (mesmo secret).
4. Versionar API: v3.
5. Salvar e disparar evento de teste — deve retornar 200 OK.

### Testes manuais (sandbox)
1. Acessar `/checkout?plano=starter`, preencher form + CPF, submeter.
2. Verificar logs do `createAsaasSaasCheckout` → deve mostrar `customer ok`, `subscription ok`.
3. Confirmar em `Company.filter({ owner_email })` que `asaas_subscription_id` foi gravado e `subscription_status='trialing'`.
4. Simular pagamento no painel Asaas (sandbox) ou enviar webhook manualmente via curl com o token correto.
5. Webhook `PAYMENT_CONFIRMED` deve mover a Company para `subscription_status='active'` e `is_blocked_by_billing=false`.

### Rollback
Reverter Frontend (`pages/Checkout.jsx`) para chamar `createCheckoutSession` + setar `STRIPE_FREEZE=0`. Os campos Asaas no schema são aditivos — podem ficar.

## Como testar agora

1. No painel Master, qualquer admin com TOTP pode chamar `asaasPing` via
   ferramenta de teste de funções.
2. Resposta esperada (sandbox saudável):
   ```json
   {
     "ok": true,
     "environment": "sandbox",
     "base_url": "https://api-sandbox.asaas.com/v3",
     "api_key_preview": "$aact_hmlg_…7bb1",
     "latency_ms": 280,
     "balance_present": true
   }
   ```
3. Resposta de erro mais comum:
   - `asaas_unauthorized` (401) → chave inválida/revogada
   - `asaas_not_configured` (503) → secret faltando

## Rollback

Sprint 1 é puramente aditiva. Para desfazer:
1. Apagar `lib/asaas/`, `functions/asaasPing.js`, doc.
2. Remover os 4 campos novos do `Company.json`.
3. (Opcional) Remover os 5 secrets.

Nenhum fluxo Stripe é afetado.