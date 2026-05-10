// Regras de elegibilidade para sugestão automática de VIP.
// É só sugestão — promoção continua manual (dono clica em "Promover a VIP").
//
// Critérios (V1, fixos):
// - Não é VIP atualmente
// - lifecycle_status === 'fiel' (cliente saudável, não está em risco)
// - >= MIN_APPOINTMENTS atendimentos concluídos
// - Ticket médio do cliente >= TICKET_MULTIPLIER × ticket médio geral da barbearia
// - Frequência: pelo menos 1 atendimento a cada FREQ_DAYS nos últimos 6 meses
// - Não foi dispensado nos últimos DISMISS_COOLDOWN_DAYS
//
// Score (0-100): combina os 3 sinais para ranquear os candidatos. Quanto maior, mais óbvio o VIP.

export const VIP_RULES = {
  MIN_APPOINTMENTS: 10,
  TICKET_MULTIPLIER: 1.5,
  FREQ_DAYS: 35,
  DISMISS_COOLDOWN_DAYS: 60,
  WINDOW_DAYS: 180, // janela para calcular frequência (6 meses)
};

function daysSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/**
 * Avalia um único cliente contra a base de atendimentos da empresa.
 * @param {object} customer
 * @param {Array}  customerAppointments - SOMENTE concluídos deste cliente
 * @param {number} companyAvgTicket     - ticket médio da empresa (concluídos)
 * @returns {{ eligible: boolean, reasons: string[], score: number, metrics: object }}
 */
export function evaluateCustomerForVip(customer, customerAppointments, companyAvgTicket) {
  if (!customer) return { eligible: false, reasons: [], score: 0, metrics: {} };

  // Já é VIP → ignora
  if (customer.status === 'vip') {
    return { eligible: false, reasons: ['já é VIP'], score: 0, metrics: {} };
  }

  // Sugestão dispensada recentemente → silencia por 60d
  if (customer.vip_dismissed_at && daysSince(customer.vip_dismissed_at) < VIP_RULES.DISMISS_COOLDOWN_DAYS) {
    return { eligible: false, reasons: ['sugestão dispensada recentemente'], score: 0, metrics: {} };
  }

  // Só sugere quem está saudável (cliente fiel)
  if (customer.lifecycle_status !== 'fiel') {
    return { eligible: false, reasons: ['cliente não é fiel'], score: 0, metrics: {} };
  }

  const concluded = (customerAppointments || []).filter(a => a.status === 'concluido');
  const total = concluded.length;
  if (total < VIP_RULES.MIN_APPOINTMENTS) {
    return { eligible: false, reasons: [`menos de ${VIP_RULES.MIN_APPOINTMENTS} atendimentos`], score: 0, metrics: { total } };
  }

  // Ticket médio
  const totalSpent = concluded.reduce((s, a) => s + (Number(a.price) || 0), 0);
  const customerAvg = totalSpent / total;
  const ticketRatio = companyAvgTicket > 0 ? customerAvg / companyAvgTicket : 0;

  // Frequência nos últimos 6 meses
  const sixMonthsAgo = Date.now() - VIP_RULES.WINDOW_DAYS * 86_400_000;
  const recent = concluded.filter(a => new Date(a.scheduled_at).getTime() >= sixMonthsAgo);
  const recentCount = recent.length;
  const expectedRecent = Math.floor(VIP_RULES.WINDOW_DAYS / VIP_RULES.FREQ_DAYS); // ~5
  const freqOk = recentCount >= expectedRecent;
  const ticketOk = ticketRatio >= VIP_RULES.TICKET_MULTIPLIER;

  const reasons = [];
  if (ticketOk) reasons.push(`ticket médio ${ticketRatio.toFixed(1)}× a média`);
  if (freqOk) reasons.push(`${recentCount} visitas em 6 meses`);
  if (total >= VIP_RULES.MIN_APPOINTMENTS) reasons.push(`${total} atendimentos no total`);

  // Cliente precisa cumprir TODOS os 3 sinais (atendimentos OK já garantido + ticket + frequência)
  const eligible = ticketOk && freqOk;

  // Score 0-100: 40% ticket, 40% frequência, 20% volume
  const ticketScore = Math.min(40, (ticketRatio / VIP_RULES.TICKET_MULTIPLIER) * 40);
  const freqScore = Math.min(40, (recentCount / Math.max(expectedRecent, 1)) * 40);
  const volScore = Math.min(20, (total / VIP_RULES.MIN_APPOINTMENTS) * 20);
  const score = Math.round(ticketScore + freqScore + volScore);

  return {
    eligible,
    reasons,
    score,
    metrics: {
      total,
      customerAvg: Math.round(customerAvg * 100) / 100,
      companyAvgTicket: Math.round(companyAvgTicket * 100) / 100,
      ticketRatio: Math.round(ticketRatio * 100) / 100,
      recentCount,
      totalSpent: Math.round(totalSpent * 100) / 100,
    },
  };
}