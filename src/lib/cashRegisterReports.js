// Agregações para a página de Relatórios do Caixa (Fase 3).
// Recebe N caixas fechados + entries do período, devolve KPIs consolidados e DRE.

import { computeDre, filterEntriesForRegister, getEntryKind } from '@/lib/cashRegister';

const round = (v) => +(Number(v) || 0).toFixed(2);

// Constrói um snapshot por caixa: totais (preferindo o snapshot salvo no fechamento,
// caindo para recálculo via entries quando o snapshot não existir — caixas antigos).
export function buildRegisterSummaries(registers, allEntries, professionalsMap = {}) {
  return registers.map(r => {
    const entries = filterEntriesForRegister(r, allEntries);
    const dre = computeDre(entries, professionalsMap);

    const totalIn        = r.total_in        ?? dre.gross_in;
    const totalOut       = r.total_out       ?? dre.total_out;
    const totalSangria   = r.total_sangria   ?? dre.total_sangria;
    const totalSuprimento= r.total_suprimento?? dre.total_suprimento;
    const expected       = r.expected_amount ?? round((Number(r.initial_amount) || 0) + totalIn + totalSuprimento - totalOut - totalSangria);
    const breakdown      = r.payment_breakdown && Object.keys(r.payment_breakdown).length ? r.payment_breakdown : dre.payment_breakdown;

    return {
      register: r,
      entries,
      dre,
      totals: {
        initial: round(r.initial_amount),
        totalIn: round(totalIn),
        totalOut: round(totalOut),
        totalSangria: round(totalSangria),
        totalSuprimento: round(totalSuprimento),
        expected: round(expected),
        final: r.final_amount != null ? round(r.final_amount) : null,
        difference: r.difference != null ? round(r.difference) : null,
        breakdown,
      },
    };
  });
}

// KPIs consolidados de um conjunto de caixas fechados.
export function consolidateKpis(summaries) {
  const k = {
    register_count: summaries.length,
    gross_in: 0,
    total_out: 0,
    total_sangria: 0,
    total_suprimento: 0,
    net: 0,
    diff_total: 0,
    diff_positive: 0,
    diff_negative: 0,
    appointment_count: 0,
    appointment_revenue: 0,
    ticket_avg: 0,
    payment_breakdown: {},
    by_professional: {}, // id => { name, revenue, appointments }
  };

  for (const s of summaries) {
    const { totals, dre } = s;
    k.gross_in        += totals.totalIn;
    k.total_out       += totals.totalOut;
    k.total_sangria   += totals.totalSangria;
    k.total_suprimento+= totals.totalSuprimento;
    k.appointment_count   += dre.appointment_count;
    k.appointment_revenue += dre.appointment_revenue;

    if (totals.difference != null) {
      k.diff_total += totals.difference;
      if (totals.difference > 0) k.diff_positive += totals.difference;
      else if (totals.difference < 0) k.diff_negative += totals.difference;
    }

    for (const [m, v] of Object.entries(totals.breakdown || {})) {
      k.payment_breakdown[m] = round((k.payment_breakdown[m] || 0) + v);
    }
    for (const p of dre.by_professional || []) {
      const cur = k.by_professional[p.professional_id] || { professional_id: p.professional_id, professional_name: p.professional_name, revenue: 0, appointments: 0 };
      cur.revenue += p.revenue;
      cur.appointments += p.appointments;
      k.by_professional[p.professional_id] = cur;
    }
  }

  k.gross_in         = round(k.gross_in);
  k.total_out        = round(k.total_out);
  k.total_sangria    = round(k.total_sangria);
  k.total_suprimento = round(k.total_suprimento);
  k.net              = round(k.gross_in + k.total_suprimento - k.total_out - k.total_sangria);
  k.diff_total       = round(k.diff_total);
  k.diff_positive    = round(k.diff_positive);
  k.diff_negative    = round(k.diff_negative);
  k.appointment_revenue = round(k.appointment_revenue);
  k.ticket_avg       = k.appointment_count > 0 ? round(k.appointment_revenue / k.appointment_count) : 0;

  k.by_professional = Object.values(k.by_professional)
    .map(p => ({ ...p, revenue: round(p.revenue), ticket_avg: p.appointments > 0 ? round(p.revenue / p.appointments) : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  return k;
}

// Filtra caixas fechados em uma janela [from, to] (inclusivo).
export function filterRegistersInRange(registers, from, to) {
  const fromT = from ? new Date(from).getTime() : null;
  const toT   = to   ? new Date(to).getTime()   : null;
  return registers.filter(r => {
    if (r.status !== 'fechado') return false;
    const ref = new Date(r.closed_at || r.opened_at).getTime();
    if (fromT != null && ref < fromT) return false;
    if (toT   != null && ref > toT)   return false;
    return true;
  });
}