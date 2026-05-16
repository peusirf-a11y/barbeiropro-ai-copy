# SECURITY.md — O Corte SaaS Security Policy

> Versão: 2.0 | Última revisão: 2026-05 | Nível: Enterprise

---

## 1. Arquitetura de Segurança

### 1.1 Modelo de Ameaça

| Ameaça | Mitigação | Status |
|--------|-----------|--------|
| XSS via inputs | sanitizeHtml + sanitizeText (allowlist) | ✅ Implementado |
| XSS via DOM | Trusted Types + dangerouslySetInnerHTML proibido | ✅ Implementado |
| CSRF | SameSite cookies + Origin validation | ✅ Implementado |
| Injeção SQL | ORM base44 (sem queries raw) | ✅ Implementado |
| Cross-tenant | resolveTenantAccess em todas as functions | ✅ Implementado |
| Sequestro de sessão | device-bound sessions + token rotation | ✅ Implementado |
| Brute force | Rate limit persistente (SecurityRateLimit) | ✅ Implementado |
| Clickjacking | X-Frame-Options: DENY | ✅ Implementado |
| MIME sniffing | X-Content-Type-Options: nosniff | ✅ Implementado |
| Timing attacks | HMAC constant-time comparison | ✅ Implementado |
| CSV injection | Prefix `'` em `=+−@` no início de campos | ✅ Implementado |
| Script injection | CSP (Report-Only → Enforcement) | ⚠️ Report-Only |
| Price tampering | Preço sempre lido do banco, nunca do payload | ✅ Implementado |

---

## 2. Content Security Policy (CSP)

### 2.1 Política Atual

```
default-src 'self';
script-src 'self' https://js.stripe.com https://maps.googleapis.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https: blob:;
connect-src 'self' https://api.stripe.com https://*.base44.com wss://*.base44.com;
frame-src https://js.stripe.com https://hooks.stripe.com;
object-src 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

### 2.2 Modo de Operação

- **Atual**: `Content-Security-Policy-Report-Only` — monitora sem bloquear
- **Ativação de enforcement**: `initCSP({ reportOnly: false })` em `main.jsx`
- **Relatórios**: endpoint `cspReport` registra violações em `SecurityEvent`

### 2.3 Passos para enforcement total

1. Monitorar `SecurityEvent` com `event_type=suspicious_payload, route=csp_violation` por 2 semanas
2. Resolver violações legítimas (scripts internos, Google Fonts, CDNs)
3. Mudar `reportOnly: false` em `main.jsx`
4. Testar em staging antes de produção

---

## 3. Security Headers

Todos os headers são aplicados nas respostas de backend via `SECURITY_HEADERS` em `lib/security/csp.js`:

| Header | Valor | Proteção |
|--------|-------|----------|
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Info leakage |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | APIs sensíveis |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Forçar HTTPS |
| `X-XSS-Protection` | `1; mode=block` | XSS legado |

---

## 4. Autenticação e Sessões

### 4.1 Política de Sessão (Customer Auth)

| Parâmetro | Valor |
|-----------|-------|
| Algoritmo de hash | PBKDF2-SHA256, 100.000 iterações, salt 16 bytes |
| Comprimento do token | 256 bits (64 hex chars) |
| TTL da sessão | 30 dias |
| TTL do reset token | 1 hora |
| Mínimo de senha | 8 caracteres |
| Máximo de senha | 128 caracteres |
| Rate limit login | 5 tentativas / 5 min (por email+IP) |
| Rate limit reset | 3 tentativas / 15 min |
| Comparação de tokens | HMAC constant-time (anti timing-attack) |

### 4.2 Device-Bound Sessions

- Entidade `UserSession` vincula token_hash + device_id + IP + user-agent
- Token nunca armazenado em plaintext (apenas SHA-256 hash)
- Rotação automática a cada login
- Revogação individual ou em massa via `/app/configuracoes/seguranca`
- Heartbeat via `manageSessions { action: 'heartbeat' }`

### 4.3 Risk Engine

O `riskEngine.js` avalia cada sessão com score:

| Evento | Score |
|--------|-------|
| Mesmo IP | low |
| IP no mesmo /24 | low |
| IP diferente no mesmo prefixo | medium |
| IP completamente diferente | high |
| Device type diferente | high |
| IP diferente em < 10 min | critical (Viagem Impossível) |
| 5+ sessões simultâneas | high |

---

## 5. Política de MFA

### 5.1 Obrigatório para

- Super Admin / Master Panel → `TotpGate` em todas as rotas `/master`

### 5.2 Opcional para

- Admins de barbearia (ativação via Configurações > Segurança)

### 5.3 Métodos suportados

- TOTP (RFC 6238) via authenticator app (Google Authenticator, Authy, 1Password)
- **NÃO** usar SMS (vulnerável a SIM swapping)

---

## 6. Isolamento Multi-Tenant

### 6.1 Regra Fundamental

> `company_id` NUNCA é aceito do payload. Sempre derivado da sessão autenticada.

### 6.2 Implementação

```javascript
// lib/resolveTenantAccess.js
const { company, teamMember } = await resolveTenantAccess(base44, user);
// company_id do payload é IGNORADO
```

### 6.3 Validações obrigatórias em toda function

1. `base44.auth.me()` → usuário autenticado
2. `resolveTenantAccess()` → company_id real
3. Verificar que recurso pertence ao tenant
4. Logar em `SecurityEvent` qualquer tentativa cross-tenant

---

## 7. Sanitização e XSS

### 7.1 Regras de sanitização

| Contexto | Método | Allowlist |
|----------|--------|-----------|
| Campos de texto (name, notes) | `sanitizeText()` | Nenhuma tag |
| Rich text (templates, observações) | `sanitizeHtml()` | b, i, em, strong, ul, ol, li, p, br |
| URLs | `sanitizeUrl()` | Bloqueia javascript:, data:, blob: |
| CSV export | `safeCsv()` | Prefixo ' em =+−@\t\r |

### 7.2 Campos sempre text-only

`name`, `phone`, `email`, `notes`, `reason`, `description`, `justification`, `deletion_reason`

### 7.3 Proibido no código

```jsx
// ❌ NUNCA USAR:
element.innerHTML = userInput
dangerouslySetInnerHTML={{ __html: userInput }}

// ✅ USAR:
import { sanitizeHtml } from '@/lib/security/sanitizeHtml'
element.textContent = sanitizeText(userInput)
dangerouslySetInnerHTML={{ __html: sanitizeHtml(trustedInput) }}
```

---

## 8. Impersonação

### 8.1 Política

| Parâmetro | Valor |
|-----------|-------|
| TTL | 15 minutos |
| Renovação | Manual apenas |
| Justificativa | Obrigatória ao iniciar |
| Bloqueio financeiro | Não pode excluir registros financeiros bloqueados |
| Cache | `queryClient.clear()` ao iniciar e encerrar |
| Countdown | Banner persistente com timer regressivo |
| Alertas | Banner vermelho + pulse quando < 2 min |
| Log | `AdminAuditLog { action: IMPERSONATION_STARTED / ENDED }` |

### 8.2 Fluxo seguro

```
startImpersonation()
  → queryClient.clear()          // limpa dados do tenant anterior
  → ImpersonationSession.create() // registra no banco
  → TTL = 15 min                 // auto-expira
  → ImpersonationCountdown       // timer visível

stopImpersonation() / auto-expira
  → endImpersonation()           // revoga token no banco
  → localStorage.removeItem()
  → queryClient.clear()          // limpa dados do tenant impersonado
  → redirect master
```

---

## 9. Auditoria Administrativa

### 9.1 Entidades de auditoria

| Entidade | Propósito |
|----------|-----------|
| `AuditLog` | Ações gerais do sistema |
| `AdminAuditLog` | Ações críticas de admin (diff antes/depois) |
| `PrivacyAuditLog` | Ações LGPD (export, anonimização, consentimento) |
| `SecurityEvent` | Tentativas de ataque, rate limit, cross-tenant |

### 9.2 Ações que SEMPRE geram AdminAuditLog

- Exclusão de cliente
- Anonimização LGPD
- Export de dados
- Exclusão de lançamento financeiro
- Alteração de permissões de TeamMember
- Reversão de comissão
- Mudanças Stripe
- Cancelamento de assinatura
- Remoção de membro da equipe
- Inicio/fim de impersonação

### 9.3 Campos obrigatórios em AdminAuditLog

`actor`, `actor_role`, `action`, `severity`, `ip`, `request_id`
Diff `before`/`after` quando disponível.
**Nunca incluir**: `password_hash`, `auth_token`, `reset_token`, `stripe_secret_key`

---

## 10. Detecção de Ações Perigosas

### 10.1 Thresholds

| Ação | Threshold | Score |
|------|-----------|-------|
| Exportações em 24h | > 5 | medium |
| Exportações em 24h | > 20 | high |
| Anonimizações em 24h | > 3 | medium |
| Anonimizações em 24h | > 10 | critical |
| Login failures por IP | > 5 em 5 min | high |
| Sessões simultâneas | > 5 | high |

### 10.2 Resposta automática

- Score `medium` → `SecurityEvent` criado, log interno
- Score `high` → `SecurityEvent severity=high`, alerta no Security Center
- Score `critical` → `SecurityEvent severity=critical`, bloqueio automático via `SecurityRateLimit`

---

## 11. Secure Frontend Guidelines

### 11.1 Proibido

```javascript
eval()                          // ❌ XSS
new Function()                  // ❌ XSS
document.write()                // ❌ XSS
element.innerHTML = input       // ❌ XSS (sem sanitização)
dangerouslySetInnerHTML unsafe  // ❌ XSS
fetch() com credenciais externas // ❌ SSRF
localStorage com tokens raw     // ❌ XSS risk
company_id do payload           // ❌ Cross-tenant
```

### 11.2 Obrigatório

```javascript
sanitizeText(input)             // ✅ campos de texto
sanitizeHtml(input)             // ✅ rich text
sanitizeUrl(url)                // ✅ hrefs/srcs
resolveTenantAccess()           // ✅ todas as functions
base44.auth.me()                // ✅ autenticação
AdminAuditLog                   // ✅ ações destrutivas
SecurityEvent                   // ✅ tentativas de ataque
```

---

## 12. Checklist de PR (Pull Request)

Antes de merge de qualquer código que toca segurança:

- [ ] Não usa `company_id` do payload diretamente
- [ ] Não retorna `password_hash`, `auth_token`, `reset_token` ao frontend
- [ ] Campos de texto passam por `sanitizeText()`
- [ ] Rich text passa por `sanitizeHtml()`
- [ ] URLs validadas com `sanitizeUrl()`
- [ ] Ações destrutivas geram `AdminAuditLog`
- [ ] Tentativas de ataque geram `SecurityEvent`
- [ ] Rate limit em endpoints públicos
- [ ] Sem `eval()` ou `innerHTML` direto
- [ ] Sem `console.log` de secrets/tokens
- [ ] Headers de segurança aplicados

---

## 13. Incident Response

### 13.1 Comprometimento de sessão detectado

1. Verificar `SecurityEvent` com `event_type=invalid_token` e IP suspeito
2. Invocar `manageSessions { action: 'revoke_all' }` para o usuário
3. Resetar `auth_token = null` via SDK service role
4. Notificar usuário por email
5. Registrar em `AdminAuditLog { action: 'PASSWORD_RESET_ADMIN', severity: 'critical' }`

### 13.2 Cross-tenant detectado

1. `SecurityEvent` com `event_type=cross_tenant_attempt` já gerado automaticamente
2. Verificar `actor_email` e `company_id` nos logs
3. Bloquear IP via `SecurityRateLimit` se padrão de abuso
4. Considerar bloquear empresa se ator interno

### 13.3 Brute force detectado

1. `SecurityRateLimit` já bloqueia automaticamente por 5/15 min
2. Para bloqueio permanente: criar registro com `blocked_until` = futuro distante
3. Notificar via Security Center (/master/security)

---

## 14. Conformidade

| Requisito | Status |
|-----------|--------|
| LGPD Art. 46 (medidas técnicas) | ✅ Implementado |
| LGPD Art. 48 (comunicação de incidentes) | ✅ Processo definido |
| OWASP Top 10 — A01 Broken Access Control | ✅ resolveTenantAccess |
| OWASP Top 10 — A02 Cryptographic Failures | ✅ PBKDF2, tokens 256-bit |
| OWASP Top 10 — A03 Injection | ✅ Sanitização + ORM |
| OWASP Top 10 — A07 XSS | ✅ sanitizeHtml + CSP |
| OWASP Top 10 — A09 Logging & Monitoring | ✅ AuditLog + SecurityEvent |
| PCI-DSS (dados de cartão) | ✅ Delegado ao Stripe |