# Pagamentos no booking público (Asaas)

Documentação operacional do fluxo de pagamento online dos agendamentos via link
público (`/agendar/:slug`). Estado: **Etapa 2B+** entregue — PIX + Cartão.

## Métodos aceitos

| Método | billingType Asaas | UX | Confirmação |
|--------|-------------------|----|-------------|
| PIX | `PIX` | QR Code + copy/paste exibidos inline. | Webhook `PAYMENT_RECEIVED`/`CONFIRMED`. |
| Cartão | `CREDIT_CARD` | Botão "Pagar com cartão" → abre `invoiceUrl` (hosted Asaas) em nova aba. | Webhook + polling local. |
| Boleto | — | **Não habilitado** no fluxo público (vencimento incompatível com janela de 15 min). |

Janela de pagamento: **15 minutos** após a criação do Appointment (campo
`payment_expires_at`). Após esse prazo, o slot é liberado e o cliente precisa
recomeçar.

## Por que cartão é hosted?

- Cliente preenche dados de cartão **dentro do ambiente Asaas** (URL `invoiceUrl`).
- Plataforma O CORTE **nunca recebe, processa ou armazena** PAN/CVV/CCV.
- PCI compliance fica 100% com o Asaas.
- 3DS automático quando habilitado pela bandeira.
- Mesma arquitetura usada em planos do cliente final (Etapa 2C) e SaaS (Etapa 2A).

## Fluxo end-to-end

### 1. Cliente escolhe método (`BookingPaymentStep`)
Frontend valida CPF (11 dígitos) e chama:

```js
base44.functions.invoke('createAsaasBookingPayment', {
  company_id, professional_id, service_id, scheduled_at,
  customer_name, customer_phone, customer_email, customer_cpf,
  payment_method: 'pix' | 'card',
  idempotency_key,
});
```

### 2. Backend cria Appointment + Payment Asaas
- Rate limit IP+telefone.
- Slot lock atômico (TTL 90s).
- Validação autoritativa de service/professional/bloqueios.
- Cria Customer Asaas (idempotente por `externalReference=cust:<company>:<customer>`).
- Cria Appointment com `status='aguardando_pagamento'`, `payment_expires_at=now+15min`.
- Cria Payment Asaas:
  - `billingType: 'PIX' | 'CREDIT_CARD'`
  - `externalReference: 'booking:<appointment_id>'`
  - `idempotencyKey: 'bk_pay:<apt>:<method>'` ← inclui método para suportar troca.
  - `split: [{ walletId, percentualValue }]` se a barbearia tem subaccount aprovada.

### 3. Frontend mostra o pagamento
- PIX → `PixPaymentBox` (QR + polling).
- Cartão → `CardPaymentBoxAsaas` (botão → `invoiceUrl` em nova aba + polling).

### 4. Webhook confirma
Asaas envia `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` para `asaasWebhook`. A função
identifica o appointment via `externalReference="booking:<id>"` e atualiza:

```js
{
  status: 'agendado',
  payment_status: 'succeeded',
  paid_online: true,
  paid: true,
  paid_at: <now>,
}
```

Idempotente (replay devolve `{ replay: true }`).

### 5. Polling do frontend (fallback)
A cada 4s, `getAsaasBookingStatus({ appointment_id, force_check: true })` lê o
estado local; se `force_check=true`, também consulta o Asaas. Webhook é a fonte
da verdade — polling só acelera a UX quando a aba está aberta.

## Eventos Asaas tratados

| Evento | Efeito |
|--------|--------|
| `PAYMENT_CONFIRMED` | Appointment → `agendado` / `payment_status='succeeded'`. |
| `PAYMENT_RECEIVED` | Equivalente ao acima. |
| `PAYMENT_OVERDUE` | Não aplicável a booking (janela é de 15min, não há overdue). Tratado em SaaS. |
| `PAYMENT_REFUNDED` / `PAYMENT_DELETED` | Tratado para SaaS. Para booking, o `cleanupExpiredBookingPayments` libera slots vencidos. |

## Split automático

Se `Company.asaas_subaccount_wallet_id` E `Company.asaas_subaccount_status === 'active'`,
o Payment é criado com `split` direcionando o valor para a wallet da barbearia.

- Percentual default: **100%** (campo `Company.asaas_split_percentage`).
- O CORTE monetiza apenas a mensalidade SaaS — não há fee adicional por booking.
- Sem subaccount aprovada: valor cai na conta master O CORTE; repasse manual.

Detalhes da subaccount: ver `docs/ASAAS_MIGRATION.md#etapa-2c--split-automático-via-subaccount-asaas-entregue`.

## Garantias de segurança

| Guarda | Onde mora |
|--------|-----------|
| Tenant isolation (service/professional pertencem à company) | `createAsaasBookingPayment` linhas 327-336 |
| Rate limit IP + telefone | `_checkIpRateLimit` + `_checkBookingRateLimit` |
| Slot lock atômico (anti race condition) | `acquireSlotLock` / `consumeSlotLock` |
| Idempotência por chave | `IdempotencyKey` + `bk_pay:<apt>:<method>` |
| Sanitização de input | `_sanitizeText`, `sanitizeCpfCnpj`, `sanitizePhone` |
| Webhook auth | header `asaas-access-token` validado constant-time |
| PAN/CVV nunca tocados | Hosted invoice — dados ficam no Asaas |
| Webhook é fonte da verdade | Frontend só confirma após `payment_status='succeeded'` |

## Habilitando uma barbearia

1. Owner abre `/app/configuracoes/pagamentos`.
2. Preenche CPF/CNPJ + endereço.
3. Clica em "Ativar pagamento online" (`createAsaasSubaccount`).
4. Após aprovação Asaas (webhook `ACCOUNT_STATUS_UPDATED`), `asaas_pix_enabled=true`
   é setado e o link público passa a aceitar PIX **e** cartão automaticamente.

Não há toggle separado para cartão — `asaas_pix_enabled` ativa ambos.

## Rollback

Reverter o frontend (`BookingPaymentStep`) para não exibir a opção de cartão
mantém o cartão funcionando no backend (apenas oculto na UI). Para desligar
totalmente, basta restringir a validação no backend:

```js
if (methodNorm !== 'pix') return respond({ error: 'invalid_payment_method' }, 400);
```

Operação reversível, sem perda de dados.

## Testes

- `tests/asaas/bookingCardPayment.test.js` — garantias de PCI, idempotência, rollback.
- `tests/asaas/splitIntegrity.test.js` — split só com subaccount ativa, parity PIX/cartão.
- `tests/publicBooking/paymentMethods.test.js` — métodos aceitos/recusados, rate limit.