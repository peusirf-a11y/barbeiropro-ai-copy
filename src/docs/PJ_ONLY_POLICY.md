# Política PJ-first do O CORTE

> Documento de produto + engenharia. Última atualização: 2026-05-24.

## TL;DR

O cadastro automatizado do O CORTE está disponível **apenas para barbearias com CNPJ ou MEI**.
Barbeiros que atuam como pessoa física (CPF) **não conseguem concluir o checkout self-service** — em vez disso, recebem um card amigável convidando-os a falar com a equipe comercial via WhatsApp ou e-mail.

## Motivação

1. **Integração financeira Asaas:** subaccounts com split automático exigem CNPJ/MEI. Para CPF, o KYC do Asaas frequentemente recusa ou exige documentação adicional fora do nosso fluxo.
2. **Redução de risco operacional:** PF concentra a maior parte das tentativas de fraude e chargebacks no segmento.
3. **Atendimento de qualidade:** PF tem necessidades fiscais e contratuais diferentes. O atendimento manual permite avaliar caso a caso, oferecer condições adequadas e evitar frustração no onboarding.
4. **Foco do produto:** o O CORTE é uma ferramenta de gestão para barbearias estabelecidas, não para autônomos individuais.

## Diferença CPF vs CNPJ no produto

| Item | CNPJ / MEI (PJ) | CPF (PF) |
|---|---|---|
| Cadastro self-service | ✅ Permitido | ❌ Bloqueado |
| Checkout automático | ✅ Cartão / PIX | ❌ Bloqueado |
| Subaccount Asaas (split) | ✅ Automático | ❌ Indisponível |
| Recebimento centralizado | – | ⚠️ Apenas via análise manual |
| Onboarding | Self-service 7 passos | Avaliação manual pela equipe |

## Fluxo de contato para CPF

Quando o sistema detecta **11 dígitos** no campo "CNPJ/MEI", o frontend:

1. Bloqueia imediatamente o CTA principal (`Continuar para o pagamento`).
2. Exibe o componente `CpfRestrictionCard` com texto amigável (sem linguagem técnica).
3. Oferece dois canais:
   - **WhatsApp (CTA principal):** abre `wa.me` com mensagem pré-preenchida contendo nome, e-mail, telefone, cidade e `origem=cadastro_pf`.
   - **E-mail (CTA secundário):** abre cliente de e-mail para `comercial@ocorte.app` com assunto `Solicitação de cadastro via CPF`.
4. Encerra o fluxo automatizado. Nenhum dado é persistido no backend nesta etapa.

## Onde o bloqueio é aplicado

| Camada | Arquivo | Comportamento |
|---|---|---|
| Frontend — Checkout público | `pages/Checkout.jsx` | Detecta CPF (11 dígitos) e mostra `CpfRestrictionCard`. Desabilita CTA. |
| Frontend — Onboarding | `components/onboarding/BusinessDetailsStep.jsx` | Remove opção "Pessoa Física" do seletor de tipo de negócio. |
| Backend — Checkout SaaS hospedado | `functions/createAsaasSaasCheckout.js` | Retorna `403 pf_not_allowed` se `cpf_cnpj.length === 11`. |
| Backend — Cartão nativo | `functions/chargeAsaasSaasWithCard.js` | Mesmo guard. |
| Backend — Asaas subaccount | `functions/createAsaasSubaccount.js` | Comportamento existente: marca `asaas_subaccount_status = 'not_available_pf'`. |

## Observabilidade

Eventos registrados via `trackEvent` (whitelistados em `functions/trackEvent.js`):

- `blocked_pf_attempt` — disparado quando o frontend detecta CPF no formulário.
- `cpf_contact_click_whatsapp` — clique no botão WhatsApp do card.
- `cpf_contact_click_email` — clique no botão de e-mail do card.

> ⚠️ No `/checkout` (rota pública, sem auth), `trackEvent` retorna 401 e os eventos ficam apenas no `console.info` do navegador. Isso é intencional — não criamos nova entity para leads PF nesta fase (ver "Futuro" abaixo).

## Compliance

- **LGPD:** nenhum dado de CPF é persistido durante a tentativa bloqueada. O fluxo de contato é externo (WhatsApp / e-mail) e o usuário decide quais dados compartilhar.
- **Mensagens:** o usuário **nunca** vê erros técnicos do Asaas, traces de stack, ou termos como "KYC failed". A comunicação é sempre amigável e propositiva.
- **Auditoria:** o backend loga tentativas bloqueadas via `console.warn` com email mascarado.

## Variáveis de ambiente

| Secret | Uso |
|---|---|
| `OCORTE_COMMERCIAL_WHATSAPP` | Número internacional sem formatação (ex: `5511999999999`). Usado nos links `wa.me`. |
| `OCORTE_COMMERCIAL_EMAIL` | E-mail destino (ex: `comercial@ocorte.app`). Usado nos `mailto:`. |

> Como o card é renderizado no frontend público, os defaults estão hardcoded em `components/onboarding/CpfRestrictionCard.jsx`. Os secrets servem para uso futuro em backend (e.g. notificação interna quando um lead PF clica).

## Futuro

A aba "Leads CPF" no painel master **não foi implementada nesta fase** — política intencional para manter a entrega enxuta. Será implementada quando:

- Volume de contatos crescer (>30/mês).
- A equipe comercial precisar de CRM interno.
- Houver necessidade de SLA de resposta.

Quando isso acontecer, a entity `CpfOnboardingLead` deve capturar: nome, telefone, e-mail, cidade, CPF mascarado, origem do lead, `created_at`, status (`new | contacted | approved | rejected`) e observações da equipe.

## Texto oficial (não alterar sem revisão de produto)

**Título do card:** "Cadastro via CPF"

**Corpo:**
> No momento, o cadastro automático do O CORTE está disponível apenas para empresas com CNPJ ou MEI.
>
> Se você ainda atua como pessoa física, fale com nossa equipe para avaliarmos possibilidades de ativação.

**Mensagem de erro do backend (caso CPF chegue lá):**
> No momento, o cadastro automático está disponível apenas para empresas com CNPJ ou MEI. Fale com nossa equipe para avaliarmos sua ativação.