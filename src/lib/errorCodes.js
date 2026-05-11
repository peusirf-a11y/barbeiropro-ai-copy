// lib/errorCodes.js — F3 do Foundation Sprint.
//
// Catálogo central de error codes do backend → mensagens humanas pt-BR.
// Preparado para i18n futuro: substitua ERROR_MESSAGES por uma lookup table
// que recebe locale.
//
// Convenção:
//  - Codes em SCREAMING_SNAKE_CASE.
//  - Prefixo opcional por domínio: PAYMENT_*, BOOKING_*, AUTH_*.
//  - Backend retorna `{ error: { code, message?, ...meta } }` (formato novo)
//    ou `{ error: 'CODE_OR_MESSAGE' }` (formato legado — translator detecta).

export const ERROR_MESSAGES = {
  // ── Auth/permissão ────────────────────────────────────────────────
  UNAUTHORIZED:            'Você precisa estar autenticado.',
  FORBIDDEN:               'Você não tem permissão para essa ação.',
  FORBIDDEN_ROLE:          'Seu papel não permite essa operação.',
  FORBIDDEN_CAP:           'Você não tem essa permissão habilitada.',
  USE_MASTER_PANEL:        'Esta ação precisa ser feita no painel master.',
  CROSS_TENANT:            'Recurso não encontrado.', // genérico de propósito

  // ── Booking ───────────────────────────────────────────────────────
  SLOT_TAKEN:              'Este horário acabou de ser reservado. Escolha outro.',
  SLOT_CONFLICT:           'Conflito de horário com outro agendamento.',
  SLOT_BLOCKED:            'Horário bloqueado pela agenda.',
  TIME_BLOCKED:            'Horário indisponível.',
  SERVICE_NOT_OFFERED_BY_PROFESSIONAL: 'Este profissional não atende esse serviço.',
  PROFESSIONAL_NOT_IN_UNIT: 'Este profissional não atende nesta unidade.',
  PROFESSIONAL_INACTIVE:   'Profissional inativo.',
  SERVICE_INACTIVE:        'Serviço inativo.',
  INVALID_PRICE:           'Preço inválido — verifique no cadastro do serviço.',

  // ── Pagamento ─────────────────────────────────────────────────────
  PAYMENTS_DISABLED:       'Pagamentos online não estão habilitados.',
  PIX_NOT_ENABLED:         'Pix não está ativo. Escolha cartão.',
  CONNECT_NOT_READY:       'A barbearia ainda não está aceitando pagamentos online.',
  STRIPE_ERROR:            'Erro ao processar pagamento. Tente novamente.',
  STRIPE_MANAGED_USE_PORTAL: 'Esta assinatura é gerida pelo Stripe. Use o portal do cliente.',
  CPF_REQUIRED:            'CPF é obrigatório (11 dígitos).',
  RATE_LIMITED:            'Muitas tentativas. Aguarde e tente de novo.',

  // ── Customer / Auth do cliente final ──────────────────────────────
  EMAIL_ALREADY_REGISTERED: 'Já existe uma conta com este e-mail. Faça login.',
  INVALID_CREDENTIALS:     'E-mail ou senha incorretos.',
  RESET_LINK_INVALID:      'Link de redefinição inválido ou já usado.',
  RESET_LINK_EXPIRED:      'Link de redefinição expirado. Solicite um novo.',
  WEAK_PASSWORD:           'Senha precisa ter no mínimo 6 caracteres.',
  CUSTOMER_NAME_REQUIRED:  'Nome é obrigatório.',
  INVALID_PHONE:           'Telefone inválido.',

  // ── Subscription / Plan ───────────────────────────────────────────
  ALREADY_SUBSCRIBED:      'Cliente já tem uma assinatura ativa.',
  PLAN_INACTIVE:           'Plano inativo.',
  NO_USES_REMAINING:       'Não há usos disponíveis nesta assinatura.',
  OFF_PEAK_ONLY:           'Este plano só é válido em horário promocional.',

  // ── Caixa / Financeiro ────────────────────────────────────────────
  REGISTER_NOT_OPEN:       'Caixa não está aberto.',
  REGISTER_ALREADY_CLOSED: 'Caixa já foi fechado.',
  REGISTER_CLOSING:        'Caixa em processo de fechamento. Aguarde.',
  JUSTIFICATION_REQUIRED:  'Justificativa é obrigatória para esta operação.',
  INVALID_AMOUNT:          'Valor inválido.',
  ENTRY_LOCKED:            'Este lançamento foi gerado pelo sistema e não pode ser editado.',

  // ── Validação genérica ────────────────────────────────────────────
  INVALID_ACTION:          'Ação inválida.',
  MISSING_FIELDS:          'Dados incompletos.',
  NOT_FOUND:               'Recurso não encontrado.',
  ALREADY_PAID:            'Já está marcado como pago.',
};

/**
 * Traduz um erro vindo do backend para mensagem humana.
 * Aceita 3 formatos:
 *   1. { error: { code: 'X', message?: '...' } }      (novo padrão)
 *   2. { error: 'X' }                                  (legado — string)
 *   3. Error com .response.data.error                  (axios)
 *
 * Fallbacks em ordem:
 *   - Mensagem no catálogo.
 *   - `error.message` se o backend mandou.
 *   - `fallback` passado pelo caller.
 *   - 'Algo deu errado. Tente novamente.'
 */
export function translateError(err, fallback) {
  // Aceita o objeto direto ou um Error axios.
  const payload = err?.response?.data || err?.data || err;
  const errorField = payload?.error ?? payload;

  let code, message;
  if (typeof errorField === 'string') {
    code = errorField;
  } else if (errorField && typeof errorField === 'object') {
    code = errorField.code || errorField.error;
    message = errorField.message;
  }

  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (message) return message;
  if (fallback) return fallback;
  return 'Algo deu errado. Tente novamente.';
}

/**
 * Helper para backend functions: monta resposta de erro no formato padrão.
 * Uso (em function Deno):
 *   return Response.json(errorResponse('SLOT_TAKEN'), { status: 409 });
 */
export function errorResponse(code, extra = {}) {
  return {
    error: {
      code,
      message: ERROR_MESSAGES[code] || code,
      ...extra,
    },
  };
}