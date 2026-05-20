# Load Test Plan — O Corte SaaS

**Documento:** Plano executável para teste de carga PROFISSIONAL  
**Status:** Planning · não-executado dentro do Base44 (ver §1)  
**Última revisão:** 2026-05-20

> Este documento descreve **como** validar carga, concorrência e estabilidade do O Corte em ambiente apropriado. **Não** roda dentro da própria plataforma Base44 — testes de carga reais exigem infra dedicada (k6 cloud, Artillery, ambiente staging com Stripe Test).

---

## 1. Por que NÃO rodamos load test dentro do Base44

O runner de functions Base44 (`runFoundationTests`) é ótimo para testes determinísticos sem rede:
- ✅ Validação de lógica (slot lock, idempotency, cross-tenant)
- ✅ Regressões de auth flow
- ✅ Edge cases de sanitização

Mas **não substitui load test real** porque:
- ❌ Isolamento por request — sem paralelismo verdadeiro entre callers.
- ❌ Mock in-memory — não exercita índices, conexões, latência de storage real.
- ❌ Stripe LIVE — disparar 1k PaymentIntents seria custo + ruído + risco de incidente.
- ❌ Rate limit dispara contra a própria infra — atacaríamos a app que está atendendo barbearias reais.

**Solução:** Plano executável em ambiente staging dedicado, com Stripe Test mode, banco isolado, observabilidade habilitada.

---

## 2. Arquitetura de Teste

```
┌─────────────────────┐
│   k6 / Artillery    │   ← runner (laptop, GitHub Actions, ou k6 Cloud)
│   (gerador de carga)│
└──────────┬──────────┘
           │ HTTPS
           ▼
┌─────────────────────┐
│  STAGING (Base44)   │   ← clone do app em workspace separado
│  - app.staging.url  │
│  - Stripe Test mode │
│  - DB isolado       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Observabilidade    │   ← logs estruturados + Grafana/Datadog
│  - request_id       │
│  - duration_ms      │
│  - SecurityEvent    │
└─────────────────────┘
```

**Pré-requisitos:**
1. Workspace **staging** do Base44 com snapshot do schema produção.
2. Secrets staging: `STRIPE_SECRET_KEY` (test mode), `STRIPE_WEBHOOK_SECRET` (test endpoint), `APP_URL` apontando para staging.
3. **Seed data**: 10 Companies de teste, 5 Professionals e 20 Services cada, 200 Customers/Company.
4. Rate limits relaxados em staging via env var (ex.: `BOOKING_RATE_LIMIT_PER_HOUR=10000`) — load test não é o lugar pra testar rate limit (isso é teste funcional separado).

---

## 3. Cenários

### 3.1 Booking público massivo

**Objetivo:** validar slot lock sob concorrência real.

**Setup:**
- 100 VUs (virtual users)
- Ramp-up 30s
- Sustained 5min
- Cada VU loop: GET slug → POST `createPublicAppointment` com slot aleatório dentro de janela 24h

**Métricas alvo:**
| Métrica | Alvo | Aceitável | Falha |
|---|---|---|---|
| Success rate (HTTP 2xx) | > 95% | > 90% | < 90% |
| 409 (slot_taken) | < 10% | < 20% | > 20% (indica race excessivo) |
| 500 (server error) | 0% | < 0.5% | > 0.5% |
| P95 latency | < 800ms | < 1500ms | > 1500ms |
| P99 latency | < 1500ms | < 3000ms | > 3000ms |
| Duplicate bookings (mesmo slot_key, 2 Appointments active) | **0** | **0** | **> 0 = bug crítico** |

**Pós-validação:**
```
# No staging, rodar:
SELECT slot_key, COUNT(*) FROM Appointment 
WHERE status IN ('agendado', 'aguardando_pagamento') 
GROUP BY company_id, professional_id, scheduled_at 
HAVING COUNT(*) > 1;
# Esperado: 0 rows.
```

---

### 3.2 Login / Auth público

**Objetivo:** validar PBKDF2 sob load (PBKDF2 é CPU-bound — 100k iterations × N VUs pode estourar).

**Setup:**
- 50 VUs
- Mix: 70% login, 20% signup, 10% magic_link
- Sustained 3min

**Métricas alvo:**
| Métrica | Alvo |
|---|---|
| Login P95 | < 600ms (PBKDF2 ~200ms cold) |
| Signup P95 | < 700ms |
| Rate limit hits | < 5% (devem ser VUs legítimas) |

**Sinal de alarme:** se P99 > 3s, PBKDF2 está saturando CPU do runtime. Mitigação: reduzir iterations para 50k OU adicionar worker pool dedicado.

---

### 3.3 Stripe Webhook flood

**Objetivo:** validar idempotência sob bombardeio de eventos duplicados.

**Setup:**
- 20 VUs
- Cada VU: POST `/functions/stripeWebhook` com mesmo `event.id` repetido 10x
- Variação: `event.id` único mas mesmo `payment_intent.id`

**Métricas alvo:**
- 100% dos requests retornam 200
- Apenas 1 Appointment promovido para `agendado` por payment_intent
- Apenas 1 email de confirmação disparado por payment_intent
- `IdempotencyKey` com `event.id` aparece exatamente 1 vez por evento único

**Verificação:**
```sql
-- Cada appointment_id deve ter no máximo 1 'paid_online: true' update.
SELECT appointment_id, COUNT(*) FROM AuditLog 
WHERE action LIKE 'STRIPE%' 
GROUP BY appointment_id HAVING COUNT(*) > 1;
```

---

### 3.4 Listagens com volume

**Objetivo:** detectar queries lentas em listagens críticas.

**Setup:**
- Seed: 1 Company com 50k Appointments distribuídos em 6 meses
- 30 VUs concorrentes chamando `listAppointments` com filtros variados (date_range, professional_id, customer_id)

**Métricas alvo:**
| Endpoint | P95 |
|---|---|
| `listAppointments` (30 dias) | < 400ms |
| `listAppointments` (6 meses) | < 1500ms |
| `listCustomers` (paginado 50/page) | < 300ms |
| `getCashAudit` (1 dia) | < 500ms |
| `getMasterMetrics` (todas Companies) | < 2000ms |

**Sinal de alarme:** P95 escalando linearmente com volume = falta de paginação ou índice ausente.

---

### 3.5 Drag-and-drop concorrente (agenda)

**Objetivo:** validar comportamento de last-write-wins em mutateAppointment.

**Setup:**
- 5 VUs simulando 5 recepcionistas
- Todos tentando mover o MESMO appointment_id para slots diferentes em rajadas de 100ms

**Métricas alvo:**
- 0 erros 500
- O appointment fica no slot do ÚLTIMO write (Last-Write-Wins é aceito)
- Cada write gera 1 AuditLog → 5 logs no total
- **Sinal de alarme:** se algum write "perde" sem aparecer no log → bug de auditoria

→ **Esta é a evidência de que precisamos de versioning (item RT-01 da auditoria).**

---

### 3.6 LGPD: exportação concorrente

**Objetivo:** validar que rate limit por usuário impede mass-export abuse.

**Setup:**
- 1 VU master tentando exportar 100 customers em sequência rápida
- 10 VUs admins tentando exportar 5 customers cada em paralelo

**Métricas alvo:**
- VU master é bloqueada após N exports (`riskEngine.assessMassExport`)
- 10 admins concorrentes: 100% sucesso (legítimo)
- `PrivacyAuditLog` com action `DATA_EXPORT_REQUESTED` registra TODOS os attempts (incluindo bloqueados)

---

## 4. KPIs Globais

| KPI | Definição | Alvo Produção |
|---|---|---|
| **Availability** | (200 + 4xx legítimos) / total | > 99.5% |
| **Error rate** | 5xx / total | < 0.5% |
| **Throughput** | RPS sustentado sem degradação | `[REQUER MEDIÇÃO]` |
| **P95 latency** | Percentil 95 de duração | < 1s para CRUD, < 2s para agregações |
| **P99 latency** | Percentil 99 | < 3s |
| **Race conditions** | Duplicate slot bookings detectados | 0 |
| **Idempotency violations** | Webhook duplicado causando efeito 2x | 0 |
| **Rate limit precision** | % de blocks corretos (não FP) | > 95% |
| **Memory leak (frontend)** | Heap crescendo > 50% em 5min de uso | 0 incidências |

---

## 5. Limites Seguros (não cruze em produção)

| Operação | Limite seguro |
|---|---|
| Booking público / IP / hora | 15 (hard block atual) |
| Login attempt / email / 5min | 5 |
| Magic link / email / 15min | 3 |
| Export de Customer / admin / hora | 5 (recomendação) |
| Anonimização / admin / dia | 3 (`riskEngine.assessMassAnonymization`) |
| Webhook Stripe burst | sem limite (idempotência protege) |
| Concurrent sessions / user | 5 (acima → risco alto) |

Estes limites estão **codificados nas functions**. Load test em staging deve relaxá-los; produção mantém.

---

## 6. Ferramentas Recomendadas

### k6 (preferido)
```bash
brew install k6
k6 run scripts/load/booking-public.js \
  --vus 100 --duration 5m \
  -e STAGING_URL=https://staging.ocorte.com.br
```

**Vantagens:** scripts em JS, métricas nativas (P95/P99/RPS), output Prometheus/Grafana.

### Artillery (alternativa)
```bash
npm i -g artillery
artillery run scripts/load/booking-public.yml
```

**Vantagens:** YAML declarativo, plugins para Stripe/SQS.

### Para frontend (browser performance)
- **Lighthouse CI** em rotas críticas (`/agendar/:slug`, `/cliente/:slug`)
- **Chrome DevTools Performance** para heap snapshots
- **React Profiler** para render time

---

## 7. Exemplos de Scripts (templates)

### Template k6 — Booking Massivo

Salvar como `scripts/load/booking-public.js` (NÃO commitar URL de produção):

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const URL = __ENV.STAGING_URL;
const COMPANY_SLUG = __ENV.COMPANY_SLUG || 'staging-co-1';

const slotTaken = new Counter('slot_taken_409');
const successDuration = new Trend('success_duration');

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    slot_taken_409: ['count<1000'],
  },
};

export default function () {
  // 1. Pega company info pública
  const company = http.get(`${URL}/api/public/company/${COMPANY_SLUG}`).json();

  // 2. Escolhe slot aleatório nas próximas 24h
  const futureMs = Date.now() + Math.random() * 24 * 60 * 60 * 1000;
  const scheduledAt = new Date(Math.floor(futureMs / 60000) * 60000).toISOString();

  // 3. Tenta criar appointment (assume customer_id pré-autenticado em staging)
  const payload = {
    company_id: company.id,
    professional_id: company.professionals[0].id,
    service_id: company.services[0].id,
    customer_id: __ENV.TEST_CUSTOMER_ID,
    customer_name: 'Load Test',
    customer_phone: '11999999999',
    scheduled_at: scheduledAt,
    idempotency_key: `loadtest_${__VU}_${__ITER}_${Date.now()}`,
  };

  const res = http.post(
    `${URL}/api/functions/createPublicAppointment`,
    JSON.stringify(payload),
    { headers: { 'Content-Type': 'application/json', 'X-Base44-Token': __ENV.TEST_TOKEN } },
  );

  check(res, {
    '2xx ou 409 esperado': (r) => [200, 409].includes(r.status),
    'sem 5xx': (r) => r.status < 500,
  });

  if (res.status === 409) slotTaken.add(1);
  if (res.status === 200) successDuration.add(res.timings.duration);

  sleep(1 + Math.random()); // jitter
}
```

---

## 8. Rollback Plan

Se durante teste em staging encontrarmos:
- **Race condition reproduzível** → abre task crítica · NÃO rolar pra prod.
- **P99 > 5s** → investigar antes de aumentar volume em prod.
- **Memory leak** → abre task crítica.
- **Erros 5xx > 1%** → bloqueio, investigar.

**Em produção:**
- Toda mudança que afete throughput passa por **canary**: deploy 10% → 50% → 100%.
- Job de cleanup deve continuar rodando (`cleanupExpiredBookingPayments`, `repairStuckCashRegisters`).
- Monitorar `SystemAlert(severity:'critical')` no MasterSecurityCenter em tempo real durante deploy.

---

## 9. Checklist Pré-Produção

Antes de promover qualquer feature de pagamento/agenda:

- [ ] Cenários 3.1 e 3.3 executados em staging
- [ ] 0 duplicate bookings detectados
- [ ] 0 webhook side-effects duplicados
- [ ] P95 dentro de alvo
- [ ] Logs `request_id` presentes em 100% dos requests
- [ ] `SecurityEvent` apenas onde esperado (rate limits, anti-enum)
- [ ] `AuditLog` para toda mutation crítica
- [ ] Stripe Test webhook conectado e respondendo 200
- [ ] Smoke tests `runFoundationTests` → 76/76 ✅
- [ ] CSP em enforcement validado (sem violations em staging)

---

## 10. Checklist Observabilidade

Antes do load test, garantir:

- [ ] Logs estruturados visíveis em dashboard (Base44 Functions logs)
- [ ] `request_id` presente em logs de error
- [ ] `SecurityEvent` gravados sob load
- [ ] `IdempotencyKey` snapshot inspecionável
- [ ] `MasterObservability` mostrando RPS por function
- [ ] `getEmailHealth` operacional (Resend está OK)
- [ ] `runSystemCheck` retornando green
- [ ] Alertas configurados para: `stripe_env_mismatch`, `payment_failed`, `subscription_canceled`

---

## 11. Checklist Incident Response

Durante o teste, se algo quebrar:

1. **Pare o gerador imediatamente** (k6 `Ctrl+C`).
2. **Capture o estado**: timestamp, `request_id` afetados, query do banco.
3. **Verifique se afeta produção**: staging deve ser isolado, mas confirmar.
4. **Aborte rollout** se já estiver em canary.
5. **Documente** o incidente em `docs/INCIDENT_RESPONSE.md` (já existe — apenas anexar).
6. **Não tente "consertar correndo"**: rolle back, investigue com calma, re-execute o teste.

---

## 12. Métricas Honestas — O Que NÃO Vamos Prometer

Para não criar expectativa falsa:

- ❌ **Não temos benchmarks de RPS sustentado em produção.** A plataforma Base44 abstrai isso; só medindo em staging dá pra estimar.
- ❌ **Não temos APM nativo** (Datadog/New Relic). Mitigação: logs estruturados + `MasterObservability`.
- ❌ **Não temos trace correlation cross-function automático.** Aceitar workaround via metadata propagada (item OBS-01 da auditoria).
- ❌ **Não vamos rodar 100% destes cenários antes de produção** — os cenários 3.1 e 3.3 são bloqueadores; os outros são desejáveis.

---

## 13. Resumo Executável

| Quando rodar | Cenários |
|---|---|
| **Antes de release crítica de pagamento** | 3.1 (booking), 3.3 (webhook), 3.5 (drag) |
| **Antes de release de Master features** | 3.4 (listagens) |
| **Trimestralmente** | TODOS |
| **Quando ultrapassar 100 tenants ativos** | TODOS + verificar PERF-03 (master metrics) |
| **Quando ultrapassar 1000 tenants** | TODOS + plano de sharding revisado |

---

## Apêndice A — Variáveis de Ambiente para Staging

```bash
# Staging
STAGING_URL=https://staging.ocorte.com.br
STRIPE_SECRET_KEY=sk_test_***
STRIPE_WEBHOOK_SECRET=whsec_***test
APP_URL=https://staging.ocorte.com.br

# Relaxar para load test
BOOKING_RATE_LIMIT_PER_HOUR=100000
SLOT_RESERVATION_TTL_SECONDS=90
CORS_ORIGIN=https://staging.ocorte.com.br

# Test fixtures
TEST_COMPANY_ID=co_staging_001
TEST_CUSTOMER_ID=cu_staging_001
TEST_TOKEN=base44_test_***
```

**Nunca commitar estes valores.** Use `.env.staging.local` ou GitHub Secrets.

---

## Apêndice B — Output Esperado de `runFoundationTests` em Staging

Mesmo em staging, o smoke runner continua sendo a primeira linha de defesa:

```
[runFoundationTests]
✅ lib/dates           9/9 pass
✅ lib/money          11/11 pass
✅ lib/errorCodes      7/7 pass
✅ lib/whatsappCompose 14/14 pass
✅ mockBase44          7/7 pass
✅ publicBooking/authGate 28/28 pass
... (módulos novos da expansão Sprint Hardening)
TOTAL: 76+ pass / 0 fail
```

Se algum módulo falhar em staging → **bloqueio total de promoção para produção.**

---

**Documento mantido junto ao código. Atualizar a cada release crítica.**