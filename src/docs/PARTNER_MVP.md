# Partner MVP — Programa de Afiliados Recorrentes

Sistema de indicação para aquisição orgânica de barbearias. **MVP** focado em validar o modelo antes de expandir.

## 1. Conceito

Pessoas se cadastram como parceiros → Master aprova manualmente → cada parceiro recebe um **referral_code** (8 chars) → ao indicar uma barbearia que assina o SaaS, recebe **20% de comissão recorrente** sobre cada invoice paga.

## 2. Entidades

| Entidade | Papel |
|---|---|
| **Partner** | Cadastro do parceiro (nome, email, PIX, código, status, %) |
| **Referral** | Visita atribuída ao parceiro (pending → converted → active/cancelled/fraud) |
| **Commission** | Comissão gerada por uma invoice paga (pending → approved → paid) |

Todas em `entities/Partner.json`, `entities/Referral.json`, `entities/Commission.json`.

## 3. Tracking

**Client-side** (`lib/referralTracking.js`):
- Captura `?ref=CODE` da URL.
- Persiste em **localStorage** (fallback `sessionStorage`) por **90 dias**.
- "Último clique vence" — sobrescreve registro anterior.
- Sanitização: `^[A-Za-z0-9_-]{4,32}$`.
- Device fingerprint leve (FNV-1a sobre UA + screen + timezone + lang).

**Server-side**:
- `trackReferralClick` registra um `Referral` pending (idempotente por fingerprint+code/1h).
- `partnerAttribute` é chamado quando a Company nasce — vincula o Referral e roda anti-fraude.

## 4. Anti-fraude

Bloqueia comissão (cria Referral com `status='fraud'`) quando:

| Sinal | Detecção |
|---|---|
| Mesmo email | `Partner.email == Company.owner_email` |
| Mesmo telefone | dígitos batem entre `Partner.phone` e `Company.phone/whatsapp` |
| Mesmo fingerprint | fingerprint do visitante está em `Partner.fingerprint_seen` |

Cada sinal soma 35 pontos; `>=1 sinal` ⇒ fraud. Loga `SecurityEvent` (`suspicious_payload` / `kind: self_referral_detected`) + AuditLog (`REFERRAL_FRAUD_BLOCKED`).

**Hold anti-fraude**: toda comissão nasce com `hold_until = created + 15 dias` e `status='pending'`. O job `approveCommissions` (1x/dia) checa novamente Referral.status e Company.subscription_status antes de aprovar.

## 5. Fluxo Stripe → Commission

No `stripeWebhook`, evento `invoice.paid` (subscription do SaaS principal):

1. Localiza a Company pela `stripe_subscription_id`.
2. Busca o Referral mais recente daquela company (`status='converted'|'active'`).
3. Idempotência: se já existir Commission para `(partner_id, stripe_invoice_id)`, pula.
4. Calcula `amount = invoice.amount_paid × Partner.commission_percentage / 100`.
5. Cria Commission `pending` com `hold_until = +15 dias`.
6. No primeiro pagamento, marca `Referral.status='active'` e `first_payment_at`.

Eventos de churn:
- `customer.subscription.deleted` → todas Commissions `pending` da company viram `cancelled` (`churn_rapido` se < 7 dias).
- `charge.refunded` → Commission da invoice estornada vira `chargeback`.

## 6. Pagamento (manual)

Master vê em `/master/partners` as comissões `approved` agrupadas por parceiro. Quando paga via PIX externamente, marca como `paid` informando `payment_reference` (ID da transação). Tudo logado em AuditLog.

Não há payout automático nesta fase.

## 7. Segurança

- **Tenant isolation**: comissões/referrals carregam `partner_id`; `partnerData` exige `auth_token` válido e nunca aceita `partner_id` do payload.
- **Rate limit persistente**: `partnerRegister` 5/h por IP, `trackReferralClick` 20/h por IP.
- **Auth Master**: `partnerAdminAction` exige `user.is_super_admin`.
- **Idempotência**: Commission usa `(partner_id, stripe_invoice_id)` como chave única implícita.
- **Sanitização**: todos inputs públicos passam por `_sanitize` (trim, strip tags, strip control chars).

## 8. Functions

| Function | Auth | Papel |
|---|---|---|
| `partnerRegister` | public | Cadastro inicial (status=pending) |
| `partnerAuth` | public + token | Magic link, sessão, perfil |
| `trackReferralClick` | public | Registra clique no link |
| `partnerAttribute` | public/system | Vincula Referral a Company (anti-fraude) |
| `partnerData` | token | Painel do parceiro (KPIs, listas) |
| `partnerAdminAction` | super_admin | Master: aprovar/suspender/pagar |
| `approveCommissions` | scheduled | Aprova comissões com hold vencido |

## 9. Observabilidade

Eventos logados em `AuditLog`:
`PARTNER_CREATED`, `PARTNER_APPROVED`, `PARTNER_SUSPENDED`, `PARTNER_REACTIVATED`, `PARTNER_UPDATED`, `PARTNER_LOGIN`, `REFERRAL_CONVERTED`, `REFERRAL_FRAUD_BLOCKED`, `COMMISSION_GENERATED`, `COMMISSION_APPROVED`, `COMMISSION_PAID`, `COMMISSION_CANCELLED`.

`SecurityEvent` (`suspicious_payload`) em fraudes detectadas.

## 10. Não escopo deste MVP

- ❌ Ranking / gamificação
- ❌ Landing page personalizada por parceiro
- ❌ Payout automático (Stripe Connect para parceiros)
- ❌ QR code / materiais
- ❌ Múltiplos níveis (regional)
- ❌ White-label
- ❌ Saque por aplicativo

Tudo isso é Fase 2.