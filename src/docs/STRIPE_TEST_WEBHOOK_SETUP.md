# 🧪 Configurando o Webhook de Teste do Stripe

Este guia explica como configurar o **webhook em modo Test** do Stripe para o O CORTE, permitindo testar todo o fluxo de checkout, assinaturas, pagamentos e Connect **sem cobranças reais**.

> 💡 O app já tem o webhook **Live** registrado (criado pela plataforma Base44).
> Este guia é para registrar manualmente o webhook **Test**, que é uma operação separada no Stripe.

---

## 📋 Pré-requisitos

- Conta Stripe com acesso ao Dashboard
- Permissão de admin para criar webhooks
- A função `stripeWebhook` já existe no app (✅ confirmado)
- Os secrets `STRIPE_TEST_SECRET_KEY` e `STRIPE_TEST_PUBLISHABLE_KEY` já estão configurados (✅ confirmado)

---

## 🎯 Visão Geral do Fluxo

```
┌──────────────────────────────────────────────────────────┐
│  STRIPE_ENVIRONMENT=test                                  │
│                                                            │
│  Frontend (Checkout) ──→ createCheckoutSession             │
│                          (usa STRIPE_TEST_SECRET_KEY)      │
│                              │                             │
│                              ▼                             │
│                   Stripe Checkout (modo Test)              │
│                              │                             │
│                              ▼                             │
│             Stripe envia evento para o webhook             │
│                              │                             │
│                              ▼                             │
│   stripeWebhook (valida com STRIPE_TEST_WEBHOOK_SECRET)   │
│                              │                             │
│                              ▼                             │
│                   Cria Company no Base44                   │
└──────────────────────────────────────────────────────────┘
```

---

## 🔧 Passo a Passo

### 1️⃣ Acesse o Stripe em modo **Test**

1. Vá para [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. No canto superior direito, **ative o toggle "Test mode"** (Modo de teste)
   - O fundo do dashboard fica laranja quando você está em test mode
3. Confirme que aparece **"TEST DATA"** no header

> ⚠️ **Importante**: Webhooks Live e Test são separados. Você precisa criar um para cada modo.

---

### 2️⃣ Crie o endpoint de webhook em Test

1. No menu lateral, vá em **Developers → Webhooks**
2. Clique em **"+ Add endpoint"** (Adicionar endpoint)
3. Preencha os campos:

   | Campo | Valor |
   |---|---|
   | **Endpoint URL** | `https://ocorte.base44.app/api/functions/stripeWebhook` |
   | **Description** | `O CORTE - Test Webhook` |
   | **Listen to** | `Events on your account` ✅ |

---

### 3️⃣ Selecione os eventos a escutar

Clique em **"Select events"** e marque exatamente estes 11 eventos:

#### Checkout
- ✅ `checkout.session.completed`

#### Subscriptions (SaaS - assinatura da plataforma)
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`

#### Invoices (cobranças recorrentes)
- ✅ `invoice.paid`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`

#### Payment Intents (pagamentos de agendamentos via Connect)
- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed`
- ✅ `payment_intent.canceled`

#### Connect (onboarding das barbearias)
- ✅ `account.updated`

---

### 4️⃣ Habilite eventos de **Connected accounts**

Como o app usa Stripe Connect (barbearias têm contas conectadas):

1. Na mesma página de criação do webhook, role até **"Listen to events on Connected accounts"**
2. **Marque essa opção** ✅
3. Adicione **os mesmos 11 eventos** acima também para connected accounts

> 🔑 Sem isso, eventos de assinatura de cliente (CustomerPlan via Connect) **não chegam** ao webhook.

---

### 5️⃣ Salve e copie o **Signing Secret**

1. Clique em **"Add endpoint"** (Adicionar endpoint)
2. Na página do endpoint criado, procure por **"Signing secret"**
3. Clique em **"Reveal"** e copie o valor — começa com `whsec_...`

> ⚠️ Esse secret é **diferente** do webhook Live. Guarde-o com cuidado.

---

### 6️⃣ Configure o secret no Base44

1. No painel do Base44, vá em **Dashboard → Settings → Secrets**
2. Localize a variável `STRIPE_TEST_WEBHOOK_SECRET`
3. Cole o valor `whsec_...` copiado no passo anterior
4. Salve

> ✅ O código já lê esse secret automaticamente quando `STRIPE_ENVIRONMENT=test`.
> Veja `functions/stripeWebhook` → função `getStripeConfig()`.

---

### 7️⃣ Confirme o ambiente

No painel do Base44 → Secrets, confirme:

| Variável | Valor |
|---|---|
| `STRIPE_ENVIRONMENT` | `test` |
| `STRIPE_TEST_SECRET_KEY` | `sk_test_...` |
| `STRIPE_TEST_PUBLISHABLE_KEY` | `pk_test_...` |
| `STRIPE_TEST_WEBHOOK_SECRET` | `whsec_...` (recém criado) |

---

## 🧪 Como testar

### Teste 1 — Checkout SaaS (criar uma barbearia)

1. Abra `https://ocorte.base44.app/checkout?plano=pro` (em **nova aba**, nunca dentro de iframe)
2. Preencha o form e clique em "Assinar"
3. No Stripe Checkout, use o cartão de teste:
   ```
   Número: 4242 4242 4242 4242
   Validade: qualquer data futura (ex: 12/30)
   CVC:      qualquer (ex: 123)
   CEP:      qualquer (ex: 01310-000)
   ```
4. Após confirmar, você é redirecionado para `/checkout/sucesso`
5. **Em até 30 segundos** uma `Company` deve ser criada no banco

### Teste 2 — Verificar se o webhook recebeu

No Stripe Dashboard (ainda em test mode):
1. Vá em **Developers → Webhooks → [seu endpoint]**
2. Aba **"Events"** → você deve ver `checkout.session.completed` com status `200 OK`
3. Se aparecer `400` ou `500`, clique no evento e veja o erro

### Teste 3 — Verificar logs no Base44

No Base44 → **Code → Functions → stripeWebhook → Logs**, procure por:
```
[stripe] environment=test
Stripe event: checkout.session.completed (env=test)
Created company for <email>
```

---

## ❌ Troubleshooting

### "Invalid signature" no log
- O `STRIPE_TEST_WEBHOOK_SECRET` no Base44 está diferente do que está no Stripe.
- Re-copie o "Signing secret" do Stripe Dashboard e cole novamente.

### "env mismatch" no log
- O webhook Live está mandando evento, mas o app está em mode test (ou vice-versa).
- O código já ignora silenciosamente — confirme que `STRIPE_ENVIRONMENT` está correto.

### Webhook recebe mas Company não é criada
- Veja no log se aparece `No email in session`.
- Pode faltar `customer_email` ou `metadata.email` na sessão.
- O `createCheckoutSession` já preenche os dois — confirme que o frontend está enviando o email no body.

### Cliente final assina plano mas a CustomerSubscription fica em `pending_payment`
- Falta marcar **"Listen to events on Connected accounts"** no webhook (passo 4️⃣).
- Como contingência, use a função `reconcileCustomerSubscription` (admin-only) para sincronizar manualmente.

### Eventos de Connect (`account.updated`) não chegam
- Mesma causa: marque eventos em **Connected accounts** no webhook.

---

## 🔄 Alternar entre Test e Live

Quando estiver pronto para produção real:

1. Mude `STRIPE_ENVIRONMENT` para `live`
2. O código passa a usar `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` automaticamente
3. Os webhooks Live (já registrados) começam a processar eventos reais

> 💡 Os dois ambientes são totalmente isolados — Companies criadas em test continuam ali, mas o app deixa de processar eventos test.

---

## 📚 Referências

- [Stripe Webhooks docs](https://docs.stripe.com/webhooks)
- [Test mode vs Live mode](https://docs.stripe.com/test-mode)
- [Connect webhooks](https://docs.stripe.com/connect/webhooks)
- [Cartões de teste do Stripe](https://docs.stripe.com/testing#cards)

---

**Última atualização:** 2026-05-06
**Função relacionada:** `functions/stripeWebhook`
**Secret esperado:** `STRIPE_TEST_WEBHOOK_SECRET