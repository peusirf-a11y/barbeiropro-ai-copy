# Playbook — Migração SaaS Stripe → Asaas

> Guia operacional do Master para mover barbearias do Stripe para o Asaas sem
> interromper o serviço e sem cobrar em duplicidade. Etapa 4 da migração geral
> (ver `ASAAS_MIGRATION.md`).

## Modelo: Soft Migrate

```
T+0 → Master clica "Migrar agora"
      • cria Customer Asaas
      • cria Subscription Asaas (D+5)
      • Stripe SEGUE COBRANDO normalmente
      • Email é enviado ao owner
      • Company.billing_provider='asaas_pending'
      • Company.migration_status='pending_first_payment'

T+5 → Asaas envia 1ª fatura ao owner

T+? → Owner paga 1ª fatura Asaas
      • webhook PAYMENT_RECEIVED chega no asaasWebhook
      • Helper cancelStripeAfterAsaasConfirmation cancela Stripe Subscription
      • Company.billing_provider='asaas'
      • Company.migration_status='migrated'
      • AuditLog SUBSCRIPTION_CANCELLED

T+14 (SLA) → Se 1º pgto Asaas não chegou, alerta interno (futuro: cron).
```

**Garantia central:** Stripe nunca é cancelado antes do Asaas confirmar pagamento.
Se Asaas falhar em qualquer ponto, Stripe segue cobrando normalmente e o estado é
revertido para `migration_status='failed'`.

## Pré-requisitos por Company

Antes de migrar, confira:

- [ ] `Company.billing_provider === 'stripe'`
- [ ] `Company.stripe_subscription_id` presente (sub ativa)
- [ ] `Company.owner_cpf_cnpj` preenchido (Asaas exige)
- [ ] `Company.owner_email` válido
- [ ] `Company.phone` ou `whatsapp` com 10-13 dígitos
- [ ] `Company.plan_name` ∈ {Starter, Pro, Enterprise}

Se faltar qualquer um, o backend retorna 400 com mensagem específica.

## Como migrar (Master)

1. Acessar `/master/assinaturas`.
2. Rolar até o painel **"Migração Stripe → Asaas"**.
3. Filtrar por **"Stripe ativo"**.
4. Clicar na linha da Company → revisar dados (Stripe sub ID, email, plano).
5. Clicar **"Migrar agora"** → confirmar.
6. Status muda para **"Aguardando 1º pgto."** em segundos.
7. Acompanhar até virar **"Migrada ✓"** (depende de quando o owner paga).

## Estados possíveis

| `migration_status` | `billing_provider` | Significado |
|--------------------|--------------------|-------------|
| `null` ou `not_migrated` | `stripe` | Nunca migrada. Disponível para Master clicar. |
| `pending_first_payment`  | `asaas_pending` | Asaas Subscription criada. Stripe ativo. Aguardando 1ª invoice paga. |
| `migrated`               | `asaas` | 1º pgto Asaas confirmado. Stripe cancelado. Sucesso. |
| `failed`                 | `stripe` | Algo falhou. Stripe intacto. Master pode tentar de novo. |

## E se algo der errado?

### Falha ao criar Customer/Subscription Asaas
- Company fica `migration_status='failed'`.
- `AdminAuditLog severity='critical'` registra `error_code` (`asaas_customer_failed`, etc.).
- Nenhum dado Stripe é alterado.
- Master clica "Migrar agora" de novo após investigar.

### Email não enviado
- Migração continua normal — email é não-fatal.
- Master pode reenviar manualmente via integração de email do próprio admin.
- Owner também recebe o email transacional do Asaas com a fatura.

### Stripe não cancela após pagamento Asaas
- Migração é marcada como `migrated` mesmo assim.
- `AdminAuditLog` registra a falha do cancelamento Stripe.
- Master cancela manualmente no dashboard Stripe ou via API.

### Owner paga Stripe E Asaas no mesmo mês
- Não acontece se o fluxo for respeitado: a 1ª invoice Asaas é gerada para D+5,
  o owner geralmente paga só uma. Se acontecer (raríssimo), Master estorna a
  cobrança Stripe daquele ciclo manualmente.

## Reversibilidade

Antes do 1º pagamento Asaas (estado `pending_first_payment`):
- Master pode contatar suporte Asaas para cancelar a Subscription Asaas.
- Manualmente setar `Company.billing_provider='stripe'` e `migration_status=null`.
- Stripe segue cobrando como antes.

Após `migrated`:
- Não há rollback automático (Stripe já foi cancelado).
- Para reverter: criar nova Stripe Subscription manualmente e re-migrar do Asaas.

## Comunicação ao owner

O email automático cobre:
- Mudança de plataforma de cobrança.
- Garantia de que **o sistema continua funcionando**.
- Garantia de que **não haverá cobrança em duplicidade**.
- Link direto para a 1ª fatura Asaas (PIX/Boleto/Cartão).

Se a barbearia ligar perguntando, o talking point é:
> "Estamos atualizando o sistema de cobrança para o Asaas, que aceita PIX, boleto e cartão na mesma fatura. Sua próxima cobrança virá pelo Asaas. Você não precisa fazer nada — sua cobrança atual no Stripe será encerrada automaticamente quando você pagar a primeira do Asaas. Sem cobrança em duplicidade."

## Monitoramento

Métricas a acompanhar no Master:

- **Companies em `pending_first_payment` há > 7 dias** → cliente não pagou ainda. Considerar follow-up manual.
- **Companies em `failed` repetido** → problema sistêmico (Asaas down? Owner sem CPF?). Investigar.
- **% migrado / % total Stripe original** → progresso da Etapa 4.

Quando 100% das companies estiverem `migrated` ou explicitamente removidas:
→ Pronto para Etapa 5 (desligamento Stripe). Ver `ASAAS_CUTOVER_CHECKLIST.md`.