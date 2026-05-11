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
| P0.5 | AuditLog: company_id como coluna real + queries por tenant | C5 | 2 | ✅ | 2026-05-11 |
| P0.6 | RBAC sweep — `ensureSameCompany` em todos endpoints financeiros | C6 | 2 | ✅ | 2026-05-11 |

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

| Função | Risco | Tem `ensureSameCompany`? | Status P0.6 |
|---|---|---|---|
| `consumeSubscriptionUse` | 🔴 alto | ❌ → ✅ | corrigido (caller + customer + appt match) |
| `customerSubscriptionAction` | 🔴 alto | parcial → ✅ | reforço explícito no `subscribe` |
| `reverseCommission` | 🟠 médio | ✅ | já tinha (auditado, OK) |
| `confirmAppointment` | 🟠 médio | n/a | público + token único — token É o tenant |
| `submitReview` | 🟠 médio | n/a | público + token único — token É o tenant |
| `getCashAudit` | 🟡 baixo | ✅ | OK |
| `closeCashRegister` | 🟡 baixo | ✅ | OK |
| `mutateFinancialEntry` | 🟡 baixo | ✅ | OK |

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

### Sprint 3 — Auditoria A1–A8 (em execução)

**Sprint A — Isolamento + Auth** ✅ (2026-05-11)
- A1: `useCompany` → `getMyCompany` backend (sem `Company.list()` no frontend)
- A6: `reset_token` dedicado em `Customer` (separado de `auth_token`) + `token_version`
- A8: `idempotency_key` em `WhatsAppMessage` + dedup em `sendWhatsAppMessage` + todos os 5 callers (jobReminders, jobPostAppointment, jobReactivation, runLifecycleCampaigns, triggerBookingConfirmation)

**Sprint B — Integridade financeira/performance** ✅ (2026-05-11)
- A3: `AppFinanceiro` agora filtra `date $gte/$lte` no backend (limite 5000, sem truncamento)
- A7: `closeCashRegister` faz query direta por `cash_register_id` + fallback temporal só para legados
- A4: `PublicBooking` janela `scheduled_at` (today → +14d) + `status != cancelado` no backend
- Bonus: novo `lib/dateRangeQueries.js` centraliza o padrão (anti-pattern killer)

**Sprint C — Hardening estrutural** ✅ (2026-05-11)
- A2: `unitFilter` ganhou `STRICT_UNIT_ISOLATION` flag (default OFF) + telemetria `warnOnce` por entidade/id. Strict mode ativável via `localStorage.bt:strict_unit=1` ou `setStrictUnitIsolation(true)` no boot.
- A5: `AppLayout` agora usa `useRef` lock (`inFlight` + `attempted`) — no retry automático em caso de falha, eliminando loop. `backfillUnits` no servidor ganhou recovery defensivo (se units existem mas flag está vazia, marca flag e retorna).

### Sprint M1 — Segurança residual ✅ (2026-05-11)

**M3 — `consumeSubscriptionUse.revert` sem tenant check (defesa em profundidade)**
- O fluxo principal já validava `sub.company_id == caller.company_id` no topo.
- Adicionados 2 checks no caminho `revert`: `usage.company_id == sub.company_id` e `usage.subscription_id == subscription_id`. Bloqueia qualquer edge case onde 2 tenants tenham appointment_id colidente.

**M5 — Tokens de confirmação/avaliação gerados no servidor**
- `confirm_token` e `review_token` agora gerados em `createPublicAppointment` e `createBookingPaymentIntent` via `crypto.randomUUID()` (Web Crypto, RFC 4122 v4).
- Payload do frontend **ignorado**: mesmo se o cliente injetar, backend sobrescreve.
- Expiries (`confirm_token_expires_at`, `review_token_expires_at`) também calculadas no servidor a partir de `scheduled_at`.
- `pages/PublicBooking.jsx` removeu import de `@/lib/tokens` e geração local — payload mais enxuto.

**M10 — Sanitização e CSV injection**
- `_sanitizeText` no backend (createPublicAppointment + createBookingPaymentIntent) agora faz: trim, strip HTML tags (`<...>`), strip control chars, colapsa whitespace exagerado.
- Novo `lib/csvSafe.js` com `csvCell` + `csvLine` + `buildCsv`: bloqueia CSV injection (`=`, `+`, `-`, `@`, `\t`, `\r` no início). Padrão OWASP.
- `FinancialExport` migrado para usar `csvCell`. Próximos exports (auditoria, comissões) podem adotar incrementalmente.

### Salto arquitetural — BFF (Backend-for-Frontend) ⏳ em execução

**Princípio**: Frontend → backend functions controladas → entities (em vez de frontend → entities direto). Reduz superfície de leak, centraliza auditoria, prepara versionamento.

**Fase 1 — Customer (read path)** ✅ (2026-05-11)
- Criada `functions/listCustomers`: resolve caller, aplica `company_id` + unit scoping no servidor (espelha `shouldScopeCustomersByUnit`). Aceita filtros opcionais (`lifecycle_status`, `status`, `limit`).
- `pages/app/AppClientes` migrado — não toca mais em `Customer.filter`. Mutations (create/update/delete) continuam diretas por enquanto (próxima fase).
- Smoke test: 200 OK, retorna `{ customers, total, scope }`.

**Fase 2 — Customer (write path)** ✅ (2026-05-11)
- Criada `functions/mutateCustomer` (BFF unificado para create/update/delete). Padrão idêntico ao `mutateFinancialEntry` que já existe — evita 3 funções separadas.
- Servidor decide `company_id` (do caller) e `unit_id` (auto-stamp quando `customers_shared_across_units=false`). Frontend não envia mais nenhum dos dois.
- Sanitização por allow-list: só `name/phone/email/notes/tags/status/favorite_*` são aceitos. Campos de auth (`password_hash`, `auth_token`, `reset_token`, `token_version`) bloqueados — só `customerAuth` pode mexer.
- Role `barbeiro` bloqueado server-side (defesa em profundidade — botões já escondidos no front).
- `AppClientes` migrado: removidos `shouldScopeCustomersByUnit` e import de `customerUnitMode`. Mutations passam por `base44.functions.invoke('mutateCustomer', ...)`.
- Smoke test: INVALID_ACTION → 400; cross-tenant update → 404 genérico (não vaza existência).

**Fase 3 — Appointment (read + write)** ⏳
- Query mais pesada do app + maior superfície de leak. Aplicar mesmo padrão.

**Fase 4 — Outras listas tenant-sensitive** ⏳
- `CustomerSubscription`, `WhatsAppMessage`, `Commission` listadas no app passam pelo BFF.

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