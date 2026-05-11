// Helpers compartilhados do módulo de Caixa (Fase 1).
// Mantém retrocompatibilidade: lançamentos antigos só com `type` continuam funcionando.

export const PAYMENT_METHODS = [
  { value: 'dinheiro',         label: 'Dinheiro',         icon: '💵' },
  { value: 'pix',              label: 'Pix',              icon: '⚡' },
  { value: 'cartao_credito',   label: 'Cartão crédito',   icon: '💳' },
  { value: 'cartao_debito',    label: 'Cartão débito',    icon: '💳' },
  { value: 'link_pagamento',   label: 'Link de pagamento',icon: '🔗' },
  { value: 'carteira_digital', label: 'Carteira digital', icon: '📱' },
];

export const ENTRY_KINDS = [
  { value: 'entrada',    label: 'Entrada',    tone: 'green', sign: +1, contabilType: 'entrada' },
  { value: 'saida',      label: 'Saída',      tone: 'red',   sign: -1, contabilType: 'saida' },
  { value: 'sangria',    label: 'Sangria',    tone: 'red',   sign: -1, contabilType: 'saida' },
  { value: 'suprimento', label: 'Suprimento', tone: 'green', sign: +1, contabilType: 'entrada' },
];

export const ORIGINS = [
  { value: 'agendamento', label: 'Agendamento' },
  { value: 'produto',     label: 'Produto' },
  { value: 'assinatura',  label: 'Assinatura' },
  { value: 'manual',      label: 'Manual' },
  { value: 'comissao',    label: 'Comissão' },
  { value: 'ajuste',      label: 'Ajuste' },
];

// Deriva entry_kind quando lançamentos legados só tiverem `type`.
export function getEntryKind(entry) {
  if (entry?.entry_kind) return entry.entry_kind;
  return entry?.type === 'saida' ? 'saida' : 'entrada';
}

export function getPaymentMethodLabel(value) {
  return PAYMENT_METHODS.find(m => m.value === value)?.label || '—';
}

export function getPaymentMethodIcon(value) {
  return PAYMENT_METHODS.find(m => m.value === value)?.icon || '•';
}

// Calcula totais do caixa a partir dos lançamentos. Compatível com legados.
export function computeRegisterTotals(register, entries) {
  let totalIn = 0, totalOut = 0, totalSangria = 0, totalSuprimento = 0;
  const breakdown = {};

  for (const e of entries) {
    const kind = getEntryKind(e);
    const amount = Number(e.amount) || 0;

    if (kind === 'entrada')         totalIn        += amount;
    else if (kind === 'saida')      totalOut       += amount;
    else if (kind === 'sangria')    totalSangria   += amount;
    else if (kind === 'suprimento') totalSuprimento += amount;

    // Breakdown só para entradas com método de pagamento informado
    if (kind === 'entrada' && e.payment_method) {
      breakdown[e.payment_method] = (breakdown[e.payment_method] || 0) + amount;
    }
  }

  const initial = Number(register?.initial_amount) || 0;
  const expected = +(initial + totalIn + totalSuprimento - totalOut - totalSangria).toFixed(2);

  return {
    initial,
    totalIn: +totalIn.toFixed(2),
    totalOut: +totalOut.toFixed(2),
    totalSangria: +totalSangria.toFixed(2),
    totalSuprimento: +totalSuprimento.toFixed(2),
    expected,
    breakdown,
  };
}

// Filtra lançamentos pertencentes a este caixa (preferindo cash_register_id,
// caindo para o fallback temporal quando o link ainda não existir — legado).
export function filterEntriesForRegister(register, allEntries) {
  if (!register) return [];
  return allEntries.filter(e => {
    if (e.cash_register_id) return e.cash_register_id === register.id;
    // Legado: sem cash_register_id, usa janela de tempo + unit_id
    const matchTime = new Date(e.created_date || e.date) >= new Date(register.opened_at);
    if (!matchTime) return false;
    if (!register.unit_id) return true;
    return !e.unit_id || e.unit_id === register.unit_id;
  });
}