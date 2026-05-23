# Migração Stripe → Asaas

> Plano incremental para substituir Stripe (Connect, Subscription, PaymentIntent, Webhooks)
> pelo Asaas, sem quebrar produção. Stripe e Asaas coexistem durante a transição via
> feature flag `Company.billing_provider`.

## Status atual

| Sprint | Escopo | Status |
|-------:|-------|--------|
| 1 | Infra base (secrets, lib/asaas, schema flag, smoke test) | ✅ entregue |
| 2 | PIX no link público de booking (piloto: Vintage) | ⏳ pendente |
| 3 | Assinaturas de planos do cliente final (CustomerSubscription) | ⏳ pendente |
| 4 | Billing SaaS (Starter/Pro/Enterprise) | ⏳ pendente |
| 5 | Webhook Asaas oficial + observabilidade | ⏳ pendente |
| 6 | Frontend (status, comprovantes, gestão de pagamentos) | ⏳ pendente |
| 7 | Migração de dados Stripe → Asaas | ⏳ pendente |
| 8 | Remoção do Stripe (após Sprint 7 validado) | ⏳ pendente |

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