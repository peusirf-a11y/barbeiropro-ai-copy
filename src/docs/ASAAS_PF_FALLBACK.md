# Modo híbrido Asaas — PF (CPF) vs PJ (CNPJ)

> Como o O CORTE lida com a limitação oficial do Asaas: contas Pessoa Física
> (CPF) não podem criar subaccounts. Para não bloquear o onboarding, oferecemos
> dois modos de recebimento.

## Limitação oficial do Asaas

O Asaas só permite criar **subaccount** (conta-filha com split automático) para
contas Pessoa Jurídica — CNPJ, incluindo MEI. Contas com CPF apenas recebem a
mensagem oficial:

> "Contas de pessoa física (CPF) não podem criar subcontas no Asaas. Apenas
> contas de pessoa jurídica (CNPJ) podem acessar essa funcionalidade."

Isso significa que **não** é uma limitação do nosso código — é uma regra do
produto Asaas. Para PF, o caminho oficial é receber os pagamentos numa conta
master e fazer o repasse manualmente.

## Os dois modos

### 1. Modo automático (split) — CNPJ/MEI

- Cada barbearia tem sua própria subaccount Asaas (KYC próprio).
- Cobranças PIX e cartão caem **direto na conta dela** via `split: [...]` no
  payload do Asaas.
- O CORTE não recebe nem retém o dinheiro — passa direto.
- Flag interna: `Company.asaas_split_mode = 'automatic'`.
- Status: `pending` (KYC) → `active` (aprovado) → split passa a funcionar.

### 2. Modo manual (centralizado) — CPF (PF)

- A barbearia **não** tem subaccount.
- Cobranças PIX e cartão caem na **conta master O CORTE**.
- O CORTE repassa o saldo para a barbearia manualmente (PIX semanal).
- Flag interna:
  - `Company.asaas_split_mode = 'manual'`
  - `Company.asaas_subaccount_status = 'not_available_pf'`
  - `Company.asaas_pix_enabled = true`
- Vantagem: **zero burocracia** — barbearia ativa em 1 clique e já começa a
  cobrar online.

## Decisão automática

O sistema detecta automaticamente o tipo de documento e roteia o usuário para
o fluxo certo:

| `owner_cpf_cnpj` ou form atual | Componente exibido | Endpoint chamado |
|---|---|---|
| 11 dígitos (CPF) | `AsaasManualModeCard` | `enableAsaasManualMode` |
| 14 dígitos (CNPJ) | `AsaasSplitCard` | `createAsaasSubaccount` |

Se o usuário tentar enviar CPF para `createAsaasSubaccount` (cenário de race),
o backend devolve `error: 'cnpj_required'` com `suggest_manual_mode: true` e
mensagem amigável já traduzida.

## Garantias de pagamento

Em **ambos os modos**, o cliente final paga PIX ou cartão normalmente pelo
link público. A diferença está no destino do dinheiro:

| Etapa | Modo automático | Modo manual |
|---|---|---|
| Cliente paga | ✓ | ✓ |
| PIX/Cartão entra | Subaccount da barbearia | Conta master O CORTE |
| Repasse | Automático (split Asaas) | Manual (PIX semanal) |

Os endpoints `createAsaasBookingPayment` e `createAsaasCustomerPlanCheckout`
já são defensivos: só injetam o array `split: [...]` quando
`asaas_subaccount_wallet_id` está presente E `asaas_subaccount_status === 'active'`.
Quando isso não acontece (PF ou KYC pendente), o pagamento entra na master e o
modo manual cobre o repasse.

## Migração PF → PJ (caminho futuro)

Quando a barbearia formaliza um CNPJ/MEI, ela pode migrar do modo manual para
o automático:

1. Atualiza `Company.owner_cpf_cnpj` para o CNPJ.
2. Abre `/app/configuracoes/pagamentos` e o card de split automático aparece
   (a detecção PF/PJ é dinâmica no frontend).
3. Preenche dados de endereço + data de nascimento + clica em "Ativar
   pagamento online".
4. `createAsaasSubaccount` cria a subaccount, KYC do Asaas leva ~24h.
5. Quando aprovado (webhook `ACCOUNT_STATUS_UPDATED`):
   - `asaas_subaccount_status = 'active'`
   - `asaas_split_mode = 'automatic'`
6. A partir do próximo pagamento, o split é automático. Saldo retido na master
   antes da migração continua sendo repassado manualmente pela O CORTE.

## Observabilidade

Eventos logados em `AdminAuditLog.metadata.event`:

- `asaas_manual_mode_enabled` — ativação do modo manual (CPF)
- `asaas_subaccount_requested` — criação da subaccount (CNPJ)
- `asaas_subaccount_approved` — webhook `ACCOUNT_STATUS_UPDATED` → active

Cada log inclui: `company_id`, `document_type` (cpf|cnpj), `activation_source`
(app_pagamentos), `corrId` para rastreio de chamadas Asaas.

## Comunicação com o usuário

Nunca expor o erro técnico do Asaas. Mensagens padronizadas:

| Erro Asaas | Mensagem ao usuário |
|---|---|
| "Subaccount requires business account" | "Para recebimento automático direto na sua conta, é necessário CNPJ ou MEI." |
| "É necessário informar a data de nascimento." | "Informe a data de nascimento do responsável (exigência do Asaas)." |
| CPF detectado antes de tentar criar | "Você pode começar agora no modo de repasse manual." (com botão de 1 clique) |