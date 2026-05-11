# 🏗️ ENGINEERING FOUNDATION SPRINT

**Status**: planejado
**Início alvo**: pós-Fase 7 do BFF (sistema já estabilizado)
**Owner**: engenharia
**Duração estimada**: 2 sprints (10 dias úteis)

---

## Por que agora

O sistema atravessou:
- P0.1–P0.6 (race conditions, RBAC, Stripe env, audit)
- Sprints A/B/C (auth, isolamento, performance)
- Sprint M1 (segurança residual: tokens server-side, sanitize, CSV-safe)
- BFF Fases 1–7 (Customer, Appointment, Subscription, Commission, FinancialEntry)

**Resultado:** os bugs graves caíram. Mas o custo de regressão subiu — cada patch novo arrisca reabrir bug antigo porque NÃO existe rede de testes. E pequenos vazamentos de convenção (process.env vs Deno.env, parse de data, rounding) começam a aparecer como "papercuts" recorrentes.

**Filosofia desta sprint:** parar de adicionar features e investir em **engineering maturity**. Sem isso, daqui pra frente cada P0 novo vai custar 2x mais para validar.

---

## Sequência (ordem de execução)

| # | Item | Origem | Prioridade | Status |
|---|---|---|---|---|
| F1 | Infra de testes (Vitest + helpers Base44) | B6 | 🟠 alta | ⏳ |
| F2 | `lib/env.js` — centralização de Deno.env / import.meta.env | B5 | 🟠 alta | ⏳ |
| F3 | Error codes server-side + tradutor no frontend | B2 | 🟡 média | ⏳ |
| F4 | `lib/dates.js` — wrapper `parseISO` (fim do `'T00:00:00'`) | B3 | 🟡 média | ⏳ |
| F5 | `lib/money.js` — `roundBRL`, validações decimais | B4 | 🟡 média | ⏳ |
| F6 | `useMemo(navItems)` no AppLayout | B1 | 🟢 baixa | ⏳ |
| F7 | Guardrails ESLint (ban process.env, ban Entity direto) | B5+novos | 🟠 alta | ⏳ |
| F8 | Convenções: naming, DTOs, response shape | foundation | 🟡 média | ⏳ |

> Ordem recomendada: F1 → F2 → F7 → F3/F4/F5 (paralelizáveis) → F6 → F8.
> Justificativa: testes primeiro (rede de segurança), depois env+guardrails (impede regressão), depois helpers (refactor com cobertura).

---

## F1 — Infra de testes (B6)

**Stack escolhida:** Vitest (mesmo ecossistema do Vite, zero config extra).

**Estrutura de pastas:**
```
tests/
  unit/
    lib/           ← scheduling, dates, money, env, customerLifecycle
    components/    ← BookingPaymentStep, KpiCard, FilterSelect
  integration/
    backend/       ← chamadas a funções (mockando base44 SDK)
  smoke/
    flows/         ← booking público, fechamento caixa, comissão
  helpers/
    mockBase44.js  ← stub do SDK + entities in-memory
    fixtures/      ← dados sintéticos (company, customer, appointment)
```

**Mock central** (`tests/helpers/mockBase44.js`):
- In-memory store por entity (Map<id, record>).
- `entities.X.create/get/filter/update/delete` operando sobre o store.
- `auth.me()` configurável por teste.
- `functions.invoke` despachando para handlers locais (testar BFF sem Deno).
- `asServiceRole` aliasado para o mesmo store, mas com flag para asserts de isolamento.

**Fluxos críticos cobertos no smoke (mínimo viável):**

1. **Booking público (Pix)**: lock atômico, sanitização, Stripe mock, slot consumido.
2. **Booking público duplo (race)**: 2 calls simultâneas no mesmo slot → 1 vence, 1 retorna 409.
3. **Fechamento de caixa**: `aberto → fechando → fechado`, payment_breakdown_detail correto.
4. **Comissão batch**: pagar 50 comissões em 1 request, skipped[ALREADY_PAID] idempotente.
5. **RBAC cross-tenant**: caller da company A tenta `mutateAppointment` em appointment da B → 404 genérico.
6. **Subscription**: subscribe + 5 usos + cancel → uses revertidos.
7. **Sanitização**: `customerAuth.signup` com HTML no name → strip + 200.

**Cobertura alvo (realista):** 60% em `lib/`, 40% nas backend functions críticas, 0% nos componentes UI complexos (não vale a pena hoje).

**Comando:**
```bash
npm run test         # vitest watch mode
npm run test:ci      # vitest run + coverage
npm run test:smoke   # só smoke, rápido (< 30s)
```

**Deliverable F1:**
- `vitest.config.js` + `package.json` scripts.
- `tests/helpers/mockBase44.js` funcional.
- 10 smoke tests passando.
- README curto em `tests/README.md` com padrões.

---

## F2 — `lib/env.js` (B5)

**Problema:** `Deno.env.get(...)` espalhado em ~30 functions, `import.meta.env.VITE_*` no frontend, defaults inconsistentes, falhas silenciosas em produção quando uma secret some.

**Solução:** wrapper único com schema declarativo.

**Backend (`functions/_lib/env.js` — replicado inline por ser deploy independente):**
```js
const SCHEMA = {
  STRIPE_SECRET_KEY:        { required: true,  validate: v => v.startsWith('sk_') },
  STRIPE_PUBLISHABLE_KEY:   { required: true,  validate: v => v.startsWith('pk_') },
  STRIPE_WEBHOOK_SECRET:    { required: true },
  STRIPE_ENVIRONMENT:       { required: false, default: 'test', enum: ['test','live'] },
  ZAPI_INSTANCE_ID:         { required: false },
  ZAPI_TOKEN:               { required: false },
  ZAPI_CLIENT_TOKEN:        { required: false },
  BOOKING_RATE_LIMIT_PER_HOUR: { required: false, default: 5, parse: Number },
  SLOT_RESERVATION_TTL_SECONDS: { required: false, default: 90, parse: Number },
  ENABLE_SLOT_LOCK:         { required: false, default: true, parse: v => v !== 'false' },
};

export function getEnv(name) {
  const spec = SCHEMA[name];
  if (!spec) throw new Error(`Unknown env: ${name}`);
  const raw = Deno.env.get(name);
  if (raw == null || raw === '') {
    if (spec.required) throw new Error(`Missing required env: ${name}`);
    return spec.default;
  }
  if (spec.enum && !spec.enum.includes(raw)) {
    throw new Error(`Invalid ${name}: expected ${spec.enum.join('|')}, got ${raw}`);
  }
  if (spec.validate && !spec.validate(raw)) {
    throw new Error(`Invalid ${name}: failed validation`);
  }
  return spec.parse ? spec.parse(raw) : raw;
}
```

**Frontend (`src/lib/env.js`):**
- Mesmo padrão para `import.meta.env.VITE_*`.
- Schema separado (frontend só vê secrets publicáveis).

**Migração:**
- 1 PR por arquivo, ~30 PRs (ou batch de 10 functions por PR).
- ESLint rule (F7) bloqueia `Deno.env.get` / `process.env` / `import.meta.env.VITE_*` direto fora de `lib/env.js`.

**Deliverable F2:**
- `functions/_lib/env.js` (template a copiar inline em cada function — Base44 não permite local imports em functions).
- `src/lib/env.js` para frontend.
- Migração dos 5 endpoints Stripe primeiro (maior risco).
- Docs: `docs/conventions/ENV.md`.

---

## F3 — Error codes (B2)

**Hoje:** backend retorna `{ error: 'Já existe uma conta com este e-mail. Faça login.' }` — string PT-BR.

**Alvo:**
```js
// backend
return Response.json({
  error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'fallback humano se quiser' }
}, { status: 409 });

// frontend
import { translateError } from '@/lib/errors';
toast.error(translateError(err.code));  // pt-BR/en/es no futuro
```

**Catálogo central** (`src/lib/errorCodes.js`):
```js
export const ERROR_MESSAGES = {
  EMAIL_ALREADY_REGISTERED: 'Já existe uma conta com este e-mail. Faça login.',
  SLOT_TAKEN: 'Este horário acabou de ser reservado. Escolha outro.',
  FORBIDDEN_ROLE: 'Você não tem permissão para essa ação.',
  // ...
};
```

**Migração:**
- BFF functions novas (Fases 1–7) já usam codes — só falta o catálogo de tradução.
- Functions antigas migram incrementalmente quando forem tocadas por outro motivo (no rush).

**Deliverable F3:**
- `src/lib/errorCodes.js` + `translateError(code, fallback)`.
- Mapeamento de todos os codes já em uso (audit dos `Response.json({ error: ...})` no repo).
- Convenção documentada: `SCREAMING_SNAKE_CASE`, prefixo opcional por domínio (`PAYMENT_*`, `BOOKING_*`).

---

## F4 — `lib/dates.js` (B3)

**Problema:** `new Date('2026-05-11T00:00:00')` interpreta como local time em alguns engines, UTC em outros. Hack `'T00:00:00'` espalhado pega DST + export errado.

**Solução:** wrapper único usando `date-fns` (já instalado).

```js
// src/lib/dates.js
import { parseISO, format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function parseDate(input) {
  if (input instanceof Date) return input;
  if (!input) return null;
  // ISO completa
  if (input.includes('T')) return parseISO(input);
  // YYYY-MM-DD → meia-noite local, NÃO UTC
  const [y, m, d] = input.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(d, pattern = 'dd/MM/yyyy') {
  const date = parseDate(d);
  return date ? format(date, pattern, { locale: ptBR }) : '';
}

export function dayRange(d) {
  const date = parseDate(d);
  return { start: startOfDay(date), end: endOfDay(date) };
}
```

**ESLint rule** (F7): banir `new Date(string)` direto, forçar `parseDate()`.

**Deliverable F4:**
- `src/lib/dates.js` + 8 helpers (parse, format, range, addDays, isToday, etc.).
- Migração dos call sites com `'T00:00:00'` (grep: ~15 locais).

---

## F5 — `lib/money.js` (B4)

**Problema:** `price * 0.4` para comissão pode gerar `12.799999999`. Rounding ad-hoc espalhado.

**Solução:** helpers decimal-safe.

```js
// src/lib/money.js
export function roundBRL(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calcCommission(price, type, value) {
  const p = Number(price) || 0;
  if (type === 'percent') return roundBRL(p * (Number(value) / 100));
  return roundBRL(Number(value));
}

export function validatePrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return { valid: false, error: 'invalid_price' };
  // 2 casas decimais BRL
  if (Math.round(n * 100) !== n * 100) return { valid: false, error: 'precision_exceeded' };
  return { valid: true, value: roundBRL(n) };
}
```

**Aplicar em:**
- `registerCommission`, `consumeSubscriptionUse`, `closeCashRegister`, `createBookingPaymentIntent`.
- Frontend: `FinancialExport`, `AppFinanceiro`, `AppComissoes`.

**Deliverable F5:**
- `src/lib/money.js` + 5 helpers.
- Migração das ~10 ocorrências de `Math.round(... * 100) / 100`.

---

## F6 — `useMemo(navItems)` no AppLayout (B1)

**Problema:** `navItems` recalculado em todo re-render do AppLayout, mesmo quando `teamRole` + `company` + `plan` não mudaram. Multi-unit + menu grande começa a pesar (~80ms render no mobile mid-range).

**Solução:** envolver o filtro em `useMemo`:
```js
const navItems = useMemo(() => {
  const allowed = ...;
  return navItemsAll.filter(...).filter(...);
}, [teamRole?.role, company?.feature_overrides, plan?.features]);
```

**Deliverable F6:** 1 PR cirúrgico, ~10 linhas. Validar visualmente (sem regressão).

---

## F7 — Guardrails ESLint (B5 + manutenção contínua)

**Regras a adicionar** (`.eslintrc.cjs`):

```js
{
  rules: {
    // Banir uso direto de env vars fora do helper
    'no-restricted-properties': ['error',
      { object: 'process', property: 'env',
        message: 'Use getEnv() de @/lib/env (frontend) ou functions/_lib/env (backend).' },
      { object: 'Deno', property: 'env',
        message: 'Use getEnv() de functions/_lib/env.' },
    ],
    // Banir leituras de Entity direto no frontend (forçar passar pelo BFF)
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['@/api/base44Client'],
        importNamePattern: '^(Customer|Appointment|FinancialEntry|Commission|CustomerSubscription)$',
        message: 'Não acesse entities tenant-sensitive direto. Use as funções BFF (list*, mutate*).'
      }]
    }],
    // Banir new Date(string) — forçar parseDate
    'no-restricted-syntax': ['error', {
      selector: "NewExpression[callee.name='Date'][arguments.length=1][arguments.0.type='Literal']",
      message: 'Use parseDate() de @/lib/dates em vez de new Date(string).'
    }],
  }
}
```

**Allow list** (override por arquivo):
- `src/lib/env.js`: permite `import.meta.env`.
- `functions/_lib/env.js`: permite `Deno.env`.
- `src/api/base44Client.js`: permite import direto (é o setup).
- Server-side automations (`onAppointmentConcluded`, jobs): allow Entity direto.

**CI:** `npm run lint` no preview/deploy. PR não merga se quebrar regra.

**Deliverable F7:** `.eslintrc` atualizado + 1 PR de migração das violações existentes.

---

## F8 — Convenções (foundation)

**Documento `docs/conventions/README.md`** com:

### Naming
- Backend functions: `verbResource` camelCase (`listCustomers`, `mutateAppointment`).
- BFF actions semânticas: `subscribe`, `cancel`, `mark_paid` — NUNCA `update_generic`.
- Error codes: `SCREAMING_SNAKE_CASE`, prefixo opcional (`PAYMENT_FAILED`).
- React components: `PascalCase` arquivo, default export.
- Hooks: `useXxx` minúsculo.

### Response shape (BFF)
**Sucesso:**
```json
{ "success": true, "data": { ... }, "meta": { "count": 42 } }
```

**Erro:**
```json
{ "error": { "code": "FORBIDDEN_ROLE", "message": "..." } }
```

Status HTTP:
- 200: ok.
- 400: input inválido.
- 401: sem auth.
- 403: auth ok, permissão negada.
- 404: não existe (ou cross-tenant — não vaza diferença).
- 409: conflict (race, duplicate).
- 429: rate limit.
- 5xx: bug nosso.

### DTOs server → frontend
- Snake_case nos campos (consistente com schema das entities).
- Datas sempre ISO 8601 UTC.
- Money sempre BRL com 2 casas (`12.50`, nunca `12.5`).

### Frontend: data fetching
- `useQuery` para reads (NUNCA `useState + useEffect + fetch`).
- `useMutation` para writes.
- `queryKey` padrão: `['domain', 'list'|'detail', filters]`.

**Deliverable F8:** 1 doc de ~300 linhas, linkado no README principal.

---

## Sprints

### Sprint 1 (5 dias úteis)
- F1 (2 dias) — infra Vitest + 10 smoke tests.
- F2 (1.5 dia) — `lib/env.js` backend+frontend, migração das 5 functions Stripe.
- F7 (1 dia) — ESLint rules + migração das violações que sobrarem.
- Buffer (0.5 dia).

### Sprint 2 (5 dias úteis)
- F4 (1 dia) — `lib/dates.js`.
- F5 (1 dia) — `lib/money.js`.
- F3 (1 dia) — error codes + catálogo.
- F6 (0.5 dia) — `useMemo` no AppLayout.
- F8 (1 dia) — docs de convenções.
- Buffer (0.5 dia).

---

## Critérios de "pronto"

Cada F só fecha quando:
- [ ] Código mergeado.
- [ ] CI passando (lint + testes).
- [ ] Convenção documentada em `docs/conventions/`.
- [ ] Pelo menos 1 PR seguinte usou o helper novo (validação prática).

---

## Métricas de sucesso pós-foundation

- **Cobertura mínima**: 60% em `src/lib/`, 40% em `functions/` críticas.
- **Zero violações** de `Deno.env`/`process.env` fora dos helpers.
- **CI**: lint + test rodando em todo PR (futuro: integrar com pipeline de deploy).
- **Tempo de validação de patch novo**: cai de ~30min manual → 5min CI.
- **Regressões em produção**: meta de 0 nos próximos 30 dias após F1 estar completo.

---

## O que NÃO está nesta sprint

- Migração para TypeScript (custo alto, ROI duvidoso agora).
- Storybook / visual regression (cosmetic, baixa prioridade).
- E2E browser tests (Playwright) — depois que os smoke estiverem maduros.
- i18n efetivo — só preparar infra de error codes, tradução real fica para quando houver demanda real.
- Refactor de componentes grandes (`PublicBooking.jsx`, `AppCaixa.jsx`) — só com cobertura de teste primeiro.

---

## Relação com o HARDENING_ROADMAP

Esta sprint é o **passo seguinte natural** ao HARDENING. Hardening fechou os buracos de segurança e race. Foundation fecha os buracos de **manutenibilidade** — que ainda não viraram incidente, mas vão virar se não atacar agora.

Depois desta sprint, abre espaço para voltar a features (multi-idioma, mobile nativo, analytics avançado) com base sólida.