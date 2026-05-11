# 🔒 SECURITY CHECKLIST — O CORTE

Checklist obrigatório para code review de qualquer função backend ou endpoint público.

**Regra de ouro**: se você não consegue marcar todos os itens, NÃO mergeie.

---

## ✅ Para CADA backend function

### Autenticação
- [ ] Endpoint público (sem auth)? Documentado explicitamente no topo do arquivo.
- [ ] Endpoint autenticado? Chama `base44.auth.me()` e rejeita `!user` com 401.
- [ ] Recebe token customizado (ex: customer_token)? Valida expiração antes de aceitar.

### Autorização (RBAC)
- [ ] Chama `getCallerContext(base44, user)` antes de qualquer mutação.
- [ ] Verifica `caller.role` contra lista de roles permitidos (`ensureRole`).
- [ ] Verifica capability granular quando aplicável (`hasCap(caller, 'cash.edit')`).
- [ ] Verifica `caller.is_super_admin` antes de cross-tenant operations.

### Isolamento multi-tenant
- [ ] Toda entidade lida tem check `ensureSameCompany(caller, entity)`.
- [ ] Toda entidade criada tem `company_id = caller.company_id` (não do payload).
- [ ] Filtros sempre incluem `company_id` no `filter()` (não filtra em JS depois).
- [ ] Não usa `Entity.list()` para dados scoped por tenant.

### Isolamento multi-unidade
- [ ] Se entidade tem `unit_id`, verifica `canAccessUnit(caller, entity.unit_id)`.
- [ ] Criação propaga `unit_id` do contexto (não confia em payload aberto).
- [ ] Admin/financeiro têm bypass documentado.

### Validação de input
- [ ] Todos campos obrigatórios verificados antes de qualquer fetch.
- [ ] Strings sanitizadas (`.trim().slice(0, N)`).
- [ ] Números validados (`isFinite`, range, decimais).
- [ ] IDs validados via fetch (não confia que existem).
- [ ] Enums validados contra lista permitida.
- [ ] Preços/valores **SEMPRE** lidos do banco, nunca do payload.

### Service role
- [ ] `base44.asServiceRole` usado **apenas após** RBAC passar.
- [ ] Endpoint público que usa service role tem validação de origem/anti-abuse.
- [ ] Comentário no código explica POR QUE precisa de service role.

### Logs e Audit
- [ ] Log de entrada (`console.log('[functionName] start')`).
- [ ] Log de saída com `user.email`, `target_id`, `result`.
- [ ] Mutações críticas (financeiro, RBAC, billing) criam `AuditLog`.
- [ ] Tentativas bloqueadas chamam `logBlockedAttempt`.

### Idempotência
- [ ] Operação pode ser executada 2x sem efeito colateral? Documentar.
- [ ] Usa chave idempotente (de negócio, não timestamp).
- [ ] Webhook handler? **OBRIGATORIAMENTE** idempotente.

### Rate limiting / Anti-abuse
- [ ] Endpoint público tem rate limit por IP ou identificador estável.
- [ ] Limite documentado (ex: 5 bookings/hora/telefone).
- [ ] Limite ajustável via secret (não hardcoded).

### Stripe específico
- [ ] Webhooks validam signature contra **todos** os secrets configurados.
- [ ] Webhook ignora eventos `livemode` errado **e** registra alerta.
- [ ] PaymentIntent inclui `metadata.base44_app_id`, `metadata.company_id`, `metadata.payment_kind`.
- [ ] PaymentIntent usa `idempotencyKey` determinística.
- [ ] Stripe API errors são logados com `error.message` E `error.stack`.

---

## ✅ Para CADA frontend page

### Permissões UI
- [ ] Hook de permissão consultado antes de mostrar botão de ação.
- [ ] Rota envolvida em `<PrivateRoute>` + `<RoleRoute roles={[...]}>`.
- [ ] Estados sem permissão mostram empty state amigável (não tela quebrada).

### Dados sensíveis
- [ ] Não loga `user.email`, `customer_phone`, tokens em `console.log` em produção.
- [ ] Não armazena tokens em URL.
- [ ] LocalStorage só guarda IDs e preferências, nunca tokens de pagamento.

### Multi-unidade
- [ ] Toda query inclui `activeUnitId` no `queryKey`.
- [ ] Dados scopados por unidade passam por `filterByUnit`.
- [ ] Estados "Todas as unidades" são read-only (não permite criar).

### Forms
- [ ] Validação client-side **espelhada** no backend (defesa em profundidade).
- [ ] Submit bloqueia botão durante mutation (`isPending`).
- [ ] Erros do backend exibidos amigavelmente ao usuário.

---

## ✅ Para CADA entidade nova

- [ ] Schema tem `company_id` (obrigatório para tenant scoping).
- [ ] Schema tem `unit_id` quando relevante (multi-unit).
- [ ] Schema tem `created_by` se mutação humana.
- [ ] Campos sensíveis (preços, status) têm descrição explicando regras.
- [ ] Documentado em `docs/HARDENING_ROADMAP.md` se introduz race condition.

---

## ✅ Checklist de deploy de mudança crítica

Antes de fazer merge de qualquer P0:

- [ ] PR linka issue da auditoria (ex: "Fixa C1 do AUDIT.md").
- [ ] Smoke test manual descrito no PR (passos reproduzíveis).
- [ ] Smoke test executado em test mode do Stripe.
- [ ] Rollback plan documentado no PR.
- [ ] `SECURITY_CHECKLIST.md` revisado para a função tocada.
- [ ] `RACE_CONDITIONS.md` atualizado se aplicável.
- [ ] Logs novos foram revisados em produção depois de 1h do deploy.

---

## ✅ Checklist de operação semanal

Engenheiro on-call deve, **toda segunda-feira**:

- [ ] Revisar `SystemAlert` severity=critical das últimas 7 dias.
- [ ] Revisar `AuditLog` action=`BLOCKED_ATTEMPT` (detecção de abuso).
- [ ] Revisar dashboard Stripe (taxa de pagamento, falhas).
- [ ] Validar que `STRIPE_ENVIRONMENT` bate com prod/test.
- [ ] Conferir taxa de double-booking via UserEvent.
- [ ] Conferir caixas com `status='fechando'` há mais de 1h (manualmente reconciliar).

---

## Codigos de erro padronizados

Sempre retornar nesse formato:
```json
{ "success": false, "error": "CODE_IN_UPPER_SNAKE_CASE", "message": "msg amigável opcional" }
```

| Código | Significado | Quando usar |
|---|---|---|
| `UNAUTHORIZED` | sem token | 401 |
| `USER_INACTIVE` | TeamMember.active=false | 403 |
| `NO_TEAM_MEMBER` | user não tem TeamMember | 403 |
| `FORBIDDEN_ROLE` | role não permitido | 403 |
| `FORBIDDEN_CAP` | capability granular faltando | 403 |
| `FORBIDDEN_TENANT` | tentou acessar outra empresa | 403 |
| `FORBIDDEN_UNIT` | tentou acessar outra unidade | 403 |
| `COMPANY_BLOCKED` | empresa bloqueada por billing | 403 |
| `NOT_FOUND` | recurso não existe OU não pertence ao tenant (não distingue) | 404 |
| `ALREADY_EXISTS` | duplicidade | 409 |
| `SLOT_TAKEN` | race de booking | 409 |
| `VALIDATION_ERROR` | input inválido | 400 |
| `INTERNAL_ERROR` | erro inesperado (logar stack) | 500 |

Nunca expor mensagem técnica em produção. Sempre logar com `console.error`.