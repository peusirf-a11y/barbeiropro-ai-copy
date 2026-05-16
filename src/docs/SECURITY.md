# SECURITY.md — O Corte SaaS Security Reference

> Última atualização: 2026-05-16  
> Audiência: engenheiros, revisores de PR, auditores de segurança.

---

## 1. ARQUITETURA MULTI-TENANT

### Princípio de isolamento
**Company = Tenant.** Toda entidade operacional (`Appointment`, `Customer`, `FinancialEntry`, etc.) possui `company_id` obrigatório.

**Regra de ouro:** `company_id` NUNCA é aceito do payload do frontend. Sempre derivado do caller autenticado via `resolveTenantAccess`.

### Hierarquia de acesso
```
super_admin (TotpGate + ImpersonationSession)
  └── owner (Company.owner_email === user.email) → role=admin implícito
  └── TeamMember → role: admin | recepcao | barbeiro | financeiro
       └── unit_ids (restrição de unidade, opcional)
       └── cash_permissions (overrides granulares para Caixa)
```

### Validação obrigatória em toda BFF
```js
// PADRÃO — inline em cada function (Deno não suporta imports locais)
const callerCompanyId = await resolveCallerCompanyId(sdk, user);
if (callerCompanyId !== '__SUPER__' && callerCompanyId !== company_id_claimed) {
  // Log SecurityEvent + retorna 403
}
```

---

## 2. REGRAS LGPD

### Bases legais usadas
| Operação | Base legal (LGPD) |
|---|---|
| Agendamento | Art. 7º, V — execução de contrato |
| Lembretes WhatsApp | Art. 7º, V — legítimo interesse operacional |
| Marketing WhatsApp | Art. 7º, I — consentimento explícito |
| Exportação de dados | Art. 18, V — portabilidade |
| Anonimização | Art. 18, IV — direito à eliminação |

### Dados sensíveis — campos NUNCA retornados ao frontend
| Entidade | Campos bloqueados |
|---|---|
| Customer | `password_hash`, `auth_token`, `reset_token`, `*_expires_at`, `token_version` |
| Appointment | `confirm_token`, `review_token`, `payment_intent_id`, `payment_idempotency_key`, `payer_tax_id` |
| Company | `stripe_secret_*`, `stripe_connect_account_id` |

### Consentimentos
- Consentimentos de marketing são OPCIONAIS e NUNCA pré-marcados
- Registrados em `CustomerConsent` com `legal_text_version`, `ip_address`, `user_agent`
- Revogação disponível 24/7 via `/cliente/:slug`
- Log em `PrivacyAuditLog` para toda ação

---

## 3. OWASP TOP 10 MITIGATIONS

| # | Risco | Mitigação implementada |
|---|---|---|
| A01 | Broken Access Control | `resolveTenantAccess` obrigatório; cross-tenant bloqueado + `SecurityEvent` gerado |
| A02 | Cryptographic Failures | PBKDF2-SHA256 (100k iter); tokens 256-bit crypto-random; sem MD5/SHA1 |
| A03 | Injection | Sanitização HTML+control chars em todos os inputs públicos; CSV injection com prefix `'` |
| A04 | Insecure Design | Slot lock atômico; idempotency keys Stripe; conflict check server-side |
| A05 | Security Misconfiguration | CORS gerenciado pela plataforma; secrets em env vars; sem defaults inseguros |
| A06 | Vulnerable Components | Dependencies via npm: com version pins; Stripe lib atualizada |
| A07 | Auth Failures | Rate limit persistente no banco (não em memória); timing-safe comparison; session rotation |
| A08 | Software Integrity | Stripe webhook `constructEventAsync` com signature verification |
| A09 | Security Logging | `SecurityEvent` + `AuditLog` + `PrivacyAuditLog` para todas as ações críticas |
| A10 | SSRF | Nenhum fetch de URL controlada pelo usuário sem validação |

---

## 4. RATE LIMITS

| Endpoint | Limite | Janela | Persistência |
|---|---|---|---|
| customerAuth login | 5 tentativas | 5 min | Banco (`SecurityRateLimit`) |
| customerAuth reset | 3 tentativas | 15 min | Banco |
| startImpersonation | 10 tentativas | 1 min | Em memória (+ monitorar `SecurityEvent`) |
| createPublicAppointment | 5 agendamentos | 1 hora | Banco (filter por phone) |
| submitReview | 10 reviews | 1 hora | Banco (filter por IP) |

---

## 5. SECURE CODING STANDARDS

### Proibido
```js
// ❌ Retornar error.message no cliente
return Response.json({ error: error.message });

// ❌ Confiar em company_id do payload
const { company_id } = body; // nunca sem validação

// ❌ Rate limit em memória
const buckets = new Map(); // zerado em cold start

// ❌ Retornar campos sensíveis
return Response.json({ customers }); // sem sanitizar

// ❌ Formato legado de token
const legacyMatch = auth_token === `reset:${token}`;
```

### Obrigatório
```js
// ✅ Error handling seguro
} catch (error) {
  console.error('[functionName] rid=${rid}:', error?.message, error?.stack);
  return Response.json({ error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
}

// ✅ Tenant validation antes de qualquer operação
const callerCompanyId = await resolveCallerCompanyId(sdk, user);
if (callerCompanyId !== company_id) return forbidden();

// ✅ Sanitizar entidades antes de retornar
return Response.json({ customers: customers.map(sanitizeCustomer) });

// ✅ request_id em todas as respostas de erro
const rid = crypto.randomUUID().split('-')[0];
```

---

## 6. CHECKLIST DE PR

Antes de aprovar qualquer PR em functions/:

- [ ] A function aceita `company_id` do payload? → Validar tenant do caller
- [ ] Retorna entidade Customer? → `sanitizeCustomer()` aplicado
- [ ] Retorna entidade Appointment? → `sanitizeAppointment()` aplicado
- [ ] Usa `error.message` no cliente? → Substituir por `'INTERNAL_ERROR'`
- [ ] Rate limit usa `Map()` em memória? → Migrar para `SecurityRateLimit`
- [ ] Registra `AuditLog`/`SecurityEvent` para ação crítica?
- [ ] Logs internos com `rid` para correlação?

---

## 7. INCIDENT RESPONSE

### Vazamento de dados suspeito
1. Verificar `SecurityEvent` com `event_type=cross_tenant_attempt`
2. Verificar `PrivacyAuditLog` com `action=DATA_EXPORT_REQUESTED`
3. Identificar `actor_email` + `ip_address`
4. Revogar acesso: desativar TeamMember ou chamar `blockCompany`
5. Notificar ANPD se dados pessoais de titulares foram afetados (prazo: 72h)

### Brute force detectado
1. Verificar `SecurityEvent` com `event_type=rate_limit_exceeded`
2. Verificar `SecurityRateLimit` com `is_blocked=true`
3. IP pode ser blocklisted manualmente no `SecurityRateLimit`

### Impersonação suspeita
1. Verificar `AuditLog` com `action=IMPERSONATION_STARTED`
2. Chamar `endImpersonation` para encerrar sessão ativa
3. Revogar TOTP session do super admin afetado

---

## 8. STRIPE SECURITY

- Webhook sempre validado via `constructEventAsync` (assíncrono — SubtleCrypto)
- `stripe_connect_account_id` NUNCA exposto na resposta pública do `createBookingPaymentIntent`
- `payment_intent_id` NUNCA retornado em listagens de appointments
- `payer_tax_id` (CPF) anonimizado após pagamento
- Idempotency key determinística por `company+customer+service+professional+time+method`
- Validação de `livemode` com `SystemAlert` em mismatch