# Stripe PIX em Stripe Connect Express — Arquitetura O CORTE

> **TL;DR:** O Stripe **não permite** ativar a capability `pix_payments` via API para contas Express brasileiras. O fluxo correto é: a barbearia ativa PIX **1 vez** no Stripe Express Dashboard, o O CORTE **detecta automaticamente** via API/webhook e habilita PIX nos checkouts. Não há "ativação automática" — há **detecção automática**.

---

## 1. Limitação oficial do Stripe (BR + Express)

Para contas **Stripe Connect Express com country=BR**:

- ❌ `stripe.accounts.update({ capabilities: { pix_payments: { requested: true } } })` retorna erro.
- ❌ `payments_settings.payment_method_types` **não existe** na API Stripe.
- ✅ O dono da conta Express precisa ativar PIX **manualmente** no painel Stripe Express:
  - Login: https://connect.stripe.com/express_login
  - **Configurações → Métodos de pagamento → Ativar PIX**
  - Stripe valida CPF/CNPJ + dados bancários do MEI/PJ antes de ativar.

Esse fluxo existe por exigência regulatória brasileira (KYC para PIX). O Stripe não pode automatizar.

> **O que o SaaS pode fazer:** detectar a capability `pix_payments === 'active'` na conta Connect, refletir o status no banco e habilitar PIX nos pagamentos automaticamente.

---

## 2. Arquitetura no O CORTE

```
┌─────────────────────────┐
│ Barbearia (dono)        │
│  1. Onboarding Connect  │
│  2. Ativa PIX no Stripe │ ─────────────┐
└─────────────────────────┘              │
                                         ▼
                              ┌────────────────────────┐
                              │ Stripe                 │
                              │  capability pix=active │
                              └────────────┬───────────┘
                                           │
                          ┌────────────────┴───────────────┐
                          │                                │
                          ▼ webhook account.updated        ▼ explicit sync
              ┌──────────────────────┐        ┌─────────────────────────┐
              │ functions/           │        │ functions/              │
              │ stripeWebhook        │        │ syncStripePixStatus     │
              │ (auto, idempotente)  │        │ (manual + auditável)    │
              └─────────┬────────────┘        └────────────┬────────────┘
                        │                                  │
                        └────────────────┬─────────────────┘
                                         ▼
                         Company.stripe_connect_pix_enabled = true
                                         │
                                         ▼
              ┌───────────────────────────────────────────────────┐
              │ createBookingPaymentIntent / checkout público     │
              │   if (company.stripe_connect_pix_enabled)         │
              │     payment_method_types = ['pix']                │
              │   else                                            │
              │     payment_method_types = ['card']  (fallback)   │
              └───────────────────────────────────────────────────┘
```

---

## 3. Componentes

### 3.1 `functions/createConnectOnboardingLink`
Cria a conta Connect Express (BR). **NÃO** solicita `pix_payments` (não é requestable). Solicita apenas `card_payments` e `transfers`. Valida e limpa accounts órfãs automaticamente.

### 3.2 `functions/stripeWebhook` — handler `account.updated`
Quando o dono altera qualquer configuração da conta no Stripe Express (incluindo ativar PIX), o Stripe envia `account.updated`. O webhook:

1. Verifica assinatura contra `STRIPE_WEBHOOK_SECRET` e `STRIPE_WEBHOOK_SECRET_CONNECT`.
2. Deduplica por `event.id` via `IdempotencyKey` (TTL 7 dias).
3. Lê `account.capabilities.pix_payments` e atualiza `Company.stripe_connect_pix_enabled`.

### 3.3 `functions/syncStripePixStatus` (sync explícito)
Endpoint autenticado para o dono forçar o re-sync (botão "Atualizar status"):

- Valida tenant ownership (owner OR admin do team).
- Faz `stripe.accounts.retrieve` e atualiza Company.
- Registra `AuditLog` apenas em **transição** (off→on ou on→off) — evita poluir log.
- Emite `SecurityEvent` em falhas (account órfã, cross-tenant).
- **Nunca expõe `error.message` do Stripe ao cliente** — códigos opacos.

### 3.4 `functions/getConnectAccountStatus` (sync silencioso)
Sync silencioso (sem AuditLog) usado pelo polling do `StripeConnectCard`. Útil para refresh frequente sem ruído de auditoria.

### 3.5 `functions/getCompanyConnectStatus` (público)
Endpoint público sem auth, consumido pelo `PublicBooking`. Retorna apenas `{ can_accept_payments, pix_enabled, status }`. **Não vaza** `stripe_connect_account_id` nem capabilities internas.

### 3.6 `functions/createBookingPaymentIntent`
Antes de criar o PaymentIntent na conta Connect:

```js
if (payment_method === 'pix' && !company.stripe_connect_pix_enabled) {
  return { error: 'pix_not_enabled', message: 'Escolha pagar com cartão.' };
}
payment_method_types = payment_method === 'pix' ? ['pix'] : ['card'];
```

**Fallback automático:** se a UI tentar PIX numa conta sem capability, devolve erro amigável — checkout nunca quebra.

---

## 4. Segurança e multi-tenant

| Garantia                          | Como é enforced                                                 |
|-----------------------------------|-----------------------------------------------------------------|
| Tenant isolation                  | `company_id` validado contra `owner_email` + `TeamMember`        |
| Sem cross-tenant capability leak  | Cada Company tem seu próprio `stripe_connect_account_id`        |
| Sem exposição de account_id pub.  | `getCompanyConnectStatus` retorna só flags booleanas            |
| Sem `error.message` do Stripe     | Códigos opacos + `correlation_id` no log do servidor            |
| Idempotência de webhook           | `IdempotencyKey` por `event.id`, TTL 7d                         |
| Rate limit em sync explícito      | (futuro) `persistentRateLimit` — hoje não é hot path             |
| Replay attack                     | Stripe signature + `event.livemode` check + dedup por id        |

---

## 5. Auditoria

Toda transição PIX off↔on em `syncStripePixStatus` cria registro `AuditLog`:

```json
{
  "action": "STRIPE_PIX_ENABLED" | "STRIPE_PIX_DISABLED",
  "actor_email": "<owner email>",
  "company_id": "...",
  "target_type": "Company",
  "before": { "stripe_connect_pix_enabled": false },
  "after":  { "stripe_connect_pix_enabled": true  },
  "metadata": {
    "connect_account_id": "acct_...",
    "connect_status": "enabled",
    "request_id": "...",
    "source": "syncStripePixStatus"
  }
}
```

Falhas (account órfã, Stripe error, cross-tenant) geram `SecurityEvent` com severity high/critical.

---

## 6. UX no painel da barbearia

`pages/app/AppPagamentos` + `components/billing/StripeConnectCard` mostram **3 estados**:

1. **PIX ativo** → badge verde "Tudo pronto ✓ — PIX e cartão aceitos"
2. **Cartão ok, PIX inativo** → badge âmbar com **passo a passo** + botão "Abrir Stripe Express" (deep link pra `connect.stripe.com/express_login`)
3. **Conta incompleta** → badge âmbar "Cadastro Stripe incompleto"

---

## 7. UX no checkout público (`PublicBooking`)

Antes de mostrar o seletor de pagamento, o frontend consulta `getCompanyConnectStatus`:

- Se `pix_enabled === true` → mostra **PIX + cartão**, PIX como opção destacada.
- Se `pix_enabled === false` → mostra **apenas cartão** (PIX oculto totalmente).
- Se `can_accept_payments === false` → mostra "Indisponível — entre em contato direto".

Quando PIX é selecionado, `createBookingPaymentIntent` confirma o PaymentIntent imediatamente para gerar QR Code + copia-e-cola (`next_action.pix_display_qr_code`).

---

## 8. Webhooks suportados (relacionados a PIX)

| Evento                            | O que faz                                                       |
|-----------------------------------|-----------------------------------------------------------------|
| `account.updated`                 | Refresh de capability PIX + charges/payouts                     |
| `payment_intent.succeeded`        | Promove Appointment para `agendado`, dispara email confirmação  |
| `payment_intent.payment_failed`   | Marca `payment_status: failed`, permite retry                   |
| `payment_intent.canceled`         | Libera slot, marca Appointment `cancelado`                      |
| `checkout.session.completed`      | Ativa assinaturas SaaS + CustomerPlan (Connect)                 |

Todos deduplicados por `event.id` em `IdempotencyKey` (TTL 7d).

---

## 9. Troubleshooting

### "PIX não aparece para o cliente final"
1. Verifique em `/app/configuracoes/pagamentos` se o badge mostra "PIX ativo".
2. Se "PIX inativo", clique em **Abrir Stripe Express** e ative em **Configurações → Métodos de pagamento**.
3. Volte e clique em **Atualizar status** (chama `syncStripePixStatus`).
4. Se o badge persistir como inativo, abra um SecurityEvent no Master para investigar.

### "Erro: account_invalid / not connected to your platform"
A conta Connect foi excluída no Stripe (ou criada em outro ambiente). O sistema limpa automaticamente o vínculo órfão e cria uma nova conta quando o dono clica em "Conectar Stripe" novamente.

### "Webhook account.updated não chega"
1. Verifique `STRIPE_WEBHOOK_SECRET_CONNECT` no dashboard de webhooks (Contas conectadas).
2. Eventos rejeitados aparecem como `Webhook signature verification failed` no log.
3. Stripe retenta por até 3 dias.

### "PaymentIntent PIX falha mesmo com pix_enabled=true"
Causa comum: conta Express ainda em fase de verificação. Verifique `account.requirements.currently_due` via `getConnectAccountStatus`.

---

## 10. O que NÃO fazemos (e por quê)

| ❌ NÃO fazemos                                       | Por quê                                                      |
|-----------------------------------------------------|--------------------------------------------------------------|
| `capabilities.pix_payments.requested = true`        | Stripe BR não permite — retorna erro                         |
| `payments_settings.payment_method_types`            | Endpoint inexistente na API Stripe                           |
| Cache da capability                                  | TTL adicionaria latência sem ganho (webhook já mantém fresh) |
| Tabela `ProcessedStripeEvent` separada              | `IdempotencyKey` já cumpre essa função (dedup por route+id)  |
| Forçar PIX via `payment_method_types: ['card','pix']` | Stripe rejeita se conta não tem capability — fallback é decidir server-side |

---

**Última revisão:** 2026-05-21
**Owner:** Equipe O CORTE — Pagamentos