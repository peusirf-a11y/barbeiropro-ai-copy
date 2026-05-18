# URL Security — O CORTE

Consolidação dos hardenings de URL/token/cache aplicados no app.
Última revisão: 2026-05-18.

---

## 1. Modelo de ameaças cobertas

| Ameaça | Defesa | Onde |
|---|---|---|
| Open Redirect (`?next=https://evil.com`) | `safeRedirect()` | `lib/security/safeRedirect.js` |
| `javascript:`, `data:`, `blob:` em redirect/slug | `safeRedirect()` + `sanitizeUrlParam()` | `lib/security/*` |
| Path traversal (`../`, `%2e%2e`) | Decodificação dupla + regex | `safeRedirect()`, `urlSanitizer.js` |
| Protocol-relative (`//evil.com`) | Bloqueio explícito | `safeRedirect()` |
| Brute force de tokens públicos | Rate limit persistente por IP | `publicTokenGuard.js` + `SecurityRateLimit` |
| Enumeração de slugs/empresas | `sanitizeSlug()` + 404 genérico | `urlSanitizer.js` |
| Cache cross-tenant no React Query | Query keys tenant-aware + flush | `lib/queryKeys.js` (Fase 4) |
| XSS via query param exibido na UI | `sanitizeUrlParam()` | `urlSanitizer.js` |

---

## 2. `safeRedirect(input, fallback)`

Sanitiza qualquer valor que será passado para `navigate()` / `window.location` / `Link to=`.

### Regras

- ✅ Permite **apenas** strings que começam com `/` (uma barra só).
- ❌ Bloqueia URLs absolutas (`http://`, `https://`, qualquer esquema).
- ❌ Bloqueia protocol-relative (`//evil.com`).
- ❌ Bloqueia `javascript:`, `data:`, `blob:`, `file:`, `vbscript:`, `about:`.
- ❌ Bloqueia path traversal (`..` em qualquer posição).
- ❌ Bloqueia caracteres de controle (`\u0000-\u001F`, `\u007F`, `\`, `<`, `>`).
- Decodifica até 2x para pegar payloads tipo `%252e%252e%252f`.

### Exemplos

```js
safeRedirect('/app/clientes')           // → '/app/clientes'
safeRedirect('/app/clientes?ok=1')      // → '/app/clientes?ok=1'
safeRedirect('https://evil.com')        // → '/app/dashboard'
safeRedirect('//evil.com')              // → '/app/dashboard'
safeRedirect('javascript:alert(1)')     // → '/app/dashboard'
safeRedirect('/../admin')               // → '/app/dashboard'
safeRedirect('%2f%2fevil.com')          // → '/app/dashboard'
safeRedirect(null)                      // → '/app/dashboard'
safeRedirect('', '/login')              // → '/login'
```

### Onde aplicar

Toda vez que ler `?next=` / `?returnTo=` / `?redirect=` / `?callback=` da URL **antes de navegar**:

- Pós-login
- Pós-logout
- Pós-onboarding
- Pós-checkout
- Reset de senha
- Confirmação por e-mail

---

## 3. `urlSanitizer.js`

### `sanitizeSlug(value)` → string

Para slugs públicos (ex: `/agendar/:slug`).
- Aceita apenas `[a-z0-9_-]`
- Lowercase, máx 64 chars
- Retorna `''` se inválido (trate como 404)

### `sanitizePath(value)` → string

Para paths internos validados antes de uso.
- Aceita `[a-zA-Z0-9_\-/.]`
- Máx 256 chars
- Retorna `''` se inválido

### `sanitizeUrlParam(value)` → string

Para EXIBIR valor de query param na UI sem risco de XSS.
- Remove `< > " ' \` `` ` ``
- Bloqueia protocolos perigosos
- Máx 256 chars

---

## 4. `publicTokenGuard.js` — Anti-enumeração

Endpoints com token público no path (`/confirma/:token`, `/avaliar/:token`) são alvos clássicos de brute force.

### Como funciona

`checkPublicTokenAccess(sdk, { action, ip, tokenFound, rid })`:

1. Conta tentativas por **IP** (não por token — o token muda em cada try).
2. **5 tentativas em 15 min** → soft block 1h.
3. **20 tentativas** → hard block 24h.
4. Cada falha registra `SecurityEvent: brute_force_attempt`.

### Aplicado em

- `functions/confirmAppointment.js`
- `functions/submitReview.js`
- `functions/customerAuth.js` (reset de senha)

### Resposta ao usuário

Quando bloqueado, retorne **429** com mensagem genérica. **Nunca** revele:
- Se o token existia
- Quantas tentativas faltam
- Quanto tempo até desbloquear

---

## 5. Query keys tenant-aware

Padrão obrigatório para queries NOVAS que dependem de tenant:

```js
import { tenantKey } from '@/lib/queryKeys';

useQuery({
  queryKey: tenantKey('appointments', companyId, { date }),
  queryFn: () => base44.entities.Appointment.filter({ company_id: companyId, ... }),
});
```

Ex:
- ✅ `['appointments', companyId, { date }]`
- ❌ `['appointments', { date }]` — vaza entre tenants no impersonate

### Flush automático do cache

O `queryClient.clear()` já é disparado em:

| Evento | Onde | Implementado |
|---|---|---|
| Logout | `lib/AuthContext.jsx` → `logout()` | ✅ |
| Início de impersonação | `contexts/ImpersonationContext.jsx` → `startImpersonation()` | ✅ |
| Fim de impersonação | `contexts/ImpersonationContext.jsx` → `stopImpersonation()` | ✅ |

### Helpers disponíveis (`lib/queryKeys.js`)

- `tenantKey(domain, companyId, ...extras)` — builder de key tenant-aware
- `userScopedKey(domain, companyId, userId, ...extras)` — quando precisa isolar por user
- `invalidateTenant(queryClient, companyId)` — invalida todas as queries do tenant
- `flushTenantCache(queryClient)` — limpa todo o cache (uso em logout/troca de sessão)

---

## 6. Checklist obrigatório de PR

Toda PR que mexer em rotas/URLs deve passar por:

- [ ] Usa `safeRedirect()` em qualquer `navigate(param)` vindo de URL/state externo
- [ ] Usa `sanitizeSlug()` ao ler slugs públicos
- [ ] Endpoints com token público no path usam `checkPublicTokenAccess`
- [ ] Query keys novas incluem `companyId` quando tenant-aware
- [ ] Nenhum `dangerouslySetInnerHTML` com valor de URL/param
- [ ] Nenhum `eval`, `new Function`, `setTimeout(string)`
- [ ] Nenhum log de token completo (use prefix-only)
- [ ] Cobertura de teste em `tests/security/urlSecurity.test.js`

---

## 7. Padrões PROIBIDOS

```js
// ❌ NUNCA
navigate(searchParams.get('next'));
window.location.href = req.query.returnTo;
const slug = params.slug; // sem sanitização
<a href={userInput}>...</a>

// ✅ SEMPRE
navigate(safeRedirect(searchParams.get('next'), '/app/dashboard'));
const slug = sanitizeSlug(params.slug);
if (!slug) return <NotFound />;
```

---

## 8. Referências

- OWASP Cheat Sheet: Unvalidated Redirects and Forwards
- OWASP Cheat Sheet: URL Validation
- RFC 3986 §3.1 (Scheme component)
- WHATWG URL Standard §4.4.1 (parser state machine)