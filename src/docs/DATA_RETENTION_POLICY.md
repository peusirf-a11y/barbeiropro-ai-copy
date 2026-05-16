# Política de Retenção de Dados
> Versão: 1.0 | Atualizado: 2026-05-16

## Princípio

Dados pessoais são retidos **apenas pelo tempo necessário** para a finalidade que motivou sua coleta,
respeitando obrigações legais e a necessidade operacional do negócio.

---

## Tabela de Retenção

| Categoria | Entidade | Retenção | Base para retenção | Ação após prazo |
|-----------|---------|---------|-------------------|----------------|
| **Agendamentos** | Appointment | 5 anos | Operacional / fiscal | Anonimizar dados pessoais, manter métricas agregadas |
| **Dados fiscais / financeiros** | FinancialEntry | **10 anos** | Código Tributário Nacional (Art. 195) | Não pode ser excluído antes do prazo |
| **Comissões** | Commission | 5 anos | CLT / Trabalhista | Anonimizar referência ao profissional |
| **Cadastro de clientes** | Customer | Enquanto ativo + 5 anos após última visita | Operacional | Anonimizar ou excluir |
| **Mensagens WhatsApp** | WhatsAppMessage | **6 meses** | Operacional / logs | Excluir automaticamente |
| **Logs de auditoria geral** | AuditLog | **6 meses** | Segurança | Excluir automaticamente |
| **Logs de auditoria LGPD** | PrivacyAuditLog | **10 anos** | Evidência jurídica | Nunca excluir automaticamente |
| **Consentimentos** | CustomerConsent | **10 anos** | Evidência jurídica | Nunca excluir automaticamente |
| **Tokens de sessão** | Customer.auth_token | **30 dias** | Segurança | Expiração automática |
| **Tokens de reset** | Customer.reset_token | **1 hora** | Segurança | Expiração automática |
| **Tokens de confirmação** | Appointment.confirm_token | **30 dias** | Segurança | Limpeza automática |
| **Tokens de avaliação** | Appointment.review_token | **30 dias** | Segurança | Limpeza automática |
| **Avaliações publicadas** | Review | 5 anos | Legítimo interesse | Anonimizar nome |
| **Avaliações não publicadas** | Review | **6 meses** | — | Excluir automaticamente |
| **Reservas de slot** | SlotReservation | **30 minutos** | TTL automático | Expiração automática |
| **Dados de CPF (Pix)** | Appointment.payer_tax_id | **Imediatamente após pagamento** | Minimização | Limpar após confirmação |
| **Sessões de impersonação** | ImpersonationSession | **2 anos** | Segurança / auditoria | Arquivar |

---

## Jobs de Limpeza Automática

Os seguintes processos devem rodar periodicamente para aplicar a política:

### Diário
- Limpar `auth_token` expirado (> 30 dias sem uso)
- Limpar `reset_token` expirado (> 1 hora)
- Limpar `confirm_token` e `review_token` expirados (> 30 dias)
- Limpar `payer_tax_id` de agendamentos com `payment_status = succeeded`

### Semanal
- Excluir `WhatsAppMessage` com `sent_at` > 6 meses
- Excluir `AuditLog` com `created_date` > 6 meses
- Excluir `Review` não publicadas com `created_date` > 6 meses

### Mensal
- Identificar clientes inativos há > 5 anos (sem agendamentos) → notificar para anonimização

---

## Anonimização vs. Exclusão

**Anonimização** é preferível à exclusão quando:
- Existem registros financeiros vinculados (obrigação fiscal)
- Existem métricas agregadas que perderiam valor com exclusão
- O profissional tem comissões vinculadas

**Exclusão** é aplicável quando:
- O cliente solicita e não há obrigação legal de retenção
- Não há registros financeiros vinculados

---

## Dados que NUNCA devem ser excluídos antes do prazo mínimo

1. `FinancialEntry` (10 anos — fiscal)
2. `CustomerConsent` (10 anos — evidência jurídica)
3. `PrivacyAuditLog` (10 anos — evidência jurídica)
4. `Commission` (5 anos — trabalhista)

---

*Próxima revisão: a cada 12 meses ou após mudanças legislativas.*