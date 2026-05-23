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
| Etapa 2B | Bookings públicos PIX/cartão pelo Asaas (link público das barbearias) | ⏳ pendente |
| Etapa 2C | Assinatura de planos de clientes finais via Asaas | ⏳ pendente |
| Etapa 3 | Congelar Stripe na UI (somente leitura, botões ocultos) | ✅ entregue |
| Etapa 4 | Migrar assinaturas SaaS existentes para Asaas | ⏳ pendente |
| Etapa 5 | Desligamento final (remover env vars, libs, webhook, entidades, docs) | ⏳ pendente |

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