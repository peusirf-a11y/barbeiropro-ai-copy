# Audit Architecture — O Corte

## Visão Geral

Sistema de auditoria enterprise multi-tenant com rastreabilidade completa,
correlation IDs, severidades e observabilidade de ações críticas.

---

## Entity: AuditLog

### Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `company_id` | string | Tenant da ação. NULL = plataforma |
| `unit_id` | string | Unidade específica |
| `actor_email` | string | E-mail do ator |
| `actor_type` | enum | user / customer / system / webhook / automation / impersonation |
| `actor_id` | string | ID do ator |
| `action` | string | SCREAMING_SNAKE_CASE |
| `severity` | enum | info / warning / critical |
| `target_type` | string | Recurso afetado |
| `target_id` | string | ID do recurso |
| `correlation_id` | string | Rastreia um fluxo completo |
| `request_id` | string | Deduplicação por request |
| `metadata` | object | Dados extras. Máx 10kb |

---

## Actions Oficiais

### Agenda
- `APPOINTMENT_CREATED`
- `APPOINTMENT_CONFIRMED`
- `APPOINTMENT_RESCHEDULED`
- `APPOINTMENT_CANCELLED`
- `APPOINTMENT_COMPLETED`
- `APPOINTMENT_NO_SHOW`

### Financeiro
- `CASH_OPENED`
- `CASH_CLOSED`
- `FINANCIAL_ENTRY_CREATED`
- `FINANCIAL_ENTRY_DELETED`
- `COMMISSION_PAID`
- `COMMISSION_REVERSED`

### Assinaturas
- `SUBSCRIPTION_CREATED`
- `SUBSCRIPTION_USE_CONSUMED`
- `SUBSCRIPTION_CANCELLED`
- `SUBSCRIPTION_REACTIVATED`

### Segurança
- `LOGIN_SUCCESS`
- `LOGIN_FAILED`
- `IMPERSONATION_STARTED` (retrocompat: `START_IMPERSONATION`)
- `IMPERSONATION_ENDED` (retrocompat: `END_IMPERSONATION`)
- `CROSS_TENANT_ATTEMPT`
- `PERMISSION_DENIED`
- `STRIPE_ENV_MISMATCH`

### WhatsApp
- `WHATSAPP_SENT`
- `WHATSAPP_FAILED`

### Reviews
- `REVIEW_SUBMITTED`
- `REVIEW_DELETED`

---

## Severidades

| Severidade | Uso |
|---|---|
| `info` | Operações normais do dia-a-dia |
| `warning` | Ações financeiras, pagamentos, cancelamentos |
| `critical` | Segurança, cross-tenant, erros sistêmicos |

---

## Correlation IDs

Cada fluxo multi-step compartilha o mesmo `correlation_id`.

Exemplo — Booking Flow:
```
correlation_id = "abc-123-..."
  → createBookingPaymentIntent  (correlation_id: abc-123)
  → stripeWebhook               (correlation_id: abc-123)
  → createPublicAppointment     (correlation_id: abc-123)
  → sendWhatsAppMessage         (correlation_id: abc-123)
```

Geração: `crypto.randomUUID()` no início do fluxo.
Propagação: via `metadata.correlation_id` ou header `X-Correlation-ID`.

---

## Tenant Isolation

- **Usuários normais**: NUNCA acessam AuditLog global.
- **Master (super_admin)**: acesso cross-tenant via `listAuditLogs` BFF.
- **Queries**: sempre `filter({ company_id })` para operações tenant-scoped.
- **Frontend**: nunca consulta AuditLog diretamente — sempre via BFF.

---

## LGPD / Privacidade

**NUNCA armazenar:**
- Senhas / hashes
- Tokens de sessão
- Secrets / API keys
- Dados de cartão (PAN, CVV)
- Payload completo do Stripe

**Mascaramento:**
- Emails: `ped***@gmail.com`
- Telefones: `(11) 9****-1234`

**Retenção:**
- Logs `info`: 90 dias (recomendado)
- Logs `warning`: 1 ano
- Logs `critical`: 2 anos

---

## Helper: audit.js (backend)

```js
import { logAudit, logSecurityEvent, logFinancialEvent } from './audit.js';

// Uso básico
await logAudit(base44, {
  company_id,
  actor_email: user.email,
  action: 'APPOINTMENT_COMPLETED',
  severity: 'info',
  target_type: 'appointment',
  target_id: appointment_id,
  metadata: { amount, service_name },
});

// Evento de segurança
await logSecurityEvent(base44, {
  action: 'CROSS_TENANT_ATTEMPT',
  actor_email: user.email,
  ip,
});

// Evento financeiro
await logFinancialEvent(base44, {
  company_id,
  action: 'CASH_CLOSED',
  actor_email: user.email,
  metadata: { final_amount, difference },
});
```

**REGRA CRÍTICA:** logAudit NUNCA lança exceção — erros são swallowed.
Auditoria é observabilidade, nunca core flow.

---

## API: listAuditLogs (BFF)

```js
const res = await base44.functions.invoke('listAuditLogs', {
  company_id: 'optional',
  severity: 'critical',        // info | warning | critical
  actor_type: 'impersonation', // filtro por tipo
  date_from: '2026-01-01',
  date_to: '2026-12-31',
  limit: 50,                   // max 200
  skip: 0,
});
// → { logs: [...], total, has_more, limit, skip }
```

---

## Dashboard: MasterAudit

Rota: `/master/auditoria`

Funcionalidades:
- Timeline global paginada
- Filtros: empresa, severity, actor_type, action, período
- KPIs: ações 24h, críticos, falhas WhatsApp, impersonações
- Painel de segurança: logins falhos, env mismatch
- Drawer de detalhes com JSON viewer
- Export CSV / JSON

---

## Troubleshooting

**Logs não aparecem:**
1. Verificar se `action` foi fornecido
2. Verificar se `company_id` está correto
3. Checar logs do Deno: `[audit] logAudit failed`

**Performance lenta:**
1. Sempre usar `filter({ company_id })` em vez de `list()`
2. Limitar a 200 registros por query
3. Usar paginação (skip/limit)

**Dados sensíveis em metadata:**
- Verificar `FORBIDDEN_KEYS` no audit helper
- Nunca passar `password`, `token`, `secret` como chave