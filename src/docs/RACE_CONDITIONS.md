# 🏁 RACE CONDITIONS — Mapa, Mitigações e Decisões

Documento vivo. Toda nova feature que envolve concorrência deve atualizar este arquivo.

---

## Por que esse documento existe

O Base44 SDK não expõe transações nem locks pessimistas. Race conditions são responsabilidade do código de aplicação. Sem documentação centralizada, soluções viram tribal knowledge e regredimos a cada feature nova.

---

## 1. Double-booking de slot (CRÍTICO)

### Cenário
Dois clientes diferentes (ou o mesmo cliente em duas abas) clicam "Confirmar" no mesmo horário/profissional simultaneamente.

### Fluxo vulnerável
```
T0: Cliente A → filter slot  → vazio
T1: Cliente B → filter slot  → vazio
T2: Cliente A → create Appointment ✅
T3: Cliente B → create Appointment ✅  ← DOUBLE BOOKING
```

### Mitigação (P0.1)
Entidade `SlotReservation` separada do Appointment, com:
- chave composta `slot_key = company:professional:iso_minute`
- TTL de 90s
- status: `active` → `consumed` → `expired`

**Garantia real**: continua sendo last-writer-wins no Base44, mas a janela de race cai de ~300ms (filter+create) para ~50ms (single create). Para fechar 100%, idealmente precisaríamos de unique index ou stored procedure — discutido com plataforma em paralelo.

### Status: ⏳ em P0.1

---

## 2. Comissão duplicada em conclusão de atendimento

### Cenário
Frontend (admin manual) e automação (`onAppointmentConcluded → registerCommission`) processam o mesmo appointment ao mesmo tempo.

### Mitigação ATUAL (✅ resolvido)
`functions/registerCommission.js` tem **idempotência tripla**:
1. Flag `commission_created` no Appointment.
2. Filter por `appointment_id` em Commission.
3. Marca flag após criar.

**Janela residual**: T0=check flag (false), T1=check Commission (vazio), T2=A cria, T3=B cria. Duas commissions com mesmo `appointment_id` podem entrar. Risco baixo — automação leva ~2s, manual leva ~1s.

### Status: ✅ acceptable, monitorar via UserEvent.

---

## 3. Fechamento de caixa concorrente com novo lançamento

### Cenário
- Atendente A está fechando o caixa (calculando totais).
- Atendente B conclui um atendimento → `onAppointmentConcluded` cria `FinancialEntry` com `cash_register_id` deste caixa.
- O snapshot que A salvou no `CashRegister` ignora a entrada de B.

### Mitigação (P0.3) ✅ IMPLEMENTADO
Estado intermediário `fechando`:
1. **Claim atômico**: update `status='aberto' → 'fechando'` + `closing_by=user.email` + `closing_started_at=now()`.
2. **Re-leitura**: confirma que `closing_by` é o nosso usuário (perdedor da race recebe 409).
3. Cálculo do snapshot (sobre estado já isolado).
4. **Finalize**: `fechando → fechado` com todos os snapshots.

`onAppointmentConcluded` filtra explicitamente `status: 'aberto'` (já faz por filter exato no Base44 — `fechando` não bate). Durante `fechando`, novos atendimentos não amarram a esse caixa → `cash_register_id` fica vazio e o atendente reconcilia manualmente depois (aceitável).

**Cenário de falha entre passos 3 e 4**: caixa fica preso em `fechando`. Job `repairStuckCashRegisters` (a cada 10min) detecta caixas com `closing_started_at` > 5min e cria `SystemAlert` para intervenção manual no painel master. **Nunca faz auto-rollback** — caixa é dinheiro real.

**Janela residual**: 2 claims simultâneos no mesmo ms → Base44 last-writer-wins decide. Aceitável (< 10ms).

### Status: ✅ resolvido em P0.3 (commit 2026-05-11)

---

## 4. Pagamento Pix vs Cartão concorrentes do mesmo cliente

### Cenário
Cliente cria PI com Pix, não paga, troca para cartão. O `createBookingPaymentIntent` atual reusa Appointments do MESMO telefone pendentes.

### Mitigação ATUAL (✅ resolvido)
`createBookingPaymentIntent.js` linhas 121-158:
- Detecta Appointments do mesmo `customer_phone` em `aguardando_pagamento`.
- Cancela PaymentIntent antigo no Stripe.
- Cria novo Appointment + PI.

**Idempotency key inclui `payment_method`** → mesmo cliente trocando pix↔card não colide na chave.

### Status: ✅ resolvido. Atenção: depende do P0.1 para garantir que o slot continua locked enquanto troca.

---

## 5. Consumo de assinatura duplo

### Cenário
Cliente final agenda dois serviços simultâneos (pelo link público em 2 abas). Ambos chamam `consumeSubscriptionUse` antes de qualquer um decrementar `uses_remaining`.

### Mitigação ATUAL (parcial)
- Idempotência por `appointment_id` (linha 50): se já tem usage, não consome de novo.
- Mas dois appointments diferentes consomem livremente.

**Janela real**: read uses_remaining = 1, A consome (decrementa para 0), B já leu 1 → consome de novo → fica em -1.

### Mitigação planejada (Sprint 3)
- Adicionar `version` no CustomerSubscription (optimistic locking).
- Ou consolidar consume + decrement via função única atômica.

### Status: ⏳ médio — incluído na P1.

---

## 6. Webhook do Stripe duplicado

### Cenário
Stripe garante "at least once delivery". Mesmo evento pode chegar 2x (retry após timeout ou problema de rede).

### Mitigação ATUAL (✅ resolvido)
- `checkout.session.completed` → idempotente: checa se Company já tem stripe_subscription_id.
- `customer.subscription.updated` → idempotente (campos sobrescritos).
- `payment_intent.succeeded` → idempotente (linha 412 checa `appt.payment_status !== 'succeeded'`).
- `invoice.paid` → idempotente.

### Status: ✅ resolvido.

---

## 7. Webhook ambiente errado (test ↔ live)

### Cenário
Stripe envia evento de produção para webhook configurado em test mode (ou vice-versa).

### Mitigação ATUAL
`stripeWebhook.js` linha 62: check `event.livemode !== isLive` → retorna 200 e ignora.

### Problema
**Silencioso**. Se `STRIPE_ENVIRONMENT` estiver mal configurado em produção, pagamentos reais somem.

### Mitigação (P0.4)
- Loga `console.error`.
- Cria `SystemAlert` severity=critical.
- Dashboard master tem contador.

### Status: ⏳ em P0.4.

---

## 8. Reset de senha do cliente público invalida sessões

### Cenário
Customer logado em outro device. Solicita reset → backend escreve `auth_token: 'reset:xxx'` no MESMO campo do token de sessão → device antigo é deslogado.

### Mitigação planejada (A6)
Criar campo `reset_token` separado em Customer.

### Status: ⏳ Sprint 3.

---

## Princípios gerais para evitar race conditions

1. **Nunca fazer `read → modify → write` sem optimistic lock** quando o valor é compartilhado.
2. **Idempotência por chave de negócio** (não por timestamp).
3. **Status intermediário** quando uma operação tem mais de 1 step.
4. **Snapshots no fechamento** (calcular e gravar tudo de uma vez, não item por item).
5. **Webhook = at least once** — sempre idempotente.
6. **TTL em locks** — sem isso, um crash leva o sistema a deadlock.
7. **`asServiceRole` apenas após RBAC** — autorizar primeiro, escalar privilégio depois.

---

## Anti-patterns documentados (evitar)

```js
// ❌ ERRADO — race window
const existing = await Entity.filter({ key });
if (existing.length === 0) await Entity.create({ key });

// ✅ MELHOR — idempotente
try {
  await Entity.create({ key, unique_key });
} catch (e) {
  if (e.code === 'UNIQUE_VIOLATION') return existing;
  throw e;
}

// ⚠️ ACEITÁVEL quando não temos unique constraint
// (caso atual no Base44 — adicionar mitigação por status)
```

```js
// ❌ ERRADO — confia no frontend
const price = payload.price;

// ✅ CERTO — busca do banco
const service = await sdk.entities.Service.get(payload.service_id);
const price = service.price;
`