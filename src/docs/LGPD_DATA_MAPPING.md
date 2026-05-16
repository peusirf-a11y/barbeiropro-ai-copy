# Mapeamento de Dados Pessoais — LGPD
> Versão: 1.0 | Atualizado: 2026-05-16

Este documento lista todos os dados pessoais coletados, processados ou armazenados pelo sistema,
com finalidade, base legal, sensibilidade e política de retenção.

---

## 1. Dados dos Clientes (`Customer`)

| Campo | Dado pessoal | Finalidade | Base legal (LGPD Art. 7º) | Retenção | Sensibilidade |
|-------|-------------|-----------|--------------------------|----------|---------------|
| name | Nome completo | Identificação, atendimento | Execução de contrato (inc. V) | Ativo + 5 anos | Baixa |
| phone | Telefone/WhatsApp | Contato operacional, lembretes | Execução de contrato (inc. V) | Ativo + 5 anos | Média |
| email | E-mail | Confirmações, login área cliente | Execução de contrato (inc. V) | Ativo + 5 anos | Média |
| notes | Observações | Personalização do serviço | Legítimo interesse (inc. IX) | Ativo + 2 anos | Baixa |
| tags | Tags/categorias | Segmentação CRM | Legítimo interesse (inc. IX) | Ativo + 2 anos | Baixa |
| lifecycle_status | Status de vida do cliente | Retenção automatizada | Legítimo interesse (inc. IX) | Ativo + 1 ano | Baixa |
| favorite_service / favorite_professional | Preferências | Personalização | Legítimo interesse (inc. IX) | Ativo + 2 anos | Baixa |
| total_appointments | Contador de visitas | Métricas, elegibilidade planos | Execução de contrato (inc. V) | Ativo + 5 anos | Baixa |
| last_completed_at | Data última visita | CRM, lifecycle | Execução de contrato (inc. V) | Ativo + 2 anos | Baixa |
| password_hash | Hash de senha | Autenticação área cliente | Execução de contrato (inc. V) | Enquanto conta ativa | Alta |
| auth_token | Token de sessão | Autenticação | Execução de contrato (inc. V) | 30 dias (expiração automática) | Alta |
| reset_token | Token de reset | Segurança | Execução de contrato (inc. V) | 1 hora (expiração automática) | Alta |

---

## 2. Dados de Agendamentos (`Appointment`)

| Campo | Dado pessoal | Finalidade | Base legal | Retenção | Sensibilidade |
|-------|-------------|-----------|-----------|----------|---------------|
| customer_name | Nome | Identificação no atendimento | Execução de contrato | 5 anos | Baixa |
| customer_phone | Telefone | Notificações | Execução de contrato | 5 anos | Média |
| customer_email | E-mail | Confirmações | Execução de contrato | 5 anos | Média |
| scheduled_at | Data/hora | Gestão da agenda | Execução de contrato | 5 anos | Baixa |
| price | Valor pago | Financeiro/fiscal | Obrigação legal (inc. II) | **10 anos (NF/fiscal)** | Baixa |
| payment_method | Forma de pagamento | Financeiro | Obrigação legal (inc. II) | 5 anos | Baixa |
| payment_intent_id | ID Stripe | Conciliação financeira | Obrigação legal (inc. II) | 5 anos | Baixa |
| payer_tax_id | CPF | Pagamento Pix | Execução de contrato | **Limpar após confirmação** | Alta |

---

## 3. Dados Financeiros (`FinancialEntry`)

| Campo | Dado pessoal | Base legal | Retenção |
|-------|-------------|-----------|----------|
| amount, date, description | Receita/despesa | Obrigação legal fiscal | **10 anos** |
| customer_id | Vinculação ao cliente | Obrigação legal | 10 anos |
| professional_id | Vinculação ao profissional | Obrigação legal | 10 anos |

---

## 4. Mensagens WhatsApp (`WhatsAppMessage`)

| Campo | Dado pessoal | Base legal | Retenção |
|-------|-------------|-----------|----------|
| phone | Telefone | Depende do tipo | Ver abaixo |
| message_text | Conteúdo da mensagem | Depende do tipo | 6 meses |
| customer_name | Nome | Operacional | 6 meses |

**Tipos e bases legais:**
- `confirmacao`, `lembrete_24h`, `lembrete_2h`, `pos_atendimento` → **Execução de contrato** (sem consentimento adicional necessário)
- `reativacao`, `crm_*`, campanhas → **Consentimento explícito** (requer `CustomerConsent.whatsapp_marketing = true`)

---

## 5. Avaliações (`Review`)

| Campo | Dado pessoal | Base legal | Retenção |
|-------|-------------|-----------|----------|
| customer_name | Nome | Legítimo interesse | 5 anos (publicações) |
| rating, comment | Opinião | Legítimo interesse | 5 anos |
| nps_score | NPS | Legítimo interesse | 2 anos |
| ip (indiretamente) | IP | Execução de contrato | 6 meses |

---

## 6. Logs e Auditoria (`AuditLog`)

| Campo | Dado pessoal | Base legal | Retenção |
|-------|-------------|-----------|----------|
| actor_email | E-mail do ator | Legítimo interesse / Segurança | **6 meses** |
| ip_address, user_agent | Dados de acesso | Segurança / Obrigação legal | 6 meses |
| before, after | Dados alterados | Segurança | 6 meses |

---

## 7. Comissões (`Commission`)

| Campo | Base legal | Retenção |
|-------|-----------|----------|
| professional_id, amount, earned_at | Obrigação legal trabalhista | **5 anos** |

---

## 8. Consentimentos (`CustomerConsent`) — novo

| Campo | Finalidade | Retenção |
|-------|-----------|----------|
| Todos | Prova de consentimento para auditoria | **10 anos** (evidência jurídica) |

---

## 9. Dados NÃO coletados (minimização aplicada)

O sistema **não coleta**:
- RG
- Data de nascimento (exceto quando voluntariamente informada em notes)
- Dados de saúde
- Dados biométricos
- Dados de origem racial/étnica
- Dados políticos ou religiosos

---

## 10. Transferências de Dados

| Destinatário | Dados transferidos | Base legal | País |
|-------------|-------------------|-----------|------|
| Stripe | Dados de pagamento, CPF (Pix) | Execução de contrato | EUA (BCR/SCCs) |
| Evolution API / Z-API | Telefone, nome, texto | Execução de contrato (WA) | Brasil |
| Base44 (plataforma) | Todos os dados | Execução de contrato | Brasil |

---

## 11. Encarregado (DPO)

O responsável pelo tratamento de dados é a **barbearia titular da conta** (controlador).
O SaaS atua como **operador** nos termos do Art. 39 da LGPD.

Cada barbearia deve nomear seu DPO ou responsável e informar nos seus termos de uso.

---

*Próxima revisão: a cada 12 meses ou após mudanças significativas no produto.*