# E2E Testing — Infraestrutura de Tenants de Teste

> **Status:** Produção • **Owner:** Engenharia • **Última revisão:** 2026-05

Este documento descreve a infraestrutura **determinística** de tenants E2E
usada por Playwright, Cypress, smoke tests e suites de regressão. Ela
**não interfere** com produção e **não compartilha estado** com a `demo`.

---

## 1. Arquitetura

```
lib/testing/testTenantFactory.js   → constantes determinísticas (frontend + docs)
functions/seedTestTenant           → cria/upsert do tenant + dados
functions/resetTestTenant          → atalho: seed com reset=true
functions/deleteTestTenant         → remove TUDO do tenant E2E
docs/E2E_TESTING.md                → este arquivo
```

### Por que functions separadas, e não importar a factory?
Backend functions do Base44 rodam em sandboxes Deno isolados. **Imports locais
são proibidos.** Por isso a "factory" só vive em `lib/` como constantes para o
**frontend** (helpers Playwright). A lógica de mutação é replicada inline em
cada function, com as mesmas constantes literais (single source of truth
documentado).

### Demo vs E2E
| Tipo | Slug | Objetivo | Volatilidade |
|---|---|---|---|
| `demo` | varia | comercial / visual | alta — populada via `generateDemoData` para apresentação |
| `e2e`  | `e2e-*` | técnico / determinístico | total — recriada a cada pipeline |

**Nunca misture os dois.** Toda entidade E2E carrega prefixo `[E2E]` no nome.

---

## 2. Endpoints

### `POST /functions/seedTestTenant`
Provisiona ou atualiza o tenant E2E.

```json
{ "slug": "e2e-barbershop", "reset": false }
```

- `slug` (opcional) — default `e2e-barbershop`. **DEVE começar com `e2e-`**.
- `reset` (opcional) — quando `true`, apaga TODOS os dados associados antes de recriar.

Resposta:
```json
{
  "ok": true,
  "mode": "super_admin",
  "elapsed_ms": 1840,
  "company_id": "abc123",
  "owner_email": "e2e@teste.com",
  "summary": {
    "plan": { "id": "...", "name": "[E2E] Plano Enterprise Teste", "features": 14 },
    "customers": [ { "id": "...", "name": "[E2E] Ana Silva", ... } ],
    "appointments": 6,
    "cash_register_id": "...",
    "active_subscription_id": "..."
  }
}
```

### `POST /functions/resetTestTenant`
Atalho semântico para `seedTestTenant({ reset: true })`. Útil em pipelines CI
onde quer expressar a intenção "limpe e refaça".

### `POST /functions/deleteTestTenant`
Apaga **completamente** o tenant E2E (Company + 25+ entidades dependentes).
Use em teardown de suites ou quando reciclar slugs.

---

## 3. Segurança

Três camadas de proteção:

1. **Authorization** — chamador precisa ser:
   - `user.role === 'admin'` (super admin Base44 platform), **ou**
   - servidor com `Deno.env.get('ALLOW_E2E_SEED') === 'true'` (CI/staging).
   - Em produção, defina **NÃO** definir essa env. Caller anônimo recebe `403`.

2. **Slug guard** — `slug` **deve começar com `e2e-`**.
   Qualquer outro valor retorna `400` antes de qualquer mutação.
   Isso impede que um caller mal-configurado apague produção.

3. **Observabilidade** — toda tentativa rejeitada gera `SecurityEvent`
   `privilege_escalation_attempt` (severity `critical`). Toda execução
   bem-sucedida gera `AuditLog` com `action ∈ { E2E_SEED_CREATED,
   E2E_SEED_RESET, E2E_SEED_DELETED }`.

### Configuração CI/CD
```bash
# Staging / preview environments
ALLOW_E2E_SEED=true

# Production — NUNCA definir essa variável
# (o endpoint continua acessível para super_admin com fim de debug)
```

---

## 4. Dados determinísticos

Toda execução de `seedTestTenant` (sem `reset`) converge para o **mesmo
estado final** — chave única por entidade:

| Entidade | Chave de idempotência |
|---|---|
| `Company` | `slug` |
| `Plan` (E2E) | `name = "[E2E] Plano Enterprise Teste"` |
| `Customer` | `(company_id, email)` |
| `Service` | `(company_id, name)` |
| `Professional` | `(company_id, name)` |
| `Appointment` | `(company_id, customer_id, scheduled_at)` |
| `FinancialEntry` | `(company_id, description)` — descrição contém `[E2E:tag]` |
| `CashRegister` | apenas 1 aberto por empresa (claim único) |
| `CustomerSubscription` | `(company_id, customer_id, plan_id)` |
| `CustomerConsent` | `(company_id, customer_id, consent_type)` |

### Conjunto seedeado
- **1 empresa** ativa, sem bloqueios (`status=active`, `subscription_status=active`, `is_blocked_by_billing=false`, `onboarding_completed=true`).
- **1 plano** com TODAS as features ativas — incluindo `crm_retention`, `cashier`, `financial_dashboard`, `subscriptions`, `advanced_reports`, `ai_growth`, `commissions`, `reviews`, `team_management`, `combos`, `analytics`.
- **5 clientes** fixos — 2 começando com "Ana" (cobre teste de pesquisa "ana"):
  - `[E2E] Ana Silva`
  - `[E2E] Ana Paula`
  - `[E2E] João Pedro`
  - `[E2E] Carlos Henrique`
  - `[E2E] Fernanda Lima`
- **1 barbeiro** (`[E2E] Barbeiro Teste`).
- **3 serviços** (`Corte`, `Barba`, `Corte + Barba`).
- **6 agendamentos** cobrindo todos os estados:
  - 2 concluídos com pagamento (gera histórico, métricas, ticket médio)
  - 1 cancelado
  - 1 confirmado futuro
  - 1 agendado (pendente, hoje +2h)
  - 1 cancelado por falha de pagamento online
- **1 caixa aberto** com 3 entradas + 1 saída (saldo determinístico = 100 + 50 + 75 + 35 − 20 = R$ 240).
- **1 assinatura ativa** para Ana Silva (`uses_remaining=3`).
- **5 consentimentos LGPD** + 1 `PrivacyAuditLog` inicial.

### Senha de cliente (área pública)
Todos os customers E2E recebem `password_hash` derivado de:
```
E2E#StrongPassword2026
```
Hashing: PBKDF2-SHA256, 100k iterations, salt 16 bytes — **mesmo pipeline
de `functions/customerAuth`** (compatível com login real).

### Login do admin (`/app`)
> ⚠️ **Importante:** Admin do `/app` é uma `User` do Base44 platform —
> **não pode ser criada via API**. A Company seedada usa
> `owner_email = "e2e@teste.com"`, mas você precisa convidar manualmente
> esse email como super_admin **uma vez** na sua workspace Base44 e fazer
> login via fluxo padrão da plataforma. A partir daí, a User existe e a
> sessão é estável.

---

## 5. Uso em Playwright / Cypress

### Playwright (recomendado)
```js
import { test, expect } from '@playwright/test';
import { resetE2ETenant, E2E_TENANT, E2E_CUSTOMER_PASSWORD } from '@/lib/testing/testTenantFactory';

test.beforeEach(async ({ page }) => {
  // Reseta tenant antes de cada teste — baseline conhecido
  await page.evaluate(async () => {
    const { base44 } = await import('/api/base44Client');
    await base44.functions.invoke('seedTestTenant', {
      slug: 'e2e-barbershop',
      reset: true,
    });
  });
});

test('cliente faz login na área pública', async ({ page }) => {
  await page.goto(`/cliente/${E2E_TENANT.slug}/login`);
  await page.fill('input[name="email"]', 'ana.silva.e2e@teste.com');
  await page.fill('input[name="password"]', E2E_CUSTOMER_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/cliente\/e2e-barbershop$/);
});
```

### Padrão sugerido — global setup
```js
// playwright.config.js
import { defineConfig } from '@playwright/test';
export default defineConfig({
  globalSetup: './tests/e2e/global-setup.js',  // cria tenant uma vez
  globalTeardown: './tests/e2e/global-teardown.js', // deleta no final
});
```

```js
// tests/e2e/global-setup.js
import { request } from '@playwright/test';
export default async () => {
  const ctx = await request.newContext({ baseURL: process.env.APP_URL });
  await ctx.post('/api/functions/seedTestTenant', {
    headers: { 'X-Base44-Service-Key': process.env.E2E_SERVICE_KEY },
    data: { slug: 'e2e-barbershop', reset: true },
  });
};
```

---

## 6. Performance

Alvos:
- **Local (Docker)**: < 3s para reset completo
- **Staging**: < 5s
- **Produção** (com `super_admin`): < 8s

Se ultrapassar, suspeite de:
- Volume de dados órfãos acumulado (rode `deleteTestTenant` para reciclar).
- Rate limits na API (a função usa `serviceRole` — não deveria atingir).
- Mudanças no schema das entidades — algumas operações ficaram síncronas.

---

## 7. Isolamento multi-tenant

- O slug `e2e-*` garante **prefixo único**. Mesmo que um seed acidentalmente
  rode em produção (com super_admin), ele só cria/toca em registros marcados.
- Filtros `purgeTenantData` usam sempre `{ company_id }`. **Nunca** apaga sem
  filtro de tenant.
- O `Plan` E2E é `visibility=private` + `allowed_company_ids=[E2E_company_id]`
  — não aparece para outros tenants no /master/planos público.

---

## 8. Troubleshooting

### "slug must start with e2e-"
Você esqueceu o prefixo. Sempre `e2e-...`.

### "Forbidden"
Você não é super_admin **e** `ALLOW_E2E_SEED` não está `true`.
Em CI, defina a env. Em local, faça login como super_admin antes.

### Seed roda mas dashboard ainda mostra "0 clientes"
1. Verifique que o `user.email` logado bate com `owner_email` (`e2e@teste.com`).
2. Force refresh — `PrivateRoute` cacheia Company por 60s.
3. Rode `resetTestTenant` para garantir baseline limpo.

### `RetentionCampaignsCard` continua oculto
O plano E2E inclui `crm_retention` em `features[]`. Se ainda assim sumir:
- Confira `Plan.id` no Company atual (`plan_id`).
- O hook `useFeatures()` usa `Plan.features` — verifique que o `Plan`
  retornado pelo `PrivateRoute` é o E2E (não um plano legado).

### Caixa pede para abrir mesmo com seed
O seed cria 1 `CashRegister` aberto. Se a UI insiste em abrir um novo:
- Veja se há **dois** caixas abertos (race). Rode `resetTestTenant`.
- Confirme que `RoleRoute` libera `caixa` (precisa de role `admin` ou `financeiro`).

### Senha do customer não funciona
Você está usando a senha errada. A correta é literalmente:
```
E2E#StrongPassword2026
```
Aspas/whitespace? Copie diretamente de `lib/testing/testTenantFactory.js`.

---

## 9. Cleanup / boas práticas

- **Sempre** rode `resetTestTenant` no `beforeEach` (não `beforeAll`).
  Suítes paralelas geram race condition se compartilharem estado.
- Use suítes **serializadas** para mutações cross-test
  (`test.describe.serial(...)`).
- Em PR de feature nova, atualize a lista de constantes em
  `lib/testing/testTenantFactory.js` E nas 3 functions (cópia literal).
- Em emergência, `deleteTestTenant` + `seedTestTenant` resolve 99% dos
  estados corrompidos.
- **Nunca** versione tokens/senhas reais — `E2E_CUSTOMER_PASSWORD` é
  intencionalmente público porque o tenant é descartável.

---

## 10. Checklist antes de subir para produção

- [ ] `ALLOW_E2E_SEED` **NÃO** está definido em produção
- [ ] Slug usado começa com `e2e-`
- [ ] Pipelines CI definem `ALLOW_E2E_SEED=true` apenas em staging
- [ ] Após cada execução, `AuditLog` contém o evento (`E2E_SEED_CREATED` etc)
- [ ] `SecurityEvent` zero em runs autorizados
- [ ] Tempo total do seed < 5s