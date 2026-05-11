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
  { value: 'agendamento', label: 'Agendamento', badge: 'bg-blue-50 text-[#2563EB] border-blue-200' },
  { value: 'produto',     label: 'Produto',     badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'assinatura',  label: 'Assinatura',  badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'manual',      label: 'Manual',      badge: 'bg-gray-50 text-gray-700 border-gray-200' },
  { value: 'comissao',    label: 'Comissão',    badge: 'bg-pink-50 text-pink-700 border-pink-200' },
  { value: 'ajuste',      label: 'Ajuste',      badge: 'bg-orange-50 text-orange-700 border-orange-200' },
];

export function getOriginMeta(value) {
  return ORIGINS.find(o => o.value === value) || { value, label: value || 'Manual', badge: 'bg-gray-50 text-gray-700 border-gray-200' };
}

// Regras de bloqueio para edição/exclusão.
// Bloqueado: origem 'agendamento' ou 'comissao' (vêm do sistema, são fonte da verdade)
// OU is_locked === true (sinalização explícita do backend).
// Permitido editar: manual, sangria, suprimento.
// Permitido excluir: APENAS lançamentos manuais (entrada/saída origem=manual).
export function isEntryLocked(entry) {
  if (!entry) return true;
  if (entry.is_locked === true) return true;
  if (entry.origin === 'agendamento' || entry.origin === 'comissao') return true;
  if (entry.reference_appointment_id) return true;
  return false;
}

export function canEditEntry(entry) {
  if (isEntryLocked(entry)) return false;
  const kind = getEntryKind(entry);
  return ['entrada', 'saida', 'sangria', 'suprimento'].includes(kind);
}

export function canDeleteEntry(entry) {
  if (isEntryLocked(entry)) return false;
  const kind = getEntryKind(entry);
  // Sangria/suprimento NÃO podem ser excluídos (rastro contábil), só editados.
  return kind === 'entrada' || kind === 'saida';
}

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
// Ignora soft-deleted (deleted_at).
export function filterEntriesForRegister(register, allEntries) {
  if (!register) return [];
  return allEntries.filter(e => {
    if (e.deleted_at) return false;
    if (e.cash_register_id) return e.cash_register_id === register.id;
    // Legado: sem cash_register_id, usa janela de tempo + unit_id
    const matchTime = new Date(e.created_date || e.date) >= new Date(register.opened_at);
    if (!matchTime) return false;
    if (!register.unit_id) return true;
    return !e.unit_id || e.unit_id === register.unit_id;
  });
}

// ============================================================================
// DRE OPERACIONAL DO DIA — Fase 2.
// Calcula: faturamento bruto, líquido, ticket médio, qtd atendimentos, ranking
// por profissional e quebra completa por forma de pagamento.
// `professionalsMap`: { [id]: { name } } para enriquecer o ranking.
// ============================================================================
export function computeDre(entries, professionalsMap = {}) {
  const base = {
    gross_in: 0,        // total de entradas (faturamento bruto)
    total_out: 0,       // saídas operacionais
    total_sangria: 0,
    total_suprimento: 0,
    net: 0,             // líquido = entradas - saídas - sangrias + suprimentos
    appointment_count: 0,
    appointment_revenue: 0,
    ticket_avg: 0,
    payment_breakdown: {},     // todas as entradas, por método
    by_professional: [],       // ranking com totals
    by_origin: {},             // contagem por origem (telemetria)
  };

  const byPro = new Map();

  for (const e of entries) {
    if (e.deleted_at) continue;
    const kind = getEntryKind(e);
    const amt = Number(e.amount) || 0;
    const origin = e.origin || 'manual';

    base.by_origin[origin] = (base.by_origin[origin] || 0) + 1;

    if (kind === 'entrada') {
      base.gross_in += amt;
      if (e.payment_method) {
        base.payment_breakdown[e.payment_method] = +(((base.payment_breakdown[e.payment_method] || 0) + amt).toFixed(2));
      }
      if (origin === 'agendamento') {
        base.appointment_count += 1;
        base.appointment_revenue += amt;
      }
      if (e.professional_id) {
        const prev = byPro.get(e.professional_id) || { professional_id: e.professional_id, revenue: 0, appointments: 0, methods: {} };
        prev.revenue += amt;
        if (origin === 'agendamento') prev.appointments += 1;
        if (e.payment_method) prev.methods[e.payment_method] = (prev.methods[e.payment_method] || 0) + amt;
        byPro.set(e.professional_id, prev);
      }
    } else if (kind === 'saida') {
      base.total_out += amt;
    } else if (kind === 'sangria') {
      base.total_sangria += amt;
    } else if (kind === 'suprimento') {
      base.total_suprimento += amt;
    }
  }

  base.net = +((base.gross_in + base.total_suprimento) - (base.total_out + base.total_sangria)).toFixed(2);
  base.gross_in = +base.gross_in.toFixed(2);
  base.total_out = +base.total_out.toFixed(2);
  base.total_sangria = +base.total_sangria.toFixed(2);
  base.total_suprimento = +base.total_suprimento.toFixed(2);
  base.ticket_avg = base.appointment_count > 0 ? +(base.appointment_revenue / base.appointment_count).toFixed(2) : 0;

  base.by_professional = Array.from(byPro.values())
    .map(p => ({
      ...p,
      revenue: +p.revenue.toFixed(2),
      professional_name: professionalsMap[p.professional_id]?.name || 'Profissional',
      ticket_avg: p.appointments > 0 ? +(p.revenue / p.appointments).toFixed(2) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return base;
}

// Aplica filtros UI sobre lançamentos. Mantém a lógica simples: somente passa
// pelo filtro o que casa com TODOS os critérios fornecidos. Campos vazios são ignorados.
export function applyEntryFilters(entries, filters = {}) {
  return entries.filter(e => {
    if (filters.kind && getEntryKind(e) !== filters.kind) return false;
    if (filters.payment_method && e.payment_method !== filters.payment_method) return false;
    if (filters.origin && (e.origin || 'manual') !== filters.origin) return false;
    if (filters.professional_id && e.professional_id !== filters.professional_id) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${e.description || ''} ${e.category || ''} ${e.justification || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}