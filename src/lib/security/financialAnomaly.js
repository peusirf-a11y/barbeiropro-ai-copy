/**
 * financialAnomaly.js — Detecção de anomalias financeiras.
 *
 * Analisa padrões financeiros para detectar fraude, manipulação e abuso.
 * Gera financialRiskScore (0-100) e lista de anomalias.
 * 
 * USO: backend functions (não expor ao frontend diretamente).
 */

/**
 * Avalia anomalias em lançamentos financeiros de um tenant.
 * 
 * @param {object} params
 * @param {object[]} params.entries - FinancialEntry[] recentes (últimos 30 dias)
 * @param {object[]} params.appointments - Appointment[] do mesmo período
 * @param {object} params.company - Company record
 * @returns {{ score: number, anomalies: string[], severity: string, details: object }}
 */
export function assessFinancialAnomaly({ entries = [], appointments = [], company = {} }) {
  const anomalies = [];
  let riskPoints = 0;

  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const recent = entries.filter(e => new Date(e.date || e.created_date) > sevenDaysAgo);
  const allMonth = entries.filter(e => new Date(e.date || e.created_date) > thirtyDaysAgo);

  // 1) Ticket médio muito baixo (< R$5 suspeito de manipulação)
  const completedAppts = appointments.filter(a => a.status === 'concluido' && a.price > 0);
  if (completedAppts.length > 5) {
    const avgTicket = completedAppts.reduce((s, a) => s + (a.price || 0), 0) / completedAppts.length;
    if (avgTicket < 5) {
      anomalies.push(`Ticket médio suspeito: R$${avgTicket.toFixed(2)}`);
      riskPoints += 30;
    } else if (avgTicket < 15) {
      anomalies.push(`Ticket médio muito baixo: R$${avgTicket.toFixed(2)}`);
      riskPoints += 15;
    }
  }

  // 2) Pico anormal de entradas em 7 dias
  const recentEntradas = recent.filter(e => e.type === 'entrada' || e.entry_kind === 'entrada');
  const monthEntradas = allMonth.filter(e => e.type === 'entrada' || e.entry_kind === 'entrada');
  if (monthEntradas.length > 0) {
    const weeklyAvg = (monthEntradas.length / 4.3);
    if (recentEntradas.length > weeklyAvg * 3 && recentEntradas.length > 10) {
      anomalies.push(`Pico de entradas: ${recentEntradas.length} vs média ${weeklyAvg.toFixed(0)}/semana`);
      riskPoints += 20;
    }
  }

  // 3) Volume de sangrias excessivo
  const sangrias = allMonth.filter(e => e.entry_kind === 'sangria');
  const totalSangria = sangrias.reduce((s, e) => s + (e.amount || 0), 0);
  const totalEntrada = monthEntradas.reduce((s, e) => s + (e.amount || 0), 0);
  if (totalEntrada > 0 && (totalSangria / totalEntrada) > 0.5) {
    anomalies.push(`Sangrias representam ${((totalSangria / totalEntrada) * 100).toFixed(0)}% das entradas`);
    riskPoints += 25;
  }

  // 4) Muitas exclusões de lançamentos financeiros (possível manipulação)
  const deletedCount = allMonth.filter(e => e.deleted_at).length;
  if (deletedCount > 5) {
    anomalies.push(`${deletedCount} lançamentos excluídos no mês`);
    riskPoints += deletedCount > 15 ? 30 : 15;
  }

  // 5) Lançamentos manuais sem justificativa com valores altos
  const largeManual = allMonth.filter(e =>
    e.origin === 'manual' &&
    e.amount > 500 &&
    !e.justification &&
    (e.type === 'saida' || e.entry_kind === 'saida')
  );
  if (largeManual.length > 0) {
    anomalies.push(`${largeManual.length} saída(s) manual(is) alta(s) sem justificativa`);
    riskPoints += largeManual.length * 10;
  }

  // 6) Mesma descrição repetida muitas vezes (loop automático)
  const descCounts = {};
  allMonth.forEach(e => {
    const d = (e.description || '').trim().toLowerCase();
    if (d) descCounts[d] = (descCounts[d] || 0) + 1;
  });
  const repeatedDescs = Object.entries(descCounts).filter(([, count]) => count > 20);
  if (repeatedDescs.length > 0) {
    anomalies.push(`Descrição repetida suspeita: "${repeatedDescs[0][0]}" (${repeatedDescs[0][1]}x)`);
    riskPoints += 20;
  }

  // 7) Agendamentos concluídos sem lançamento financeiro correspondente
  const apptWithoutFinancial = completedAppts.filter(a => {
    return !allMonth.some(e => e.reference_appointment_id === a.id);
  });
  if (completedAppts.length > 10 && apptWithoutFinancial.length > completedAppts.length * 0.3) {
    const pct = ((apptWithoutFinancial.length / completedAppts.length) * 100).toFixed(0);
    anomalies.push(`${pct}% dos atendimentos concluídos sem lançamento financeiro`);
    riskPoints += 15;
  }

  const score = Math.min(100, riskPoints);
  const severity = score >= 60 ? 'critical' : score >= 35 ? 'high' : score >= 15 ? 'medium' : 'low';

  return {
    score,
    anomalies,
    severity,
    details: {
      avg_ticket: completedAppts.length > 0
        ? completedAppts.reduce((s, a) => s + (a.price || 0), 0) / completedAppts.length
        : null,
      sangria_ratio: totalEntrada > 0 ? totalSangria / totalEntrada : 0,
      deleted_entries: deletedCount,
      large_manual_exits: largeManual.length,
    },
  };
}

/**
 * Avalia spike de agendamentos em curto período (possível fraude de preço).
 * @param {object[]} appointments - Agendamentos recentes
 * @param {number} windowHours - Janela de análise em horas
 * @returns {{ isSpike: boolean, count: number, reason: string|null }}
 */
export function detectAppointmentSpike(appointments = [], windowHours = 1) {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const recent = appointments.filter(a => new Date(a.created_date) > since);
  
  if (recent.length > 20) {
    return { isSpike: true, count: recent.length, reason: `${recent.length} agendamentos em ${windowHours}h (possível automação)` };
  }
  return { isSpike: false, count: recent.length, reason: null };
}