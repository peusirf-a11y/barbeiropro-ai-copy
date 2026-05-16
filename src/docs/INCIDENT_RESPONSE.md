# INCIDENT_RESPONSE.md — O Corte SaaS

> Versão: 2.0 | Data: 2026-05

---

## 1. Classificação de Incidentes

| Nível | Critérios | Tempo de Resposta |
|-------|-----------|------------------|
| 🔴 CRÍTICO | Cross-tenant leak, pagamento comprometido, acesso não autorizado admin | < 15 min |
| 🟠 ALTO | Brute force ativo, token comprometido, rate limit persistente acionado | < 1h |
| 🟡 MÉDIO | Tentativa de enumeração, CSV injection bloqueada, rate limit suave | < 4h |
| 🟢 BAIXO | Log anômalo, sessão expirada forçada, alerta de sistema | < 24h |

---

## 2. Fluxo de Impersonação Segura

```
Super Admin
    │
    ▼
TotpGate (TOTP válido, máx 5 usos por TotpSession)
    │
    ▼
startImpersonation
    ├─ Rate limit persistente: 5/10min → bloqueio 1h
    │                          15 tentativas → bloqueio 24h
    ├─ SecurityEvent registrado em bloqueio
    ├─ AuditLog: START_IMPERSONATION + metadata completo
    ├─ TotpSession.impersonation_count incrementado
    └─ ImpersonationSession criada (TTL 15min)
    │
    ▼
[Ações no tenant] — via impersonatedMutation
    ├─ Rate limit persistente por user+IP
    ├─ AuditLog por mutação
    └─ company_id validado via session (nunca do payload)
    │
    ▼
endImpersonation
    ├─ AuditLog: END_IMPERSONATION
    │   ├─ before/after (is_active)
    │   ├─ duration_seconds
    │   ├─ reason (manual/timeout)
    │   └─ token_prefix (parcial, não expõe token completo)
    └─ ImpersonationSession.ended_at setado
```

---

## 3. Resposta a Incidentes por Tipo

### Rate Limit de Impersonação Acionado

1. Verificar SecurityEvent: `event_type=rate_limit_exceeded`, `route=startImpersonation`
2. Identificar `actor_email` e `ip_address`
3. Se `reason=HARD_BLOCKED`: revisar todas as ações do ator nas últimas 24h via AuditLog
4. Se comportamento suspeito: revogar TotpSession do ator
5. Documentar em AdminAuditLog com `severity=critical`

### CPF / Tax ID Exposição

1. O CPF é automaticamente limpo do Appointment após `payment_intent.succeeded`
2. Em caso de suspeita de exposição, buscar Appointments com `payer_tax_id != null` e `payment_status = succeeded`
3. Limpar via `payer_tax_id: null` em batch
4. Registrar em PrivacyAuditLog como `SENSITIVE_DATA_VIEWED`

### CSV Injection Detectada

1. Identificar qual export foi afetado
2. Verificar se algum admin abriu o arquivo comprometido
3. Regenerar o export com sanitização aplicada
4. Alertar o admin para não abrir arquivos antigos

### Token Público sob Brute Force

1. SecurityEvent: `event_type=rate_limit_exceeded`, `route=confirmAppointment|submitReview`
2. O IP já está bloqueado automaticamente por 30min
3. Se ataque persistente: adicionar IP em blocklist manual via SecurityRateLimit
4. Verificar se algum token foi adivinhado (monitorar confirmações anômalas)

---

## 4. Políticas de Sessão

| Tipo | TTL | Rotação |
|------|-----|---------|
| Customer auth_token | 30 dias | A cada login |
| ImpersonationSession | 15 min | Por sessão |
| TotpSession | Configurável | Máx 5 usos para impersonação |
| SecurityRateLimit (suave) | 1 hora | Auto-reset após janela |
| SecurityRateLimit (crítico) | 24 horas | Manual por admin |

---

## 5. Políticas de Token Público

| Token | TTL | Rate Limit |
|-------|-----|-----------|
| confirm_token | 30 min após scheduled_at | 10 req/5min por IP |
| review_token | 72h após scheduled_at | 15 req/5min por IP |
| reset_token (Customer) | 1 hora | 3 req/15min por email+IP |

Todos os endpoints públicos de token:
- Retornam 404 genérico (não diferencia "inválido" de "não encontrado")
- Rate limit persistente no banco (não em memória)
- SecurityEvent registrado em abuso

---

## 6. Políticas de Exportação CSV

Todo export CSV deve:
1. Aplicar `csvEscape()` em todos os campos string
2. Incluir BOM UTF-8 (`\uFEFF`)
3. Nunca incluir campos de auth (password_hash, auth_token, etc.)
4. Passar por `validateLGPDExport()` antes de retornar
5. Registrar em PrivacyAuditLog como `DATA_EXPORT_DOWNLOADED`

---

## 7. Anonimização LGPD — Campos Obrigatórios

Campos que DEVEM ser limpos na anonimização irreversível:

**Identificadores diretos:**
- name, phone, email, notes

**Dados comportamentais (identificadores indiretos):**
- lifecycle_campaigns_log
- vip_dismissed_at
- last_completed_at, last_appointment_at
- favorite_service, favorite_professional
- tags

**Autenticação:**
- password_hash, auth_token, auth_token_expires_at
- reset_token, reset_token_expires_at
- token_version (incrementado para invalidar sessões)

**Verificação pós-anonimização:**
`validateAnonymizationIntegrity()` é executada automaticamente e registra SecurityEvent se falhar.

---

## 8. Matriz OWASP → Controles Implementados

| OWASP | Controle |
|-------|---------|
| A01 Broken Access Control | resolveTenantAccess, ensureSameCompany, company_id nunca do payload |
| A02 Cryptographic Failures | PBKDF2 100k iter, tokens 256-bit, HTTPS, CLEAR_TAX_ID_PATCH |
| A03 Injection | sanitizeCsv, sanitizeText, sanitizeHtml, csvEscape universal |
| A04 Insecure Design | Slot lock duplo, rate limit distribuído, idempotência |
| A05 Security Misconfiguration | safeWebhookError (sem stack trace), headers seguros |
| A07 Auth Failures | Rate limit persistente, TOTP impersonation_count, session rotation |
| A09 Logging & Monitoring | SecurityEvent, AuditLog simétrico, correlation_id |
| A10 SSRF | Nenhum fetch de URLs do usuário no backend |