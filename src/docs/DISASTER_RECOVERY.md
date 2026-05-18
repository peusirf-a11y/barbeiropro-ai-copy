# Disaster Recovery & Backup — O CORTE

> Versão: 1.0 — 2026-05-18
> Owner: Equipe de plataforma
> Revisão: trimestral

---

## 1. Princípios

1. **Idempotência sobre rollback**: nossas funções de mutação críticas
   (`mutateAppointment`, `mutateFinancialEntry`, `mutateCommission`,
   `closeCashRegister`) já são idempotentes — se um job falhar no meio,
   reexecução é segura. Isso reduz a necessidade de restore granular.
2. **Auditoria como fonte da verdade secundária**: `AuditLog` mantém `before`
   e `after` para todas as mutações sensíveis. Em caso de corrupção de
   dados de um tenant, é possível reconstruir o estado a partir do log.
3. **Stripe como livro razão**: para tudo que envolve dinheiro, o Stripe é
   o source of truth. Nossas entidades (`CustomerSubscription`, `Appointment.paid_online`)
   são reconciliadas pelo webhook — perda de uma escrita pode ser recuperada
   re-disparando o webhook ou consultando a API do Stripe.

---

## 2. Backup automático

A Base44 mantém backups automáticos do banco de entidades:

- Snapshot diário (D-1)
- Retenção de 30 dias
- Restore por entidade ou completo, sob solicitação

> **Limitação**: restore parcial por registro não é trivial — sempre vale
> tentar primeiro reconstruir via `AuditLog.before/after` antes de pedir
> restore de banco.

### Backup manual (export)

Para tenants que pedem export completo (LGPD ou desligamento):

1. Rodar `exportCustomerData` por cliente (já existe) — gera JSON com dados
   de um cliente específico.
2. Para empresa inteira: rodar consulta service-role:
   ```
   await base44.asServiceRole.entities.<Entity>.filter({ company_id }, ..., 10000)
   ```
   e empacotar em JSON. Sem necessidade de criar uma função dedicada para isso
   por enquanto — é evento raro.

---

## 3. Cenários e runbooks

### 3.1. Corrupção/perda de dados de um tenant

**Sintoma:** owner reporta dados sumidos / valores errados.

**Passos:**
1. Identificar a janela temporal (quando o problema começou).
2. Abrir `/master/auditoria` filtrando por `company_id` + janela.
3. Para cada `AuditLog` da janela, comparar `before`/`after` com o estado atual.
4. Se for poucos registros: reconstruir manualmente via `impersonatedMutation`
   ou direto via SDK em service role.
5. Se for muitos: contatar suporte Base44 para restore por entidade.

### 3.2. Stripe out-of-sync (assinatura)

**Sintoma:** webhook não chegou, `subscription_status` errado.

**Passos:**
1. Consultar conta Stripe diretamente (`stripe.subscriptions.retrieve`).
2. Rodar `reconcileCustomerSubscription` para o customer afetado.
3. Verificar `/master/financeiro` se MRR está consistente.
4. Stripe permite re-enviar webhooks no dashboard — usar para fluxos críticos.

### 3.3. Vazamento credencial / chave comprometida

**Sintoma:** suspeita de comprometimento de `STRIPE_SECRET_KEY`,
`EVOLUTION_API_KEY`, etc.

**Passos:**
1. **Imediato:** rotacionar a chave no provider externo.
2. Atualizar a secret na Base44 (Dashboard → Secrets).
3. Auditar `AuditLog` e `SecurityEvent` das últimas 48h pelo `actor_email`
   suspeito.
4. Se a chave Stripe foi comprometida: rotacionar **também** o webhook secret
   (`STRIPE_WEBHOOK_SECRET`) e reconfigurar endpoint no dashboard Stripe.
5. Notificar tenants afetados em até 72h (LGPD Art. 48).

### 3.4. Função crítica em loop / consumindo créditos

**Sintoma:** créditos drenando rápido.

**Passos:**
1. `/master/observability` → ver `audit.top_actions` das últimas 24h.
2. Identificar a function/automation responsável.
3. Pausar a automation via `manage_automation` (action="toggle").
4. Investigar logs do Base44 dashboard → Functions → logs.

### 3.5. Webhook Stripe falhando consistentemente

**Sintoma:** `stripeWebhook` retornando 500 / Stripe dashboard mostra falhas.

**Passos:**
1. Verificar `STRIPE_WEBHOOK_SECRET` (env mismatch é causa #1).
2. Ver logs em runtime — geralmente é uma entidade mudou de shape.
3. Stripe re-tenta automaticamente por 3 dias — não precisa correr,
   mas precisa corrigir antes do prazo.

---

## 4. Inventário de pontos críticos

| Recurso | Onde mora | RPO* | RTO* | Recovery |
|---|---|---|---|---|
| Entidades (Customer, Appointment, etc.) | Base44 DB | 24h (snapshot) | < 4h | Restore Base44 |
| Pagamentos | Stripe | 0 (real-time) | < 1h | Webhook replay |
| Sessões | UserSession | 24h | n/a | Re-login |
| Auditoria | AuditLog | 24h | n/a | Imutável (não restaurar) |
| Secrets | Base44 env | n/a | < 30min | Re-set manual |

\* RPO = Recovery Point Objective (quanto pode perder); RTO = Recovery Time Objective.

---

## 5. Checklist de incident recovery

Sempre que um incidente operacional acontecer, registrar em
`/master/auditoria` com a action `LGPD_ACTION` ou `COMPANY_DELETED` (conforme
o caso) e preencher:

- [ ] Causa raiz identificada
- [ ] Dados afetados (qtd registros, tenants, janela)
- [ ] Restore executado (sim/não/parcial)
- [ ] Tenants notificados (sim/não — LGPD Art. 48 exige em 72h se houver risco)
- [ ] Mitigação permanente (PR, automation, etc.)
- [ ] Post-mortem (link)

---

## 6. Testes de recovery

Recomendado a cada **trimestre**:

1. **Smoke test de restore**: pedir restore de uma entidade de baixo risco
   (ex: `Review`) para snapshot D-1 e validar.
2. **Webhook replay**: forçar Stripe a re-enviar um evento de teste
   (`checkout.session.completed`) e validar que entidade ficou consistente.
3. **Rotação de secret**: trocar `STRIPE_WEBHOOK_SECRET` em modo test
   e validar que `stripeWebhook` continua funcionando após atualizar a secret.

---

## 7. Quem contactar

- **Base44 suporte (restore de banco)**: via dashboard do app
- **Stripe suporte**: dashboard Stripe → Help
- **Owner técnico**: ver `/master/usuarios` filtrando por `role=super_admin