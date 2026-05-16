# Fluxo de Consentimento — LGPD
> Versão: 1.0 | Atualizado: 2026-05-16

## Princípios

1. **Granularidade**: cada finalidade tem seu próprio consentimento
2. **Clareza**: linguagem simples, sem jargão jurídico
3. **Opt-in real**: marketing NUNCA é pré-marcado
4. **Revogabilidade**: qualquer consentimento pode ser revogado a qualquer momento
5. **Auditabilidade**: cada consentimento é registrado com timestamp, IP e versão do texto

---

## Mapa de Consentimentos

### Consentimentos OPERACIONAIS (não exigem opt-in explícito, mas devem ser registrados)

| Tipo | Descrição | Quando coletar | Revogável? |
|------|-----------|---------------|-----------|
| `automated_reminders` | Lembretes de agendamento (24h, 2h antes) | No agendamento | Sim — desativa lembretes |
| `post_service_review` | Pedido de avaliação pós-atendimento | No agendamento | Sim — desativa avaliações |

### Consentimentos de MARKETING (exigem opt-in explícito)

| Tipo | Descrição | Quando coletar | Revogável? |
|------|-----------|---------------|-----------|
| `whatsapp_marketing` | Campanhas, promoções, reativação via WA | No agendamento (opt-in) / Área do cliente | Sim — bloqueia todas as campanhas |
| `email_marketing` | E-mails de promoção, novidades | No agendamento (opt-in) / Área do cliente | Sim — desativa e-mails marketing |
| `ai_recommendations` | Uso de histórico para sugestões de plano | Área do cliente | Sim — desativa recomendações IA |

---

## Onde os Consentimentos são Coletados

### 1. Fluxo de Agendamento Público (`/agendar/:slug`)
- Após identificar o cliente (telefone/nome), antes de confirmar
- Exibir checkboxes separados para cada tipo
- Lembretes e avaliações: pré-marcados (opt-out)
- Marketing WhatsApp / e-mail: **NÃO pré-marcados** (opt-in)
- Registrar em `CustomerConsent` com source=`booking_flow`

### 2. Área do Cliente (`/cliente/:slug`)
- Seção "Privacidade e Consentimentos" no dashboard
- Permite revogar/conceder qualquer consentimento
- Registrar mudanças em `CustomerConsent` + `PrivacyAuditLog`
- source=`customer_dashboard`

### 3. Staff / Admin (em nome do cliente)
- Ao criar cliente manualmente, mostrar checkboxes de consentimento
- Registrar com source=`staff_on_behalf`
- Menor valor probatório — apenas para contextos presenciais

---

## Texto Legal Padrão (versão 1.0)

### whatsapp_marketing
> "Autorizo receber mensagens de marketing, promoções e campanhas via WhatsApp. Você pode revogar este consentimento a qualquer momento na sua área de cliente."

### email_marketing
> "Autorizo receber e-mails de marketing, novidades e promoções. Você pode cancelar a qualquer momento."

### automated_reminders
> "Autorizo receber lembretes automáticos sobre meus agendamentos via WhatsApp."

### post_service_review
> "Autorizo receber solicitação de avaliação após meus atendimentos via WhatsApp."

### ai_recommendations
> "Autorizo o uso do meu histórico de visitas para receber sugestões personalizadas de planos e serviços."

---

## Fluxo de Revogação

1. Cliente acessa `/cliente/:slug` → seção de Privacidade
2. Desativa consentimento
3. Sistema registra `CustomerConsent` com `granted=false, revoked_at=now()`
4. Sistema registra `PrivacyAuditLog` com `action=CONSENT_REVOKED`
5. A partir desse momento, nenhuma campanha do tipo é enviada ao cliente

---

## Guard no Backend (`runLifecycleCampaigns`)

Antes de enviar qualquer campanha de marketing, o backend verifica:
```
CustomerConsent.whatsapp_marketing === true (granted && !revoked_at)
```
Se não houver consentimento, a mensagem é **silenciosamente ignorada** e registrada como `skipped_no_consent`.

---

*Próxima revisão: a cada 12 meses.*