# Partner MVP — Test Plan

Esta pasta concentra a estratégia de teste do módulo Partners. Os testes rodam contra o mock do Base44 SDK em `tests/helpers/mockBase44.js` (mesma convenção já usada no projeto).

## Áreas cobertas

### 1. Tracking (referralTracking.js)
- captura `?ref=CODE` → persiste no localStorage por 90 dias.
- formato inválido (regex falha) → não persiste.
- expiração → `getActiveReferral` devolve `null`.
- último clique vence → segunda captura sobrescreve.
- fallback para sessionStorage quando localStorage indisponível.

### 2. Anti-fraude (partnerAttribute)
- mesmo email Partner.email == Company.owner_email → marca `fraud` + `SecurityEvent.suspicious_payload`.
- mesmo telefone (apenas dígitos) → `fraud`.
- mesmo fingerprint em `Partner.fingerprint_seen` → `fraud`.
- nenhum sinal → `converted` + AuditLog `REFERRAL_CONVERTED`.

### 3. Comissão recorrente (stripeWebhook → invoice.paid)
- `invoice.amount_paid > 0` cria Commission `pending` com `hold_until = +15d`.
- idempotência por `(partner_id, stripe_invoice_id)` — segundo webhook não duplica.
- partner suspended → não gera.
- `Referral.status='fraud'` → não gera (filtro do find).
- `invoice.amount_paid == 0` (trial) → não gera.

### 4. Churn / chargeback
- `customer.subscription.deleted` → Commissions pending viram `cancelled` (`churn_rapido` se < 7d desde first_payment_at).
- `charge.refunded` → Commission `paid` mantém (Master decide); `pending/approved` viram `chargeback`.

### 5. Hold + aprovação automática (approveCommissions)
- hold ainda vigente → pula.
- hold vencido + Referral active + Company active → vira `approved`.
- hold vencido + Referral `cancelled` → vira `cancelled (churn_rapido)`.
- hold vencido + Company não-ativa → vira `cancelled (company_inactive)`.

### 6. Pagamento manual (partnerAdminAction → mark_commission_paid)
- comissão `approved` + super_admin → vira `paid` + AuditLog `COMMISSION_PAID`.
- comissão `pending` → 400 `not_approved`.
- caller sem `is_super_admin` → 403 `FORBIDDEN`.

### 7. Tenant isolation
- `partnerData` exige token válido — `partner_id` derivado do hash, nunca do payload.
- `partnerAdminAction` exige `user.is_super_admin`.
- Commission/Referral nunca expostos sem auth.

### 8. Rate limit + idempotência
- `partnerRegister`: 5 cadastros/hora por IP → 6º retorna 429.
- `trackReferralClick`: 20/hora por IP → 21º retorna 429.
- `trackReferralClick` com mesmo fingerprint+code na última 1h → reusa Referral.

### 9. Magic link auth
- `request_magic_link` para email inexistente → responde uniforme `{success:true}` (anti-enum).
- token expirado (>15min) → 401 `token_expired`.
- token consumido → 401 (limpo do DB).
- partner suspended → 403.

### 10. Sanitização
- Strings com `<script>` em `name`/`notes` são removidas.
- CPF/telefone aceitam apenas dígitos.

## Como rodar

Atualmente o projeto não tem suite automatizada via CI para Deno functions. Os cenários acima são contratos a serem validados manualmente via:

1. **Playground manual**: cadastrar parceiro via `/parceiro/cadastro` → aprovar em `/master/partners` → fazer checkout com `?ref=CODE` em janela anônima.
2. **Test endpoints**: usar `test_backend_function` (Base44) para invocar cada function com payloads conhecidos.
3. **Logs**: `SecurityEvent` + `AuditLog` devem refletir cada cenário descrito acima.

> Próximo passo (fora do MVP): migrar para Vitest com mocks completos do Base44 SDK.