# 🛡️ HARDENING ROADMAP — O CORTE

**Status**: pause em features novas.
**Objetivo**: levar o sistema a um patamar de produção enterprise (multi-tenant, pagamentos reais, escala).
**Início**: 2026-05-11
**Owner**: engenharia

---

## Filosofia de execução

1. **Patches pequenos**: cada P0 entra como 1-2 PRs no máximo.
2. **Backward compatible**: nada que quebre dados existentes. Migrações sempre com fallback.
3. **Validável**: cada patch tem como ser testado manualmente (passos no PR) antes de mergear.
4. **Idempotente**: rollback sempre possível — toggles, feature flags, ou condicionais.
5. **Sem refactor cosmético**: só toca o que precisa para resolver o problema.

---

## Sequência (ordem absoluta de execução)

| # | Item | Ref. auditoria | Sprint | Status | PR |
|---|---|---|---|---|---|
| P0.1 | Lock atômico de slots | C1 | 1 | ⏳ | — |
| P0.2 | Blindagem `createPublicAppointment` + `createBookingPaymentIntent` | C2 | 1 | ⏳ | — |
| P0.3 | Race condition fechamento de caixa (`status=fechando`) | C3 | 1 | ✅ | 2026-05-11 |
| P0.4 | Stripe env mismatch — alerta + dashboard | C4 | 1 | ✅ | 2026-05-11 |
| P0.5 | AuditLog: company_id como coluna real + queries por tenant | C5 | 2 | ⏳ | — |
| P0.6 | RBAC sweep — `ensureSameCompany` em todos endpoints financeiros | C6 | 2 | ⏳ | — |

> Cada P0 só vai para produção depois de validado em homologação (test mode do Stripe + dados sintéticos).

---

## P0.1 — Lock atômico de slots (C1)

**Decisão arquitetural**: criar entidade `SlotReservation` (não usar campo único no Appointment).

**Por quê não slot_lock no Appointment?**
- Base44 SDK não garante constraint `unique` em campo composto.
- Reservation isola o lock do agendamento — permite expirar sem afetar histórico.
- Padrão comum em sistemas de booking (Airbnb, OpenTable usam essa modelagem).

**Schema novo** (`entities/SlotReservation.json`):
```json
{
  "name": "SlotReservation",
  "properties": {
    "company_id": "string",
    "professional_id": "string",
    "scheduled_at": "string (ISO)",
    "slot_key": "string (composto: company_professional_minute)",
    "owner_phone": "string",
    "expires_at": "string (ISO)",
    "status": "active | consumed | expired",
    "appointment_id": "string (após consumir)"
  }
}
```

**Algoritmo de lock**:
```
1. slot_key = `${company_id}:${professional_id}:${scheduled_at_iso_minute}`
2. expires_at = now + 90s (cobre maior latência de pagamento Pix)
3. Buscar reservations com slot_key e status='active' e expires_at > now
4. Se existe → reservation alheia → 409 slot_taken
   Se existe do MESMO phone → reusa
   Se não existe → cria e segue
5. Após criar Appointment → marca reservation status='consumed', appointment_id=X
6. Cleanup job: a cada 5min marca expired as que não foram consumidas
```

**Aplicar em**:
- `createBookingPaymentIntent.js` (substitui o filter+find atual)
- `createPublicAppointment.js` (novo — atualmente não tem)
- Cobertura: PIX, cartão e plano usam o MESMO mecanismo de lock.

**Efeitos colaterais mapeados**:
- ⚠️ Frontend já chama `createPublicAppointment` para plano — payload inalterado, resposta inalterada.
- ⚠️ Cron `cleanupExpiredBookingPayments` ganha responsabilidade extra (expirar reservations).
- ⚠️ AuditLog ganha eventos `SLOT_RESERVED` / `SLOT_EXPIRED` (opcional, low pri).

**Rollback**: feature flag `ENABLE_SLOT_LOCK` (env var). Se off, mantém comportamento antigo.

---

## P0.2 — Blindagem do booking público (C2)

**Mudanças no backend** (`createPublicAppointment.js` + `createBookingPaymentIntent.js`):

1. **Carregar service real**:
   ```js
   const service = await sdk.entities.Service.get(service_id);
   if (!service || service.company_id !== company_id) return 400;
   if (!service.active) return 400 service_inactive;
   const realPrice = service.price;     // NUNCA price do frontend
   const realDuration = service.duration_minutes;
   const realName = service.name;
   ```

2. **Carregar professional real**:
   ```js
   const pro = await sdk.entities.Professional.get(professional_id);
   if (!pro || pro.company_id !== company_id) return 400;
   if (!pro.active) return 400 professional_inactive;
   if (pro.service_ids?.length && !pro.service_ids.includes(service_id)) return 400 service_not_offered;
   ```

3. **Multi-unidade**: profissional precisa atender na unidade:
   ```js
   if (unit_id && pro.unit_ids?.length && !pro.unit_ids.includes(unit_id)) return 400;
   ```

4. **Revalidar horário comercial + bloqueios** (já temos `lib/scheduling.js` — portar a lógica para o backend):
   ```js
   const ok = validateBusinessHours(company, unit_id, scheduled_at, realDuration);
   const noBlock = !hasBlockConflict(blocks, professional_id, scheduled_at, realDuration);
   ```

5. **Rate limit** (nova entidade `RateLimit`? OU campo em Customer?):
   - Opção mais simples: contar appointments criados nas últimas 1h por `customer_phone`.
   - Limite: 5/hora por telefone. Ajustável via secret `BOOKING_RATE_LIMIT_PER_HOUR`.

6. **Sanitização de strings**:
   ```js
   customer_name = String(customer_name).trim().slice(0, 100);
   notes = String(notes || '').trim().slice(0, 500);
   ```

**Compatibilidade**: o payload do frontend pode continuar mandando `price`/`service_name`/`professional_name`, mas o backend **ignora** e usa o que está no banco. Sem breaking change para o frontend.

**Rollback**: nenhum — a validação é estritamente mais restritiva. Se quebrar, é porque o frontend está mentindo (e queremos detectar).

---

## P0.3 — Race fechamento de caixa (C3)

**Schema mudança** (`entities/CashRegister.json`):
```diff
"status": { "enum": ["aberto", "fechando", "fechado"] }
```

**Fluxo novo no `closeCashRegister`**:
```
1. tenant + cap check (já existe)
2. Update atômico: status='aberto' → 'fechando'   [só passa se ainda estava aberto]
3. Se updates retornar 0 rows / falhar → 409 already_closing
4. Calcular totals (com snapshot)
5. Update final: status='fechando' → 'fechado' + totals
6. Em caso de falha entre 4 e 5: cron repara (status=fechando há > 5min → reverte ou conclui)
```

**No `onAppointmentConcluded`** (linha 71 do arquivo):
```diff
- const openCashList = await sdk.entities.CashRegister.filter(
-   { company_id, status: 'aberto' }, ...);
+ const openCashList = await sdk.entities.CashRegister.filter(
+   { company_id, status: 'aberto' }, ...);   // exclui 'fechando' explicitamente
```

**Job de reparo** (novo `repairStuckCashRegisters`):
- Roda a cada 10min.
- Pega registers com `status=fechando` há > 5min.
- Loga `SystemAlert` severity=warning.
- Decisão manual via dashboard (não auto-rollback — evita perda de dados).

**Rollback**: schema é aditivo. Se desligar, queries com `status: 'aberto'` continuam funcionando.

---

## P0.4 — Stripe env mismatch (C4)

**Mudança em `stripeWebhook.js`** (linhas 61-65):
```diff
if (event.livemode !== isLive) {
- console.warn(...);
- return Response.json({ received: true, ignored: 'environment_mismatch' });
+ console.error('[stripeWebhook] CRITICAL env mismatch', { event_id, event_type, livemode });
+ await sdk.entities.SystemAlert.create({
+   type: 'stripe_env_mismatch',
+   severity: 'critical',
+   message: `Webhook ${event.type} recebido em ambiente errado (livemode=${event.livemode}, app=${isLive})`,
+   metadata: { event_id: event.id, event_type: event.type },
+ });
+ // Continua retornando 200 para o Stripe (evita retry storm), mas o alerta fica.
+ return Response.json({ received: true, ignored: 'environment_mismatch' });
}
```

**Dashboard**: no MasterDashboard adicionar contador de `SystemAlert.type='stripe_env_mismatch'` nas últimas 24h. Se > 0, banner vermelho.

**Validação pré-deploy**: criar função `runSystemCheck` (já existe) e adicionar check:
- `STRIPE_ENVIRONMENT` definido e ∈ {test, live}
- `STRIPE_SECRET_KEY` prefixo bate com env
- Webhook secrets presentes

**Rollback**: nenhum — só adiciona observability.

---

## P0.5 — AuditLog tenant filter (C5)

**Schema mudança** (`entities/AuditLog.json`):
```diff
+ "company_id": { "type": "string", "description": "..." }
```

**Migração** (backfill via função admin one-off):
```
1. Listar todos AuditLog onde company_id é null
2. Para cada: ler metadata.company_id e gravar no campo
3. Marcar idempotente via flag
```

**Mudança em `getCashAudit.js`** (linha 81):
```diff
- const audits = await base44.asServiceRole.entities.AuditLog.filter({}, '-created_date', 1000);
+ const audits = await base44.asServiceRole.entities.AuditLog.filter(
+   caller.is_super_admin ? {} : { company_id: caller.company_id },
+   '-created_date', 1000
+ );
```

**Sweep**: revisar todo lugar que cria AuditLog e garantir `company_id` no objeto direto (não só em `metadata`).

**Rollback**: campo é aditivo. Se backfill falhar, código tem fallback para `metadata.company_id`.

---

## P0.6 — RBAC sweep (C6)

**Funções a auditar** (lista priorizada):

| Função | Risco | Tem `ensureSameCompany`? |
|---|---|---|
| `consumeSubscriptionUse` | 🔴 alto | ❌ |
| `customerSubscriptionAction` | 🔴 alto | ❓ |
| `reverseCommission` | 🟠 médio | ❓ |
| `confirmAppointment` | 🟠 médio | ❓ |
| `submitReview` | 🟠 médio | ❓ |
| `getCashAudit` | 🟡 baixo | ✅ |
| `closeCashRegister` | 🟡 baixo | ✅ |
| `mutateFinancialEntry` | 🟡 baixo | ✅ |

**Padrão a aplicar** (extrair em `lib/serverPermissions.js` se ainda não tem):
```js
const caller = await getCallerContext(base44, user);
const target = await sdk.entities.X.get(id);
ensureSameCompany(caller, target);
```

**Sweep prático**:
1. PR único que toca todas funções da lista.
2. Cada função adiciona o check, sem mudar lógica.
3. Teste manual: tentar invocar cross-tenant via Postman → todos retornam 403.

---

## Sprints

### Sprint 1 (5 dias úteis)
- P0.1 (1.5 dia)
- P0.2 (1.5 dia)
- P0.3 (1 dia)
- P0.4 (0.5 dia)
- Buffer: 0.5 dia

### Sprint 2 (5 dias úteis)
- P0.5 com backfill (2 dias)
- P0.6 sweep RBAC (1.5 dia)
- Testes e regression (1.5 dia)

### Sprint 3 (opcional — alto/médio da auditoria)
- A1, A3, A4, A7 (queries pesadas e paginação)
- A5, A6 (auth refinements)
- Cobertura de testes inicial

---

## Critérios de "pronto"

Cada P0 só fecha quando:
- [ ] Patch mergeado e em produção.
- [ ] Smoke test manual passou (passos no PR).
- [ ] Sem regressão em fluxos críticos (booking, fechamento, pagamento).
- [ ] Log/Alert/Audit funcionando (se aplicável).
- [ ] `SECURITY_CHECKLIST.md` atualizado.

---

## Métricas de sucesso pós-hardening

- **Race conditions**: 0 ocorrências de double-booking em 7 dias.
- **Vazamento cross-tenant**: 0 alertas em `SystemAlert.type='cross_tenant_attempt'`.
- **Stripe mismatch**: monitorado, sem falsos positivos.
- **P99 latência**: booking público < 2s.
- **Webhook entrega**: 100% de eventos `payment_intent.*` processados.