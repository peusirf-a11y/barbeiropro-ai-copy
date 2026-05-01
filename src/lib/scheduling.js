// Validação de conflitos e bloqueios — usada em AppAgenda e PublicBooking.
// Centralizar aqui evita que regras divirjam entre frontend e diferentes telas.

export function appointmentConflict({ professionalId, dateTime, durationMin, appointments, excludeId = null }) {
  if (!professionalId || !dateTime) return false;
  const start = new Date(dateTime);
  const end = new Date(start.getTime() + (durationMin || 30) * 60000);
  return appointments.some(a => {
    if (a.id === excludeId) return false;
    if (a.professional_id !== professionalId) return false;
    if (['cancelado', 'faltou'].includes(a.status)) return false;
    const aStart = new Date(a.scheduled_at);
    const aDur = a.__duration || 30;
    const aEnd = new Date(aStart.getTime() + aDur * 60000);
    return start < aEnd && end > aStart;
  });
}

// Verifica se o horário do agendamento cai num bloqueio.
// Bloqueios sem professional_id valem para a barbearia inteira.
// Suporta bloqueios únicos (start_time/end_time) e recorrentes semanais
// (recurring=true + weekday + time_start/time_end).
export function blockedConflict({ professionalId, dateTime, durationMin, blocks }) {
  if (!dateTime) return false;
  const start = new Date(dateTime);
  const end = new Date(start.getTime() + (durationMin || 30) * 60000);
  return blocks.some(b => {
    if (b.professional_id && b.professional_id !== professionalId) return false;

    // Bloqueio recorrente: aplica todo "weekday" entre time_start e time_end
    if (b.recurring) {
      if (typeof b.weekday !== 'number' || !b.time_start || !b.time_end) return false;
      if (start.getDay() !== b.weekday) return false;
      const [sh, sm] = String(b.time_start).split(':').map(Number);
      const [eh, em] = String(b.time_end).split(':').map(Number);
      const bStart = new Date(start); bStart.setHours(sh || 0, sm || 0, 0, 0);
      const bEnd = new Date(start);   bEnd.setHours(eh || 0, em || 0, 0, 0);
      return start < bEnd && end > bStart;
    }

    // Bloqueio único
    if (!b.start_time || !b.end_time) return false;
    const bStart = new Date(b.start_time);
    const bEnd = new Date(b.end_time);
    return start < bEnd && end > bStart;
  });
}

// ─────────────────────────────────────────────────────────────────
// Inteligência de Agenda — pontuação de slots para minimizar buracos.
//
// Filosofia (do roteiro): "a agenda procura blocos do tamanho certo,
// preenche encaixes e não deixa lacunas inúteis".
//
// Para cada slot candidato, calculamos um score:
//   • +PESO se o slot encosta no FIM de um agendamento/bloqueio existente
//     (preenche buraco "à direita")
//   • +PESO se o slot encosta no INÍCIO de um agendamento/bloqueio existente
//     (preenche buraco "à esquerda")
//   • +PESO_EXTRA se faz as DUAS coisas (encaixe perfeito entre dois agendamentos)
//   • penalidade leve por horários muito tarde se o dia ainda está vazio,
//     priorizando concentrar os atendimentos cedo.
//
// Importante: NÃO removemos nenhum slot — apenas reordenamos. O cliente
// continua podendo escolher qualquer horário disponível. Isso evita
// "esconder" agenda e quebrar fluxos existentes.
// ─────────────────────────────────────────────────────────────────

const ADJ_TOLERANCE_MIN = 5; // considera "encostado" se a folga for ≤ 5min

function minutesBetween(a, b) {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 60000);
}

export function scoreSlot({ slotStart, durationMin, professionalId, appointments = [], blocks = [] }) {
  const start = new Date(slotStart);
  const end = new Date(start.getTime() + (durationMin || 30) * 60000);

  // Constrói "ocupações" do dia desse profissional (appointments + bloqueios).
  const busy = [];

  for (const a of appointments) {
    if (a.professional_id !== professionalId) continue;
    if (['cancelado', 'faltou'].includes(a.status)) continue;
    const aStart = new Date(a.scheduled_at);
    const aDur = a.__duration || 30;
    busy.push({ start: aStart, end: new Date(aStart.getTime() + aDur * 60000) });
  }
  for (const b of blocks) {
    if (b.professional_id && b.professional_id !== professionalId) continue;
    busy.push({ start: new Date(b.start_time), end: new Date(b.end_time) });
  }

  // Só consideramos ocupações no mesmo dia para não inflar pontuação.
  const sameDay = busy.filter(x =>
    x.start.toDateString() === start.toDateString() ||
    x.end.toDateString() === start.toDateString()
  );

  let touchesLeft = false;  // existe ocupação que termina no início do slot
  let touchesRight = false; // existe ocupação que começa no fim do slot
  for (const x of sameDay) {
    if (minutesBetween(x.end, start) <= ADJ_TOLERANCE_MIN && x.end <= start) touchesLeft = true;
    if (minutesBetween(x.start, end) <= ADJ_TOLERANCE_MIN && x.start >= end) touchesRight = true;
  }

  let score = 0;
  if (touchesLeft) score += 10;
  if (touchesRight) score += 10;
  if (touchesLeft && touchesRight) score += 15; // encaixe perfeito

  // Se o dia inteiro está vazio, leve preferência por horários mais cedo.
  if (sameDay.length === 0) {
    const hour = start.getHours();
    score -= Math.max(0, hour - 9) * 0.2;
  }

  return score;
}

// Reordena slots disponíveis priorizando os que preenchem buracos.
// Mantém ordem cronológica como desempate para não embaralhar a UI.
export function rankSlotsByFit({ slots, date, durationMin, professionalId, appointments = [], blocks = [] }) {
  if (!professionalId || professionalId === 'any') return slots;
  const enriched = slots.map(time => {
    const [h, m] = time.split(':').map(Number);
    const slotStart = new Date(date);
    slotStart.setHours(h, m, 0, 0);
    const score = scoreSlot({ slotStart, durationMin, professionalId, appointments, blocks });
    return { time, slotStart, score };
  });
  enriched.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.slotStart - b.slotStart;
  });
  return enriched.map(e => e.time);
}

// Marca quais slots são "encaixe inteligente" — para o frontend destacar
// visualmente sem reordenar (alternativa ao rankSlotsByFit).
export function annotateSlots({ slots, date, durationMin, professionalId, appointments = [], blocks = [] }) {
  if (!professionalId || professionalId === 'any') {
    return slots.map(time => ({ time, smart: false, score: 0 }));
  }
  return slots.map(time => {
    const [h, m] = time.split(':').map(Number);
    const slotStart = new Date(date);
    slotStart.setHours(h, m, 0, 0);
    const score = scoreSlot({ slotStart, durationMin, professionalId, appointments, blocks });
    return { time, smart: score >= 10, score };
  });
}