# LGPD — Visão Geral e Compliance
> Versão: 1.0 | Atualizado: 2026-05-16

## Resumo Executivo

Este documento descreve a estratégia de adequação à LGPD (Lei 13.709/2018) do SaaS.
O sistema opera no modelo **controlador (barbearia) + operador (SaaS)**, conforme Art. 39.

---

## Papéis e Responsabilidades

| Ator | Papel LGPD | Responsabilidade |
|------|-----------|-----------------|
| Barbearia (cliente do SaaS) | **Controlador** | Define finalidades, nomeia DPO, responde ao titular |
| SaaS (plataforma) | **Operador** | Processa dados conforme instruções do controlador |
| Cliente final (cliente da barbearia) | **Titular** | Tem todos os direitos do Art. 18 |

---

## Bases Legais Utilizadas (Art. 7º LGPD)

1. **Execução de contrato (inc. V)** — Agendamento, atendimento, notificações operacionais
2. **Obrigação legal (inc. II)** — Dados fiscais, contábeis, trabalhistas
3. **Legítimo interesse (inc. IX)** — CRM, lifecycle, análises de negócio (sempre com balancing test)
4. **Consentimento (inc. I)** — Marketing WhatsApp, e-mail marketing, recomendações de IA

---

## Direitos do Titular (Art. 18) — Implementados

| Direito | Mecanismo | Status |
|---------|----------|--------|
| Acesso | Exportação de dados (JSON) | ✅ Implementado |
| Correção | Edição via área do cliente / staff | ✅ Implementado |
| Anonimização | Função `anonymizeCustomer` | ✅ Implementado |
| Portabilidade | Exportação JSON estruturada | ✅ Implementado |
| Exclusão | Soft-delete + anonimização | ✅ Implementado |
| Revogação de consentimento | Central de Privacidade | ✅ Implementado |
| Informação sobre compartilhamento | Política de Privacidade | ✅ Documentado |
| Oposição | Opt-out de campanhas | ✅ Implementado |

---

## Consentimentos Gerenciados

| Tipo | Obrigatório para uso? | Impacto se recusado |
|------|----------------------|---------------------|
| `automated_reminders` | Não (mas padrão = true) | Sem lembretes automáticos |
| `post_service_review` | Não | Sem pedido de avaliação |
| `whatsapp_marketing` | **NÃO** — opcional | Sem campanhas de retenção/marketing |
| `email_marketing` | **NÃO** — opcional | Sem e-mail marketing |
| `ai_recommendations` | **NÃO** — opcional | Sem sugestões de plano via IA |

---

## Segurança Implementada

- Tokens de sessão com expiração (30 dias)
- Tokens de reset com expiração (1 hora)
- Rate limiting em endpoints públicos
- Isolamento por tenant (company_id em todas as queries)
- Impersonação auditada (ImpersonationSession + AuditLog)
- Hash bcrypt em senhas de clientes
- Masking de dados sensíveis em logs

---

## Retenção de Dados

Ver `docs/DATA_RETENTION_POLICY.md` para detalhes completos.

---

## Incidentes de Segurança

Em caso de incidente (vazamento, acesso não autorizado, etc.):
1. Isolar o tenant afetado imediatamente
2. Registrar no `PrivacyAuditLog` com severity=critical
3. Notificar a ANPD em até 72h (prazo legal)
4. Notificar os titulares afetados

---

## Checklist de Compliance

- [x] Mapeamento de dados pessoais documentado
- [x] Base legal definida para cada tipo de dado
- [x] Consentimentos separados por finalidade
- [x] Mecanismo de revogação de consentimento
- [x] Exportação de dados (portabilidade)
- [x] Anonimização de dados
- [x] Política de retenção definida
- [x] Auditoria de ações de privacidade
- [x] Isolamento multi-tenant
- [x] Impersonação auditada
- [x] Política de privacidade acessível

---

*Próxima revisão: a cada 12 meses ou após mudanças significativas no produto.*