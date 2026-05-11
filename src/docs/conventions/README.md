# Convenções de engenharia — Foundation Sprint F8

> Versão 1.0 — última atualização: 2026-05-11
> Owner: engenharia
> Status: ativo

Este documento é a **fonte da verdade** sobre como código novo é escrito neste app. Toda decisão arquitetural que não estiver aqui é "pendente de definição" — abrir issue antes de codar.

---

## 1. Naming

### Backend functions
- Formato: `verbResource` em camelCase.
- ✅ `listCustomers`, `mutateAppointment`, `closeCashRegister`.
- ❌ `customer_list`, `do_payment`, `handler_v2`.

### BFF actions semânticas
Funções "mutate*" que aceitam `action` no payload devem usar **verbos de domínio**, nunca CRUD genérico.
- ✅ `subscribe`, `cancel`, `mark_paid`, `revert`.
- ❌ `update`, `patch`, `set_status`.

Justificativa: actions semânticas restringem o que pode ser alterado e evitam que o frontend mande campos arbitrários.

### Error codes
- Formato: `SCREAMING_SNAKE_CASE`.
- Prefixo opcional por domínio: `PAYMENT_FAILED`, `BOOKING_SLOT_TAKEN`.
- Listadas em `lib/errorCodes.js` (frontend) e replicadas via `errorResponse()` no backend.

### Componentes React
- Arquivo: `PascalCase.jsx`.
- Default export com mesmo nome do arquivo.
- Hooks em `hooks/useXxx.js` (camelCase, prefixo `use`).

### Entities
- Schema em `entities/<Name>.json`, `PascalCase` singular.
- Campos sempre `snake_case`.

---

## 2. Response shape (BFF)

### Sucesso
```json
{
  "success": true,
  "data": { ... },          // pode ser omitido se a resposta for trivial
  "meta": { "count": 42 }   // opcional: pagination, totals
}
```

### Erro (novo padrão — F3)
```json
{
  "error": {
    "code": "FORBIDDEN_ROLE",
    "message": "Mensagem humana opcional como fallback"
  }
}
```

### Status HTTP
| Status | Quando usar |
|---|---|
| 200 | Ok, ou erro de negócio "esperado" (ex: skipped batches). |
| 400 | Input inválido sintaticamente (campo faltando, formato errado). |
| 401 | Sem autenticação. |
| 403 | Autenticado mas sem permissão. |
| 404 | Recurso não existe **OU** cross-tenant (não vaza diferença). |
| 409 | Conflict (race, duplicate, slot ocupado). |
| 429 | Rate limit. |
| 5xx | Bug nosso (não usar para validação). |

---

## 3. DTOs

### Server → Frontend
- Snake_case nos campos (espelha o schema da entity).
- Datas sempre ISO 8601 UTC (com `Z`).
- Money: `Number` com 2 casas decimais (`12.50`, nunca `12.5` nem string).
- Boolean: `true`/`false` literal, nunca `"true"`/`"yes"`.

### Frontend → Server
- Mesmo formato. Server **valida e ignora** campos fora do allow-list.

### Allow-list nos `mutate*`
Toda function `mutate*` deve declarar explicitamente quais campos aceita do client. Cliente NUNCA seta:
- IDs de tenant (`company_id`, `unit_id`) — server deriva do caller.
- Campos de auditoria (`created_by`, `edited_at`).
- Campos derivados (`commission_created`, `paid_online`, `payment_intent_id`, tokens).
- Origens de sistema (`origin='agendamento'`, `origin='comissao'`).

---

## 4. Data fetching (frontend)

### Reads
- **SEMPRE** `useQuery` (`@tanstack/react-query`).
- ❌ Nunca `useState + useEffect + fetch`.
- `queryKey` padrão: `['domain', 'list'|'detail', filters]`.
- Ex: `['customers', 'list', { company_id, lifecycle_status }]`.

### Writes
- **SEMPRE** `useMutation` + `invalidateQueries` no `onSuccess`.
- Mensagens de erro: `translateError(err)` de `@/lib/errorCodes`.

### Cache
- `staleTime` default: 30s para listas, 5min para refs (Plan, Service categories).
- `invalidateQueries` específico — nunca `queryClient.invalidateQueries()` sem chave.

### Entities tenant-sensitive
Frontend **não acessa diretamente** as seguintes entities — vai por BFF:
- `Customer` → `listCustomers` / `mutateCustomer`
- `Appointment` → `listAppointments` / `mutateAppointment`
- `FinancialEntry` → (read direto OK por enquanto) / `mutateFinancialEntry`
- `Commission` → `listCommissions` / `mutateCommission`
- `CustomerSubscription` → `listSubscriptions` / `mutateSubscription`

Exceções: páginas master (super-admin), automations server-side, e read de entities não-sensitive (`Service`, `Professional`, `Plan`, `Unit`).

---

## 5. Estado e formulários

### Estado local
- `useState` para UI local.
- `useReducer` apenas se houver 3+ estados acoplados.
- Context **somente** para auth, theme, active unit. Resto evita.

### Formulários
- `react-hook-form` para forms com 3+ campos ou validação complexa.
- `useState` simples para forms triviais (search, filtro único).

---

## 6. Estilos

- Tailwind utility-first.
- Cores via tokens (`bg-primary`, `text-foreground`) — nunca hex hard-coded no JSX, exceto cores de status definidas em `lib/statusTokens.js`.
- Spacing padrão: múltiplos de 4 (gap-2, gap-4, gap-6, gap-8).
- Sombras: `shadow-[var(--shadow-sm)]` / `-md` / `-lg` (premium tokens em `index.css`).
- Animações de transição: ≤ 200ms (`duration-200`).

---

## 7. Comentários e documentação

### Quando comentar
- ✅ **Why** (motivação, decisão arquitetural, edge case).
- ✅ Referência a docs/issues (`Ver docs/RACE_CONDITIONS.md §1`).
- ❌ **What** óbvio (`// incrementa contador`).

### JSDoc
- Em **helpers de `lib/`**: obrigatório no top-level + funções públicas.
- Em componentes: opcional — props complexas merecem.

---

## 8. Helpers centralizados (Foundation Sprint)

| Concern | Helper | Importar de |
|---|---|---|
| Env vars (frontend) | `getEnv()` | `@/lib/env` |
| Env vars (backend) | bloco inline `getEnv` | `functions/_envInline.md` |
| Datas | `parseDate`, `formatDate`, `dayRange` | `@/lib/dates` |
| Dinheiro | `roundBRL`, `calcCommission`, `validatePrice` | `@/lib/money` |
| Erros | `translateError`, `errorResponse` | `@/lib/errorCodes` |
| CSV seguro | `csvCell`, `buildCsv` | `@/lib/csvSafe` |
| Permissões role | `ROLE_PERMISSIONS`, `hasCapability` | `@/lib/rolePermissions`, `@/lib/cashPermissions` |
| Feature gate | `hasFeature` | `@/lib/featureGate` |
| Unit scoping | `STRICT_UNIT_ISOLATION` flag | `@/lib/unitFilter` |

**Regra:** se você está prestes a reescrever lógica de uma dessas categorias, **pare** e use o helper. Se o helper não cobre seu caso, **estenda o helper** em vez de duplicar inline.

---

## 9. Testes

Ver `tests/README.md`. Resumo:
- Testes de `lib/` em `tests/unit/lib/` — alvo 60%+ de cobertura.
- Testes de mock em `tests/integration/`.
- Runner: `runFoundationTests` (backend function, chamada via dashboard).

---

## 10. Segurança baseline

Toda nova backend function que toca dados de tenant DEVE:
- ✅ Resolver `caller` via `base44.auth.me()` no início.
- ✅ Verificar `caller.company_id === target.company_id` antes de ler/escrever.
- ✅ Retornar 404 genérico para cross-tenant (nunca 403 — não vaza existência).
- ✅ Verificar role + capability quando aplicável.
- ✅ Bloquear super-admin direto → forçar uso do master panel.
- ✅ Usar `AuditLog` para mudanças relevantes (financeiro, permissões, status).
- ✅ Sanitizar todo input vindo de payload público (usar `_sanitizeText` ou similar).

Ver `docs/SECURITY_CHECKLIST.md` para o checklist completo.

---

## 11. O que pedir review extra

Antes de mergear, pedir review específica se:
- Alterando um helper de `lib/` (impacta todos os consumidores).
- Tocando em `mutateAppointment` / `closeCashRegister` / `stripeWebhook` (alta criticidade).
- Adicionando um campo novo em entity já populada (migração).
- Mudando contratos de BFF function (quebra clients existentes).
- Mexendo em `App.jsx` (rotas).

---

## Histórico

- **v1.0** (2026-05-11): primeira versão, derivada do Foundation Sprint.