# O CORTE — Documento Oficial de Especificação e Release do Produto

**Versão:** 1.0 (snapshot do estado implementado em out/2026)
**Classificação:** Documento técnico e de produto (interno)
**Stack:** React + Tailwind (Vite) sobre plataforma Base44 (backend-as-a-service) — banco de dados NoSQL, auth, integrações e hospedagem nativos.

> Este documento descreve **apenas o que está efetivamente implementado e funcional** no código-fonte atual. Não inclui roadmap promocional; funcionalidades marcadas como `hidden`/`soon` no catálogo existem como espaços reservados de arquitetura e não são apresentadas ao usuário.

---

## 1. Propósito e Posicionamento

### Propósito central
O CORTE é um **SaaS vertical para barbearias premium** que combina, em uma única plataforma: agenda online pública, gestão operacional da barbearia (agenda interna, equipe, serviços, caixa, financeiro), CRM/retenção orientado por IA, programa de assinaturas mensais para clientes finais e um programa de indicações B2B (parceiros afiliados).

A arquitetura é **multi-tenant nativa**: cada barbearia (Company) é um tenant isolado, com seus próprios clientes, profissionais, agenda, caixa e financeiro. Sobre todos os tenants há um **painel Master** (super admin da plataforma O CORTE) que governa assinaturas SaaS, feature flags, observabilidade, compliance/LGPD e o programa de parceiros.

### Dor que resolve
- **Barbearia:** gestão fragmentada entre caderninho/WhatsApp/agenda manual, sem visão financeira, sem taxa de retenção mensurável, sem canal próprio de captação de clientes online.
- **Cliente final:** fricção para agendar, sem lembretes, sem plano de assinatura que barateie cortes frequentes.
- **Plataforma O CORTE:** necessidade de cobrança recorrente (assinatura SaaS mensal via Asaas) e de um canal de aquisição escalável (programa de parceiros com comissão recorrente).

### Proposta de valor evidente na aplicação
1. **Link público de agendamento** (`/agendar/:slug`) capta clientes 24/7, com pagamento online (Pix/cartão via Asaas) ou avulso.
2. **Operação integrada:** agenda com drag-and-drop, caixa diário, financeiro, comissões e relatórios no mesmo lugar.
3. **Retenção automatizada:** lifecycle de cliente (fiel → em risco → inativo → perdido) dispara campanhas de WhatsApp automáticas.
4. **Receita recorrente dupla:** a barbearia assina o SaaS (cobrança Asaas) **e** vende planos mensais aos seus clientes (CustomerSubscription).
5. **Programa de indicações:** parceiros indicam barbearias e recebem comissão recorrente sobre a assinatura SaaS delas.

---

## 2. Perfis de Usuário e Permissões

O sistema distingue dois universos: **plataforma** (Master + Parceiros) e **tenant** (equipe da barbearia + clientes finais).

### 2.1 Super Admin (Master)
- **Identidade:** `User` com `is_super_admin = true`. Acesso pelo painel `/master`, protegido por **TOTP 2FA** (`TotpGate`) além da senha.
- **Pode ver/executar:** dashboard executivo (MRR/ARR, métricas de empresas), lista e detalhe 360° de barbearias, gestão de assinaturas SaaS, financeiro da plataforma, usuários, **funcionalidades/feature flags**, auditoria, LGPD, compliance, security center, observability, gerenciador de dados-demo e **programa de parceiros** (aprovar, suspender, pagar comissões).
- **Pode** ainda iniciar **impersonação** de qualquer barbearia (sessão temporária auditada, com banner e contagem regressiva).

### 2.2 Equipe da barbearia (tenant) — papéis
Definidos em `TeamMember.role` e validados por `ROLE_PERMISSIONS`. O backend confia em `serverPermissions.js`, não no mapa do frontend.

| Papel | Acessos principais |
|------|--------------------|
| **admin** (dono/gestor) | Todos os módulos: dashboard, agenda, bloqueios, clientes, serviços, combos, planos, profissionais, caixa, financeiro, comissões, relatórios, ai-growth, crm, avaliações, indicações, equipe, configurações, assinatura. |
| **financeiro** | Dashboard, agenda, clientes, caixa, financeiro, comissões, relatórios, planos. |
| **recepção** | Dashboard, agenda, bloqueios, clientes, serviços, combos, planos, profissionais. **Não** vê financeiro/comissões/relatórios/equipe. |
| **barbeiro** | Apenas dashboard, agenda e clientes (escopo do próprio profissional). |

Permissões granulares do **Caixa** (modelo híbrido: defaults por papel + overrides por `TeamMember.cash_permissions`): abrir/fechar caixa, lançar/editar/excluir lançamento, sangria, suprimento, ver relatórios e ver auditoria. Recepção não fecha, não edita, não exclui e não vê relatórios/auditoria.

**Multi-unidade:** admin/financeiro veem todas as unidades; demais papéis ficam restritos a `TeamMember.unit_ids` (vazio = sem restrição, compatível com mono-unidade).

### 2.3 Cliente final (Customer)
- **Identidade:** registro `Customer` com `password_hash`/`auth_token` próprios (auth paralela à Base44, pela área pública). Login em `/cliente/:slug/login`.
- **Pode:** agendar pelo link público, ver/gestionar seus agendamentos no painel `/cliente/:slug`, contratar e gerenciar planos mensais (`/cliente/:slug/planos`), confirmar presença e avaliar atendimento via tokens públicos.

### 2.4 Parceiro (afiliado)
- **Identidade:** entidade `Partner` com senha/hash próprios + magic link. Acesso ao painel `/parceiro` atrás de `PartnerGuard`.
- **Pode:** ver dashboard de performance (KPIs, ranking, evolução), lista de indicações, comissões (status: hold → aprovado → pago), e configurações (perfil, chave Pix).

---

## 3. Levantamento Completo de Funcionalidades

### 3.1 Onboarding & Checkout (aquisição de barbearias)
- **Landing pública** (`/landing`, `/lancamento`) com hero, comparação de planos, prova social, FAQ e CTAs.
- **Checkout** (`/checkout`): escolha de plano (Starter/Pro/Enterprise), dados da barbearia, **política PJ-first** (exige CNPJ; CPF mostra card de restrição com contato comercial), pagamento via Asaas (cartão tokenizado inline ou Pix/boleto hospedado). Aplica promo de lançamento (`?promo=lancamento` → R$49/mês por 6 meses no Pro). Captura código de indicação `?ref=CODE` e fingerprint do dispositivo.
- **Onboarding** pós-checkout (`/onboarding`, sob `OnboardingGuard`): wizard de configuração inicial da barbearia.
- **Fluxos de acesso:** `/criar-senha`, `/ativar-acesso`, `/acessar-conta`, `/esqueci-senha`, `/resetar-senha` (com hash PBKDF2-SHA256 + pepper em `BarberCredential`).

### 3.2 Dashboard executivo (tenant)
- KPIs do dia (faturamento, agendamentos, taxa de ocupação), agenda de hoje, ranking de profissionais, campanhas de retenção ativas, saúde de ativação e insights de IA.

### 3.3 Agenda
- Visão em colunas por profissional com **drag-and-drop** (`useAgendaDnD`), suporte a mobile (lista).
- Agendamentos com estados (`aguardando_pagamento → agendado → confirmado → em_atendimento → concluido / cancelado / faltou`), origem (online/interno), forma de pagamento, notas.
- Agendamento **flexível** (`is_flexible_assignment`) quando o cliente escolhe "qualquer barbeiro" — card com borda tracejada, arrastável entre colunas.
- **Inteligência de agenda:** pontuação de slots para preencher buracos (`scoreSlot`/`rankSlotsByFit`) — prioriza horários colados a atendimentos/bloqueios existentes sem ocultar opções.
- Conversão automática de agendamento concluído em lançamento financeiro + comissão + solicitação de avaliação (workflows).
- Bloqueio de agenda (`AppBloqueios`): único ou **recorrente semanal**, por profissional ou para toda a barbearia.

### 3.4 Agendamento público (captação online)
- `/agendar/:slug`: seleção de serviço/profissional/dia/hora, criação de conta opcional, pagamento online (Pix/cartão via Asaas) ou avulso.
- **Reserva de slot** (`SlotReservation`): lock temporário (90s) por `slot_key` (`company:professional:minute`) para evitar double-booking; `status` active → consumed/expired/released; reuso permitido ao mesmo cliente trocando Pix↔cartão.
- **Idempotência** de PaymentIntent e expiração de pagamento (15 min) com job de limpeza.
- Confirmação 1-clique via WhatsApp (`/confirma/:token`) e avaliação pós-atendimento (`/avaliar/:token`).

### 3.5 Clientes (CRM base)
- Cadastro, busca, tags, histórico de atendimentos, serviços/profissionais favoritos, totais, último atendimento concluído.
- Painel de assinatura do cliente, consentimentos LGPD, histórico de campanhas, sugestão de plano, status VIP.

### 3.6 CRM & Retenção (módulo `/app/crm`)
- **Lifecycle automático** (`Customer.lifecycle_status`): `primeira_visita → fiel → em_risco → inativo → perdido`, calculado por `computeLifecycleStatus` a partir de `last_completed_at` + `total_appointments` e thresholds em `Company.crm_settings` (defaults: fiel ≥5 atendimentos, risco 30d, inativo 60d, perdido 90d). Recalculado on-conclude e por job diário.
- **Campanhas de lifecycle** (`Company.lifecycle_campaigns`): primeira visita, em risco, inativo, perdido, VIP inativo (com alerta ao dono), fiel sem plano — cada uma com `enabled`, `cooldown_days` e mensagem configuráveis; job `runLifecycleCampaigns` dispara respeitando cooldown e log idempotente em `Customer.lifecycle_campaigns_log`.
- **Clientes VIP**: marcação manual + sugestões automáticas (suprimíveis por 60 dias via `vip_dismissed_at`).

### 3.7 Serviços & Categorias
- `Service`: nome, descrição, duração (min), preço, destaque, ativo; vinculado a `ServiceCategory`.
- `ServiceCategory`: agrupamento de serviços.

### 3.8 Combos
- `ServicePackage`: pacote de serviços combinados com preço e duração total promocional; destacável (`featured`).

### 3.9 Profissionais
- `Professional`: vínculo a unidades (`unit_ids`), especialidade, agenda de trabalho (`work_schedule`), serviços atendidos (`service_ids`), comissão (`percent` ou `fixed`).
- **Biografia gerada por IA** (`generateProfessionalBio`): versões curta/média/completa com assinatura de dados que sugere regeração ao mudar.
- **Análise de especialidades por IA** (`analyzeProfessionalSpecialties`): tags canônicas com confiança e evidência baseada no histórico real de atendimentos.
- **Padronizador de foto** (`standardizeBarberPhoto`).

### 3.10 Planos (para clientes finais) & Assinaturas
- `CustomerPlan`: plano mensal `limited` (X usos/ciclo) ou `unlimited`, com `service_ids`, `rollover`, `valid_in_units`, janela **off-peak** opcional (dias/horários), visibilidade `public/private/invite_only` com `invite_token` e contador de usos.
- `CustomerSubscription`: assinatura ativa de um cliente, com ciclo mensal, `uses_remaining`, snapshot do plano, status (`pending_payment/active/paused/canceled`), integração Asaas (`asaas_subscription_id`, `asaas_invoice_url`), signup self-service.
- `SubscriptionUsage`: telemetria de consumo por agendamento, com reversão em cancelamento.
- **Validação de consumo** (`canConsume`): status ativo, ciclo vigente, usos restantes, serviço incluso, unidade válida e janela off-peak.
- Convite via URL privada (`/cliente/:slug/planos/convite/:token` e `/planos/convite/:token`).

### 3.11 Caixa
- `CashRegister`: ciclo `aberto → fechando → fechado` com claim atômico para evitar race; `expected_amount` (inicial + entradas − saídas − sangrias + suprimentos) vs `final_amount` (diferença/sobra-falta); snapshot por forma de pagamento; job `repairStuckCashRegisters` recupera caixas presos (>5 min).
- `FinancialEntry`: entrada/saída/sangria/suprimento, origem (`agendamento/produto/assinatura/manual/comissao/ajuste`), forma de pagamento, soft-delete com motivo, lock automático em lançamentos de origem `agendamento`/`comissao` (não editáveis), trilha de edição (`edited_at/by`).
- Auditoria de caixa, relatórios de caixa e DRE simplificado.

### 3.12 Financeiro
- Visão consolidada de entradas/saídas, saúde financeira, exportações. Restrito a admin/financeiro.

### 3.13 Comissões
- `Commission` recorrente do **programa de parceiros** (sobre invoice SaaS paga) com hold anti-fraude (`hold_until`, 15 dias), `billing_cycle`, idempotência por `(partner_id, stripe_invoice_id)`, estados `pending → approved → paid / cancelled / chargeback`.
- Comissão de **profissionais** calculada na conclusão do atendimento (`commission_type` percent/fixed em `Professional`), idempotente (`Appointment.commission_created`), com reversão em cancelamento (`reverseCommission`).
- Job `approveCommissions` aprova comissões após hold, com processamento paralelo.

### 3.14 Relatórios
- Relatórios por período, por profissional, por unidade, exportação. Restrito a admin/financeiro.

### 3.15 AI Growth
- Insights de crescimento e ações sugeridas por IA. Restrito a admin.

### 3.16 Equipe
- Convites (`inviteTeamMember`), papéis, vínculo a profissional, restrição de unidades, permissões granulares de caixa, reenvio de convite.

### 3.17 Avaliações
- `Review`: nota 1–5 + comentário, coletada pós-atendimento via token público; moderação obrigatória (`published=false` até aprovação do dono).

### 3.18 Indicações (parceiros)
- Captura de clique (`?ref=CODE` → `trackReferralClick`), atribuição link/manual, anti-fraude (fingerprint/IP/email), `Referral` com estados `pending → converted → active / cancelled / fraud`.

### 3.19 Configurações
- Dados da barbearia (nome, logo, cores, slug, contato, endereço, horários), WhatsApp (modelos de mensagem e janelas), CRM (thresholds), campanhas de lifecycle, assinatura SaaS, pagamentos (Asaas), privacidade (LGPD), segurança, unidades.

### 3.20 Multi-unidade
- `Unit`: filiais com horário próprio (sobrescreve Company), seletor de unidade ativa, toggle de clientes compartilhados entre unidades, backfill de matriz.

### 3.21 WhatsApp automático
- Confirmação, lembrete 24h, lembrete 2h, pós-atendimento, reativação, campanhas de lifecycle — com modelos editáveis, janela de envio, idempotência por `idempotency_key`, registro em `WhatsAppMessage`.

### 3.22 Painel Master (plataforma)
- **Dashboard** (MRR/ARR, novas empresas, churn, conversão trial→pago), **Barbearias** (lista, detalhe 360°, troca de plano, bloqueio/exclusão, impersonação), **Assinaturas**, **Financeiro** da plataforma, **Usuários**, **Funcionalidades** (feature flags/overrides por tenant), **Auditoria**, **LGPD**, **Compliance**, **Security Center**, **Observability**, **Dados-demo**, **Parceiros** (aprovação, suspensão, comissões, pagamentos mensais).

### 3.23 Painel do Parceiro
- Dashboard (KPIs, ranking, evolução, meta), indicações, comissões, configurações (chave Pix, senha).

### 3.24 Segurança & Compliance (transversal)
- TOTP 2FA para Master, impersonação auditada com expiração, rate-limit persistente (`SecurityRateLimit`), eventos de segurança (`SecurityEvent`), auditoria (`AdminAuditLog`, `AuditLog`, `PrivacyAuditLog`), consentimentos (`CustomerConsent`, `CookieConsentLog`), retenção/anonimização de dados (`anonymizeCustomer`), detector de anomalias de privacidade, DLP, CSP, anti-fraude de indicações, bloqueio de conta SaaS por inadimplência (`AssinaturaBloqueada`).

---

## 4. Mapeamento do Modelo de Dados

O banco é NoSQL (documentos). Cada entidade tem campos built-in `id`, `created_date`, `updated_date`, `created_by_id`. Relacionamentos são por referência (`company_id`, `customer_id`, `professional_id`, `unit_id`, etc.). Principais entidades:

### Núcleo do tenant
| Entidade | Papel | Campos-chave |
|----------|-------|--------------|
| **Company** | Tenant (barbearia). | `name`, `slug`, `primary_color`, `business_type` (mei/cnpj/individual), `status` (trial/active/inactive/blocked), `plan_name`, `onboarding_*`, `billing_provider` (asaas), `asaas_*` (customer/subscription/subaccount/split), `whatsapp_settings`, `crm_settings`, `lifecycle_campaigns`, `multi_unit_enabled`, `customers_shared_across_units`. |
| **Unit** | Filial. | `company_id`, `name`, `slug`, `business_hours`, `is_default`, `active`. |
| **Professional** | Barbeiro. | `company_id`, `unit_ids`, `specialty`, `work_schedule`, `service_ids`, `commission_type/value`, bios e especialidades geradas por IA. |
| **Service** | Serviço avulso. | `company_id`, `category_id`, `name`, `duration_minutes`, `price`, `featured`, `active`. |
| **ServiceCategory** | Categoria de serviço. | agrupamento. |
| **ServicePackage** | Combo. | `company_id`, `service_ids`, `price`, `duration_minutes`. |
| **Customer** | Cliente final. | `company_id`, `unit_id`, `name`, `phone`, `email`, `total_appointments`, `last_completed_at`, `status` (active/inactive/vip), `lifecycle_status`, `lifecycle_campaigns_log`, `password_hash`, `auth_token`, `reset_token`. |
| **TeamMember** | Usuário da equipe. | `company_id`, `name`, `email`, `role`, `professional_id`, `unit_ids`, `cash_permissions`. |
| **BarberCredential** | Senha do dono. | `email`, `password_hash/salt/algo` (PBKDF2-SHA256), `base44_password_hint`, lock por falhas, reset. |

### Agendamento
| Entidade | Campos-chave |
|----------|--------------|
| **Appointment** | `company_id`, `unit_id`, `customer_id`, `professional_id`, `service_id`, `scheduled_at`, `status` (aguardando_pagamento/agendado/confirmado/em_atendimento/concluido/cancelado/faltou), `source` (online/interno), `payment_method` (avulso/subscription/pix/card), `paid`, `paid_online`, `payment_status`, `payment_expires_at`, `confirm_token`, `review_token`, `is_flexible_assignment`, `commission_created`, `subscription_id`. |
| **BlockedTime** | `company_id`, `professional_id` (vazio = todos), `start_time/end_time` (único) ou `recurring` + `weekday` + `time_start/time_end`. |
| **SlotReservation** | lock 90s: `slot_key`, `expires_at`, `status` (active/consumed/expired/released), `source`. |

### Planos & Assinaturas (clientes finais)
| Entidade | Campos-chave |
|----------|--------------|
| **CustomerPlan** | `company_id`, `name`, `price_monthly`, `type` (limited/unlimited), `usage_limit`, `service_ids`, `rollover`, `valid_in_units`, `off_peak_*`, `visibility` (public/private/invite_only), `invite_token*`. |
| **CustomerSubscription** | `company_id`, `customer_id`, `plan_id`, snapshots, `status` (pending_payment/active/paused/canceled), `current_cycle_start/end`, `uses_remaining`, `asaas_subscription_id`. |
| **SubscriptionUsage** | consumo por agendamento, `reverted`. |

### Financeiro
| Entidade | Campos-chave |
|----------|--------------|
| **CashRegister** | `company_id`, `unit_id`, `status` (aberto/fechando/fechado), `initial/expected/final_amount`, `difference`, `payment_breakdown`, `closing_started_at/by`. |
| **FinancialEntry** | `company_id`, `unit_id`, `cash_register_id`, `type` (entrada/saida), `entry_kind` (entrada/saida/sangria/suprimento), `origin`, `payment_method`, `amount`, `date`, `is_locked`, soft-delete. |
| **Commission** | `partner_id`, `company_id`, `stripe_invoice_id`, `amount`, `commission_percentage`, `billing_cycle`, `status` (pending/approved/paid/cancelled/chargeback), `hold_until`. |

### Plataforma / SaaS billing
| Entidade | Campos-chave |
|----------|--------------|
| **Plan** | `name`, `price_monthly`, `stripe_price_id`, `features[]`, `limits` (barbers/appointments_month/storage_mb), `visibility`, `invite_token*`. |
| **Partner** | `name`, `email`, `referral_code`, `commission_percentage`, `status`, `password_hash`, `magic_token`, `pix_key`, `monthly_goal`. |
| **Referral** | `partner_id`, `company_id`, `attribution_type`, `status` (pending/converted/active/cancelled/fraud), `fraud_reasons`, `fraud_score`. |
| **EmailLog**, **WhatsAppMessage** | registros transacionais e de automação. |

### Segurança & Compliance
`UserSession`, `TotpSession`, `ImpersonationSession`, `SecurityRateLimit`, `SecurityEvent`, `AdminAuditLog`, `AuditLog`, `PrivacyAuditLog`, `CustomerConsent`, `CookieConsentLog`, `UserEvent`, `IdempotencyKey`, `FeatureFlag`, `SystemAlert`.

### Relacionamentos principais
```
Company 1──N Unit
Company 1──N Professional ──N Service (service_ids)
Company 1──N Service / ServiceCategory / ServicePackage
Company 1──N Customer 1──N CustomerSubscription ──1 CustomerPlan
Customer/Professional → Appointment (company_id, unit_id)
Appointment 1──1 SubscriptionUsage (quando por plano)
Company 1──N CashRegister 1──N FinancialEntry
Appointment (concluído) → FinancialEntry + Commission(profissional) + Review
Partner 1──N Referral → Company ; Referral/Invoice → Commission(partner)
```

---

## 5. Regras de Negócio em Funcionamento

### 5.1 Disponibilidade e conflitos de agenda
- **Conflito de agendamento** (`appointmentConflict`): dois atendimentos do mesmo profissional não podem se sobrepor no tempo; `cancelado`/`faltou` não ocupam slot; duração real considera `__duration`/`custom_duration_minutes`.
- **Bloqueios** (`blockedConflict`): bloqueio sem `professional_id` vale para toda a barbearia; suporta **único** (`start_time/end_time`) e **recorrente semanal** (`recurring` + `weekday` + `time_start/time_end`).
- **Inteligência de slots** (`scoreSlot`): pontua encaixes que colam em ocupações existentes (esquerda/direita + bônus de encaixe perfeito) sem remover opções; em dias vazios, leve preferência por horários mais cedo.

### 5.2 Reserva de slot e double-booking
- `SlotReservation` com TTL 90s por `slot_key` composto; `status` controla o ciclo de vida; reuso permitido ao mesmo dono (cliente trocando Pix↔card). Jobs e webhooks consultam reservas ativas antes de criar `Appointment`.

### 5.3 Pagamentos online
- **Política PJ-first:** checkout exige CNPJ (14 dígitos); CPF exibe restrição e bloqueia o botão de continuar.
- Pagamento via **Asaas**: cartão tokenizado inline (`chargeAsaasSaasWithCard`) ou Pix/boleto hospedado (`createAsaasSaasCheckout`). Promo de lançamento opcional.
- **Expiração de pagamento:** 15 min após criação; job `cleanupExpiredBookingPayments` limpa appointments pendentes.
- **Idempotência:** `payment_idempotency_key` evita duplicar PaymentIntent em refresh/duplo-clique.

### 5.4 Assinaturas de clientes (planos)
- `canConsume` valida: status ativo, ciclo vigente (`current_cycle_end > now`), usos restantes (ilimitado = 9999), serviço incluso, unidade válida e janela off-peak (quando habilitada).
- Ciclo mensal (`nextCycleEnd` = +1 mês). `rollover` acumula usos não consumidos (configurável).
- Cobrança recorrente via Asaas (`asaas_subscription_id`); `asaas_invoice_url` permite retomar pagamento.

### 5.5 Lifecycle e retenção
- `computeLifecycleStatus`: considera **apenas atendimentos concluídos**; "fiel" tem prioridade sobre "em risco" dentro da janela de 30d.
- Campanhas de lifecycle respeitam `cooldown_days` e logam envio em `Customer.lifecycle_campaigns_log` (idempotente). VIP inativo também alerta o dono internamente.
- Cliente VIP: marcação manual + sugestões automáticas suprimíveis por 60 dias.

### 5.6 Comissões
- **Profissional:** na conclusão do atendimento, calculada por `commission_type` (percent sobre `price` ou valor fixo); idempotente via `Appointment.commission_created`; reversível em cancelamento (`reverseCommission`).
- **Parceiro:** gerada sobre invoice SaaS paga, com `hold_until` de 15 dias anti-fraude; aprovada por job `approveCommissions`; cancelada por churn rápido, chargeback ou auto-indicação; paga manualmente via PIX com `payment_reference`.

### 5.7 Caixa
- Claim atômico `aberto → fechando → fechado` para evitar race; `expected_amount` = inicial + entradas − saídas − sangrias + suprimentos; `difference` = final − esperado.
- Lançamentos de origem `agendamento`/`comissao` são `is_locked` (não editáveis/excluíveis); lançamentos manuais admitem soft-delete com motivo e trilha de auditoria.
- Permissões granulares por `cash_permissions` (override por membro) + defaults por papel. Job `repairStuckCashRegisters` recupera caixas em `fechando` há mais de 5 min.

### 5.8 Multi-unidade
- Admin/financeiro veem todas as unidades; demais papéis respeitam `TeamMember.unit_ids`. Clientes podem ser compartilhados entre unidades (`customers_shared_across_units`) ou isolados por `Customer.unit_id`.

### 5.9 Segurança e acesso
- Master exige **TOTP 2FA**; impersonação cria `ImpersonationSession` auditada com expiração e banner de aviso.
- Rate-limit persistente (`SecurityRateLimit`), score de risco de sessão (`UserSession.risk_score`), lock de conta por falhas de login (`locked_until`), reset de senha por token hash (SHA-256) com expiração de 1h.
- Senhas: PBKDF2-SHA256 + pepper + salt único (`BarberCredential`, `Partner`).
- Bloqueio de tenant por inadimplência (`is_blocked_by_billing`) → tela `AssinaturaBloqueada`.

### 5.10 Feature gating & planos
- `FEATURE_REGISTRY` centraliza todas as features controláveis; `hasFeature`/`useFeature` validam contra plano + `Company.feature_overrides`. Planos (`Plan`) definem `features[]` e `limits` (barbers/appointments_month/storage_mb). Overrides por tenant permitem liberar/bloquear features individuais.

### 5.11 LGPD / Privacidade
- Consentimentos granulares (`CustomerConsent`: whatsapp_marketing, email_marketing, automated_reminders, post_service_review, ai_recommendations, data_processing_general) com versão do texto legal, IP, user-agent e fonte.
- Consentimento de cookies (`CookieConsentLog`), anonimização de cliente (`anonymizeCustomer`), retenção configurável, detector de anomalias de privacidade, exportação de dados do titular.

---

## 6. Diagnóstico de Próximos Passos (Gaps e Oportunidades)

Apesar da maturidade operacional, há pontas soltas que elevariam a plataforma:

1. **Dependência crítica de backend functions.** Todo o painel Master, a listagem de barbearias, métricas e os preços do checkout dependem de `base44.functions.invoke(...)`. Sem o plano que libere backend functions, **todas as telas executivas e o checkout mostram zero/vazio** (já observado em produção). Desbloqueio do plano é pré-requisito de qualquer release comercial.

2. **Funcionalidades reservadas (`soon`/`hidden`) ainda não implementadas:** agendamentos recorrentes, lista de espera, campanhas em massa, segmentação avançada, split de pagamento automático, cobrança automática recorrente (SaaS via cartão), estoque, produtos avulsos, programa de fidelidade, cupons, assistente IA, preço dinâmico, retenção preditiva, permissões avançadas customizadas, API pública e white-label. Existem no catálogo para preparar a arquitetura, mas não entregam valor hoje.

3. **Observabilidade & jobs em produção:** há jobs críticos (aprovação de comissões, lembretes, reativação, campanhas de lifecycle, limpeza de expirados) que precisam de monitoramento de execução e alertas de falha; o módulo de observability existe mas depende dos backend functions estarem ativos.

4. **Migração Stripe→Asaas parcial:** campos Stripe ainda coexistem (legado) para reconciliação; concluir a decommission e remover caminhos legados reduziria complexidade e risco de duplicidade de cobrança.

5. **Canal de aquisição do parceiro:** o fluxo anti-fraude e o hold de comissões estão implementados, mas falta automação do pagamento recorrente da comissão via PIX (hoje o Master marca pago manualmente).

6. **Testes E2E e carga:** a suíte de testes unitários/de integração é ampla, mas faltam testes E2E ponta-a-ponta dos fluxos críticos (checkout → onboarding → primeiro agendamento → conclusão → comissão → retenção) e testes de carga na reserva de slots / webhook de pagamento.

7. **Experiência mobile do checkout:** o iframe do checkout pode ser bloqueado em webviews; o fluxo precisa de fallback robusto de "abrir em nova aba" já sinalizado, mas com melhor UX de handoff.

---

*Documento gerado a partir da inspeção direta do código-fonte, entidades e fluxos de navegação ativos. Serve como baseline de release; atualizações devem versionar este arquivo.*