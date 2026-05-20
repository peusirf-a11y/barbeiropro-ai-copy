# Planos Privados / Ocultos

Sistema de visibilidade controlada para planos de assinatura.
Aplica-se a **duas entities**:

- **`Plan`** — planos da plataforma SaaS (Starter, Pro, Enterprise, custom). Gerenciado pelo Master.
- **`CustomerPlan`** — planos que cada barbearia vende aos próprios clientes. Gerenciado pelo dono da barbearia.

## Conceito

Cada plano tem `visibility ∈ { public, private, invite_only }`.

| Visibility | Aparece em listas públicas? | Quem pode contratar |
|---|---|---|
| `public` | Sim — landing, pricing, onboarding, /cliente/:slug/planos | Qualquer um |
| `private` | **Não** | Apenas tenants/clientes em `allowed_company_ids` / `allowed_customer_ids` |
| `invite_only` | **Não** | Quem apresenta `invite_token` válido (depois é adicionado ao allowed list) |

## Arquitetura

### Filtros de visibilidade — `lib/planVisibility.js`
Funções **puras**, sem fetch. Single source of truth para decidir o que aparece pra cada ator.

```js
filterPublicPlans(plans)                              // landing/onboarding/pricing
filterPlansVisibleToCompany(plans, companyId)         // upgrades (Plan SaaS)
filterCustomerPlansVisibleToCustomer(plans, cid)      // /cliente/:slug/planos
canCompanyAccessPlan(plan, companyId)                 // gate antes de checkout
canCustomerAccessPlan(plan, customerId)               // gate antes de assinar
validateInviteToken(plan, token)                      // valida token sem persistir
generateInviteToken()                                 // 32-char hex aleatório
```

### Backend functions

#### `generatePlanInvite`
Cria/regenera um `invite_token` para Plan ou CustomerPlan.
- `entity='Plan'` → super_admin only
- `entity='CustomerPlan'` → admin do tenant dono do plano OU super_admin
- Força `visibility='invite_only'`, zera `invite_uses_count`.
- Aceita `expires_in_days` e `max_uses` opcionais.

#### `validatePlanInvite`
Consome um invite token. **Único ponto onde planos invite_only são lidos por token**.
- `kind='platform'` — caller é tenant SaaS autenticado (`base44.auth.me()`).
- `kind='customer'` — caller é Customer autenticado (slug + customer_token).
- Em sucesso: adiciona `company_id`/`customer_id` ao allowed list e incrementa contador.
- Em falha: registra `SecurityEvent` (`invalid_token`, `cross_tenant_attempt`) e devolve mensagem genérica.

#### `upgradePlan` e `createCustomerPlanCheckout`
Foram endurecidos para chamar `canCompanyAccessPlan` / `canCustomerAccessPlan` antes de qualquer
operação Stripe. Mesmo que o frontend envie um `plan_id` privado, o backend recusa se o caller não estiver no allowed list.

### Páginas públicas de redenção

- `/planos/convite/:token` — redime invite de Plan SaaS (requer login).
- `/cliente/:slug/planos/convite/:token` — redime invite de CustomerPlan (requer login do Customer).

Ambas chamam `validatePlanInvite` e redirecionam pra próxima tela com `?invite=ok`.

## Segurança & isolamento

### O que **NUNCA** acontece
- Plano private/invite_only aparece em landing, pricing ou onboarding.
- Plano private aparece em upgrade flow de tenant não autorizado.
- CustomerPlan private aparece para Customer não autorizado em `/cliente/:slug/planos`.
- Plano vaza em React Query cache compartilhado entre tenants.
- Backend deixa contratar plano privado sem validação.

### Defesas em camadas
1. **Frontend filtra** — todas as listas (Checkout, Onboarding, CustomerPlans, UpgradePlanCard) passam
   pelos helpers de `lib/planVisibility.js`. Plano privado nem é renderizado no DOM.
2. **Cache por tenant** — query keys incluem `companyId`/`customerId`, evitando vazamento entre sessões.
3. **Backend valida** — `upgradePlan` e `createCustomerPlanCheckout` rejeitam se o caller não tem acesso.
4. **Invite tokens** — opacos (16 bytes hex), expira opcionalmente, max_uses opcional.
5. **Auditoria** — `PLAN_INVITE_GENERATED` e `PLAN_INVITE_CONSUMED` em AuditLog. Falhas viram SecurityEvent.

### Enumeração / replay
- Tokens com 32 chars hex (16 bytes random) — espaço 2^128, impraticável brutar.
- Mensagem de erro genérica (`INVALID_INVITE` vs `INVITE_EXPIRED` apenas — sem revelar plano).
- `max_uses` permite token "single-use".
- `expires_at` permite token de curta duração para campanhas.

## Fluxo de invite (UX)

**Master gera convite SaaS:**
1. Master Panel → Planos → "Gerar invite"
2. Define `expires_in_days` e `max_uses`
3. Recebe URL: `https://app.ocorte.app/planos/convite/abc123...`
4. Envia ao tenant alvo (email/WhatsApp)
5. Tenant clica → autentica → plano fica disponível em Configurações → Assinatura

**Barbearia gera convite ao cliente:**
1. AppPlanos → Plano → "Gerar invite"
2. URL: `https://app.ocorte.app/cliente/{slug}/planos/convite/abc123...`
3. Envia ao cliente VIP
4. Cliente clica → autentica → plano aparece em `/cliente/{slug}/planos`

## Riscos evitados

| Risco | Mitigação |
|---|---|
| Enumeração de planos via API | Backend filtra ao retornar; lista pública nunca inclui privados |
| Cliente descobre via devtools que existe plano "Enterprise Custom" | Plano nunca chega ao bundle — backend filtra antes |
| Token vazado em log | `validatePlanInvite` loga apenas prefixo (`token.slice(0,6)`) |
| Replay de invite após max_uses | `invite_uses_count` incrementa atomicamente; backend rechecka |
| Cross-tenant (customer de barbearia A redime convite de B) | `validatePlanInvite` valida `plan.company_id === caller.company_id` e gera SecurityEvent `cross_tenant_attempt` |
| Cache do React Query expõe plano de outro tenant | Query keys sempre incluem `companyId`/`customerId` |
| Plano private vaza no SSR/hydration | Sem SSR — app é SPA. Listas vêm via SDK autenticado. |

## Testes recomendados

- Tenant sem acesso recebe lista sem o plano privado.
- Tenant autorizado vê o plano privado em `upgradePlan` UI.
- Super-admin vê todos os planos no MasterPanel.
- Invite expirado retorna `INVITE_EXPIRED`.
- Invite com `max_uses=1` consumido 2× falha na 2ª.
- Customer de outra empresa tentando redimir invite cross-tenant gera `SecurityEvent`.
- Frontend não inclui plano privado no payload do `Checkout` público.

## Migrações

Planos existentes não têm `visibility` — tratados como `'public'` (default da entity).
Não há migração obrigatória; opt-in plano a plano.