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

### Sprint M2 — Desacoplamento/integridade ⏳ em execução

**M4 — Conflict check client-side** ✅ (2026-05-11) — documentado
- O check de conflito no frontend (`appointmentConflict`/`blockedConflict` em `lib/scheduling.js`, usado em AppAgenda) deixou de ser fonte de verdade no P0.1 (SlotReservation) e Fase 3 (mutateAppointment re-valida server-side).
- **Status oficial**: client-side conflict é **UX optimization only** — feedback otimista pra não deixar o operador apertar "Salvar" e esperar a request. A garantia real está em:
  - `SlotReservation` (lock atômico, TTL 90s) para booking público.
  - `mutateAppointment` re-checa conflict + block server-side antes de gravar (Fase 3).
- Não há mudança de código — só registrar essa decisão arquitetural. Frontend pode mostrar warning otimista; backend sempre vence o tie-breaker.
- Pendente futuro (não nesta sprint): considerar mover `lib/scheduling.js` para um pacote `lib/scheduling-ux.js` para evidenciar que é puramente cosmético.

**M2 — `payment_breakdown` incompleto no fechamento de caixa** ✅ (2026-05-11)
- `closeCashRegister` antes agregava só entradas por método (`payment_breakdown[method] = soma`). Saídas em Pix/cartão sumiam do relatório → operador conciliava errado, contador via valores inflados, analytics não fechava.
- Agora calcula `payment_breakdown_detail = { method: { gross_in, gross_out, net } }`:
  - `gross_in`: total de entradas por forma.
  - `gross_out`: total de saídas por forma.
  - `net`: in - out (líquido por forma).
  - Bucket `__sem_metodo` captura lançamentos legados sem `payment_method`, garantindo que NADA "some" silencioso (a soma de detail bate com `total_in`/`total_out`).
  - Sangria/suprimento NÃO entram aqui (são fluxo de caixa, cobertos por campos próprios).
- **Backward compat**: `payment_breakdown` legado (gross_in raso por método) continua no schema raiz — relatórios antigos seguem funcionando sem mudança. Detail vai em `CashRegister.metadata.payment_breakdown_detail` (schema já tem `metadata` aberto, sem migration).
- Response da função expõe `payment_breakdown_detail` para o frontend já usar imediatamente em telas novas.
- Não rompe nenhum consumidor atual (CaixaSummaryHeader, CaixaDreCard, CloseCashModal, HistoryDreCard etc.) — todos leem o campo legado.

**M1 — `recomputeCustomerLifecycle` síncrono no caminho crítico** ✅ (2026-05-11)
- `onAppointmentConcluded` antes fazia `await sdk.functions.invoke('recomputeCustomerLifecycle', ...)` no final do handler.
- Problema: bloqueava a resposta (~500ms-1s extras) e qualquer falha do recompute (timeout, 500, fila cheia) era logada como erro mesmo quando o crítico (FinancialEntry + WhatsApp de avaliação) tinha terminado com sucesso.
- Correção: invocação fire-and-forget. Promise dispara em background com `.catch()` para log. Handler retorna `lifecycle: { dispatched: true }` imediatamente.
- Justificativa: lifecycle é **pós-processamento**, não parte do contrato do evento "atendimento concluído". É idempotente — o job diário (`recomputeCustomerLifecycle` periódico) recalcula tudo. Se o dispatch em background falhar, o lifecycle fica defasado por algumas horas (até o próximo job), não corrompe nada.
- Smoke test: 200 OK em 1214ms, `lifecycle.dispatched=true`. Próximas conclusões devem rodar lifecycle assíncrono sem segurar a resposta.
- Aplicabilidade futura: padrão "dispatch + catch log" deve ser usado em todo lugar onde um handler crítico chama automação secundária (CRM, analytics, notificações não-transacionais).

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
- `_sanitizeText` no backend agora cobre os 3 entry points públicos que escrevem `Customer.name`:
  - `createPublicAppointment` (booking público gratuito/plano).
  - `createBookingPaymentIntent` (booking público Pix/cartão).
  - `customerAuth` action `signup` (auto-cadastro do cliente final na área `/cliente/:slug`) — gap descoberto e fechado em 2026-05-11. Antes, um cliente podia se cadastrar com `<script>` no nome e contaminar CSV/e-mails/WhatsApp.
- Sanitização: trim, strip HTML tags (`<...>`), strip control chars, colapsa whitespace exagerado, limita a 100 chars no `name`. Vazio após sanitize → 400.
- Novo `lib/csvSafe.js` com `csvCell` + `csvLine` + `buildCsv`: bloqueia CSV injection (`=`, `+`, `-`, `@`, `\t`, `\r` no início). Padrão OWASP.
- `FinancialExport` migrado para usar `csvCell`. Próximos exports (auditoria, comissões) podem adotar incrementalmente.
- Smoke test: `signup` com `name="<script>alert(1)</script>"` → grava `"alert(1)"`.

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

**Fase 3 — Appointment (read + write)** ✅ (2026-05-11)
- Criada `functions/listAppointments`: tenant + role (barbeiro força `professional_id`) + unit scope server-side. Suporta janela temporal (`from`/`to`) e limit configurável (max 2000). Removeu necessidade do front montar `apptFilter` para barbeiro.
- Criada `functions/mutateAppointment` (create/update/delete) com:
  - Allow-list rígida — bloqueia `paid_online`, `payment_intent_id`, `payment_status`, `payment_*`, `subscription_id`, `commission_created`, `confirm_token`, `review_token` e seus `*_expires_at`. Cliente NUNCA seta esses campos.
  - Conflict + block re-check server-side (porta `appointmentConflict`/`blockedConflict` do `lib/scheduling.js` para Deno). Front mantém checagem otimista para UX.
  - Tokens `confirm_token` e `review_token` gerados via `crypto.randomUUID()` no servidor (consistência com Fase M5).
  - Snapshots de `service_name`, `professional_name`, `price` lidos do banco — paylod do front é ignorado.
  - Auto-stamp `completed_at` quando `status='concluido'`.
  - `barbeiro` só pode `update` em appointments próprios; `create`/`delete` bloqueados.
  - Cross-tenant retorna 404 genérico (não vaza existência).
  - Update bloqueia mexer em `paid` se `paid_online=true` (Stripe é fonte da verdade).
- `AppAgenda` migrado:
  - Read via `listAppointments` (sem `Appointment.filter` direto).
  - Mutations create/update/delete via `mutateAppointment` (helper `invokeMutation`).
  - Auto-criação de cliente via `mutateCustomer` (Fase 2) — não usa mais `Customer.create` direto.
  - Removidos imports `generateToken`, `confirmTokenExpiry`, `reviewTokenExpiry` (gerados no servidor).
  - Erros do BFF (`SLOT_CONFLICT`, `SLOT_BLOCKED`, `FORBIDDEN_ROLE`, etc.) mapeados para mensagens humanas.
- Smoke test: listAppointments 200 OK retorna 500+ appointments; mutateAppointment → INVALID_ACTION 400 + cross-tenant 404 genérico.
- Páginas que ainda LEEM Appointment via SDK direto (Dashboard, Relatórios, AppFinanceiro, AppCRM, etc.) seguem na próxima fase — Fase 3 cobriu o único módulo com WRITE path.

**Fase 4 — Outras listas tenant-sensitive** ✅ (2026-05-11)
- `listAppointments` ganhou filtro `status` (string ou array via `$in`) — desbloqueia AppFinanceiro (status='concluido' + janela).
- Criadas 3 novas BFF functions, todas com mesmo padrão (caller resolvido server-side, super-admin bloqueado, allow-list, retorno 404 genérico cross-tenant):
  - **`listSubscriptions`** (CustomerSubscription): filtro opcional por `customer_id` (validado contra company), `status`. Unit scope quando `customers_shared_across_units=false` via lookup em Customer.unit_id. Barbeiro bloqueado (FORBIDDEN_ROLE).
  - **`listWhatsAppMessages`**: filtro opcional por `customer_id`, `type`, `status`. Unit scope direto via `unit_id` da própria entity. Barbeiro bloqueado.
  - **`listCommissions`**: barbeiro força `professional_id = teamMember.professional_id` server-side (defesa em profundidade). Suporta `from`/`to` em `earned_at`. Unit scope via `Professional.unit_ids`.
- **Migrações de leitura:**
  - `AppDashboard`: appointments (`listAppointments`) + activeSubs (`listSubscriptions`).
  - `AppRelatorios`: appointments (`listAppointments`).
  - `AppFinanceiro`: appointments concluídos com janela (`listAppointments` com `status`+`from`/`to`).
  - `AppClientes`: activeSubs (`listSubscriptions`).
  - `AppCRM`: messages (`listWhatsAppMessages`) — filtro manual de unit em memória removido (servidor já filtra).
  - `RetentionCampaignsCard`: messages (`listWhatsAppMessages`).
  - `AppComissoes`: commissions (`listCommissions`) — duplicação `commissionsScoped` em memória removida.
- Smoke tests: 4 endpoints retornam 200 com dados reais. Cross-tenant `customer_id` retorna 404 genérico.
- **Fora desta fase (próximas):**
  - Write paths (mutate*) de CustomerSubscription, Commission, FinancialEntry — ainda usam SDK direto.
  - AppCaixa (CashRegister/FinancialEntry reads) — depende de fase dedicada de Cash.
  - `Customer.filter` em CustomerSubscriptionPanel, AppCRM (customersRaw) e AppDashboard — `listCustomers` da Fase 1 não cobre todos os call sites ainda.

**Fase 6 — Commission writes** ✅ (2026-05-11)
- Criada `functions/mutateCommission` (BFF) com **action semântica única**: `mark_paid`. Justificativa: Commission tem regras que vêm da Professional na hora da conclusão do atendimento (amount, commission_value, commission_type) — frontend NÃO deve editar nada além de status. Genérico `update` aqui seria vetor para fraude (operador inflando própria comissão).
- **Batch atômico (não paralelo)**: aceita até 200 ids em 1 request. Antes, `AppComissoes` disparava `Promise.all(ids.map(update))` — N requests, N audit entries, possibilidade de inconsistência parcial sem visibilidade. Agora: 1 chamada → servidor processa, retorna `{ updated_count, skipped_count, results }`. Falhas individuais (já paga, cross-tenant) viram `skipped` em vez de derrubar o batch.
- Bloqueios server-side:
  - super-admin → 403 USE_MASTER_PANEL.
  - barbeiro / recepcao → 403 FORBIDDEN_ROLE (espelha `canPayCommission` do front).
  - Commission de outra company → entra em `skipped[reason=NOT_FOUND]`, não atualiza nada.
  - Já paga → skipped[ALREADY_PAID] (idempotência: clicar 2x não causa erro nem trava o batch).
- AuditLog único por batch (`PAY_COMMISSION_BATCH`) com metadata contendo requested/updated/skipped + reasons — auditoria limpa em vez de N entries.
- `AppComissoes` migrado: mutation passa por BFF. Mensagens humanas mapeadas. `Promise.all` paralelo eliminado.
- Smoke test: INVALID_ACTION 400, commission_ids_required 400.
- **Fora desta fase**: estorno de comissão já existe em `reverseCommission` (função própria, fluxo diferente, mantida).

**Fase 7 — FinancialEntry create + delete completos** ✅ (2026-05-11)
- `mutateFinancialEntry` ganhou action `create` com mesma blindagem das outras actions: `company_id`/`unit_id` derivados do caller, `origin` forçado para `'manual'` (origens `agendamento`/`comissao` continuam exclusivas dos handlers automáticos `onAppointmentConcluded` e `registerCommission`), allow-list de `entry_kind` e `payment_method`, validação de tenant do `cash_register_id`.
- Capability granular por kind: `entrada`/`saida` → `create_entry`; `sangria` → `sangria`; `suprimento` → `suprimento`. ROLE_DEFAULTS estendido para refletir o mesmo padrão de `lib/cashPermissions.js` (recepcao tem create_entry mas não sangria/suprimento; barbeiro nada).
- `REGISTER_NOT_OPEN` (400) quando tentam lançar em caixa já fechado/fechando — fecha o vetor de "lançamento órfão sem snapshot" mesmo se o frontend não atualizar a UI.
- super-admin → 403 USE_MASTER_PANEL (mesma decisão das outras fases — escritas via master usam impersonação dedicada).
- **Migrações:**
  - `AppCaixa`: `entryCreateMutation` substitui `FinancialEntry.create` direto. Erros mapeados (FORBIDDEN_CAP, REGISTER_NOT_OPEN, justification_required, invalid_amount).
  - `AppFinanceiro`: tanto `createMutation` quanto `deleteMutation` passam pelo BFF (delete usa soft-delete com reason genérica). Última tela usando `FinancialEntry.create`/`.delete` direto migrada.
- Smoke tests: data ausente → 400 data_required; amount negativo → 400 invalid_amount.
- **Resultado**: `FinancialEntry` writes 100% via BFF no frontend. Caminhos de criação automática (`onAppointmentConcluded`, `registerCommission`) seguem inalterados (já são server-side com `origin` lockado).

**Fase 5 — Customer reads restantes + Subscription writes** ✅ (2026-05-11)

5a — Customer reads restantes:
- `listCustomers` ganhou parâmetro `sort` com allow-list (`-created_date`, `-last_appointment_at`, `-last_completed_at`, `-name`, `-total_appointments` e variantes asc). Tentativa de `password_hash` cai silenciosamente no fallback default — não vaza erro.
- `AppDashboard`: `Customer.filter({ company_id })` direto → `listCustomers`.
- `AppCRM`: `Customer.filter({ company_id }, '-last_appointment_at', 1000)` direto → `listCustomers` com `sort: '-last_appointment_at'`. Removido import de `shouldScopeCustomersByUnit` + filtro manual de unit em memória (servidor já filtra).
- Após esta fase, **nenhum read de Customer no app interno** usa SDK direto. Restam só:
  - `CustomerSubscriptionPanel` lê via `listSubscriptions` (não Customer).
  - Read direto em automações server-side (intencional, é SDK as-service-role).

5b — CustomerSubscription writes:
- Criada `functions/mutateSubscription` (BFF) com **actions semânticas** (não generic CRUD): `subscribe`, `cancel`, `pause`, `resume`, `mark_payment`. Justificativa: subscription tem regras de negócio (snapshots do plano, ciclo, uses_remaining) que NÃO devem ser configuráveis pelo frontend. Actions semânticas impedem campos sensíveis de virem do cliente.
- Servidor monta `plan_*_snapshot` lendo do banco — frontend só envia `plan_id`. Vetor antigo (`plan_price_snapshot=0.01` falso) eliminado.
- Bloqueios server-side:
  - barbeiro → 403 FORBIDDEN_ROLE (operação financeira).
  - super-admin → 403 USE_MASTER_PANEL.
  - Subscription com `stripe_subscription_id` → cancel/pause/resume retornam 409 STRIPE_MANAGED_USE_PORTAL (evita desync com Stripe). `mark_payment` segue permitido (é só hint visual).
  - Subscribe duplicada (cliente já tem ativa) → 409 ALREADY_SUBSCRIBED.
  - Cross-tenant (customer/plan/subscription de outra company) → 404 genérico.
  - Plan inativo → 400 PLAN_INACTIVE.
- Migrados 2 call sites:
  - `CustomerSubscriptionPanel`: subscribe/cancel/markPaid mutations agora invocam BFF. Mensagens de erro humanas mapeadas.
  - `OfferPlanModal`: ativação de plano sugerido vai pelo BFF. Removido import de `buildInitialSubscription` (snapshot vem do servidor).
- Smoke tests: INVALID_ACTION 400, cross-tenant 404, `mark_payment` 200 funcional.
- **Fora desta fase:**
  - `customerSubscriptionAction` (cliente final, lado público): continua existindo, é o entry point do cliente. Não migrado para BFF interno porque já é um endpoint server-side com sua própria validação por token.
  - Commission writes (status='pago' em AppComissoes): ainda direto. Próxima fase.
  - FinancialEntry writes: já passam por `mutateFinancialEntry` em AppCaixa/AppFinanceiro — auditar se sobrou algum call site direto.

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