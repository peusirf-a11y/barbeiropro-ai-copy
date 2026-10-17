// Validação de conflitos e bloqueios — usada em AppAgenda e PublicBooking.
// Centralizar aqui evita que regras divirjam entre frontend e diferentes telas.
// Totalmente compatível com o fuso horário oficial de Brasília (UTC-3).

import { parseBrasiliaDateTime, toBrasiliaDateParts } from './businessHours';

export function getAppointmentTimestamp(a) {
  if (!a) return null;
  if (a.scheduled_at) {
    return parseBrasiliaDateTime(a.scheduled_at);
  }
  if (a.date && a.time) {
    return parseBrasiliaDateTime(a.date, a.time);
  }
  if (a.date) {
    return parseBrasiliaDateTime(a.date, '09:00');
  }
  return null;
}

/**
 * Verifica se já existe um agendamento ocupando o mesmo intervalo de data/hora para o profissional.
 * Apenas agendamentos confirmados/ativos causam colisão; agendamentos cancelados, faltas ou expirados são ignorados.
 */
export function appointmentConflict({ professionalId, dateTime, durationMin, appointments, excludeId = null }) {
  if (!professionalId || !dateTime || !Array.isArray(appointments) || appointments.length === 0) return false;

  const startMs = parseBrasiliaDateTime(dateTime);
  if (!startMs || isNaN(startMs)) return false;
  const dur = Math.max(5, Number(durationMin) || 30);
  const endMs = startMs + dur * 60000;

  return appointments.some(a => {
    if (!a || a.id === excludeId) return false;
    if (a.professional_id && professionalId && a.professional_id !== professionalId) return false;

    // Status que NÃO causam colisão / bloqueio na agenda
    const status = String(a.status || '').toLowerCase().trim();
    if (['cancelado', 'faltou', 'cancelled', 'rejeitado', 'failed', 'expired', 'pending_payment'].includes(status)) {
      return false;
    }

    const aStartMs = getAppointmentTimestamp(a);
    if (!aStartMs || isNaN(aStartMs)) return false;
    const aDur = Math.max(5, Number(a.__duration || a.custom_duration_minutes || a.duration_minutes) || 30);
    const aEndMs = aStartMs + aDur * 60000;

    // Colisão exata de intervalo de tempo [startMs, endMs) vs [aStartMs, aEndMs)
    return startMs < aEndMs && endMs > aStartMs;
  });
}

/**
 * Verifica se o horário do agendamento cai num bloqueio.
 * Bloqueios sem professional_id valem para a barbearia inteira.
 * Suporta bloqueios únicos (start_time/end_time) e recorrentes semanais
 * (recurring=true + weekday + time_start/time_end) no fuso de Brasília.
 */
export function blockedConflict({ professionalId, dateTime, durationMin, blocks }) {
  if (!dateTime || !Array.isArray(blocks) || blocks.length === 0) return false;

  const startMs = parseBrasiliaDateTime(dateTime);
  if (!startMs || isNaN(startMs)) return false;
  const dur = Math.max(5, Number(durationMin) || 30);
  const endMs = startMs + dur * 60000;

  const { dateStr, dayOfWeek } = toBrasiliaDateParts(dateTime);

  return blocks.some(b => {
    if (!b) return false;
    if (b.professional_id && professionalId && b.professional_id !== professionalId) return false;

    // Bloqueio recorrente: aplica todo "weekday" entre time_start e time_end no fuso de Brasília
    if (b.recurring) {
      if (typeof b.weekday !== 'number' || !b.time_start || !b.time_end) return false;
      if (dayOfWeek !== b.weekday) return false;
      const bStartMs = parseBrasiliaDateTime(dateStr, b.time_start);
      const bEndMs = parseBrasiliaDateTime(dateStr, b.time_end);
      if (!bStartMs || !bEndMs || isNaN(bStartMs) || isNaN(bEndMs)) return false;
      return startMs < bEndMs && endMs > bStartMs;
    }

    // Bloqueio único
    if (!b.start_time || !b.end_time) return false;
    const bStartMs = parseBrasiliaDateTime(b.start_time);
    const bEndMs = parseBrasiliaDateTime(b.end_time);
    if (!bStartMs || !bEndMs || isNaN(bStartMs) || isNaN(bEndMs)) return false;
    return startMs < bEndMs && endMs > bStartMs;
  });
}

// ─────────────────────────────────────────────────────────────────
// Inteligência de Agenda — pontuação de slots para minimizar buracos.
// ─────────────────────────────────────────────────────────────────

const ADJ_TOLERANCE_MIN = 5; // considera "encostado" se a folga for ≤ 5min

export function scoreSlot({ slotStart, durationMin, professionalId, appointments = [], blocks = [] }) {
  const startMs = parseBrasiliaDateTime(slotStart);
  if (!startMs || isNaN(startMs)) return 0;
  const dur = Math.max(5, Number(durationMin) || 30);
  const endMs = startMs + dur * 60000;

  const busy = [];

  for (const a of appointments) {
    if (!a || a.professional_id !== professionalId) continue;
    const status = String(a.status || '').toLowerCase().trim();
    if (['cancelado', 'faltou', 'cancelled', 'rejeitado', 'failed', 'expired'].includes(status)) continue;
    const aStartMs = getAppointmentTimestamp(a);
    if (!aStartMs || isNaN(aStartMs)) continue;
    const aDur = Math.max(5, Number(a.__duration || a.custom_duration_minutes || a.duration_minutes) || 30);
    busy.push({ start: aStartMs, end: aStartMs + aDur * 60000 });
  }

  const { dateStr, dayOfWeek, timeFormatted } = toBrasiliaDateParts(slotStart);

  for (const b of blocks) {
    if (!b || (b.professional_id && b.professional_id !== professionalId)) continue;
    if (b.recurring) {
      if (dayOfWeek === b.weekday && b.time_start && b.time_end) {
        const bStartMs = parseBrasiliaDateTime(dateStr, b.time_start);
        const bEndMs = parseBrasiliaDateTime(dateStr, b.time_end);
        if (bStartMs && bEndMs) busy.push({ start: bStartMs, end: bEndMs });
      }
    } else if (b.start_time && b.end_time) {
      const bStartMs = parseBrasiliaDateTime(b.start_time);
      const bEndMs = parseBrasiliaDateTime(b.end_time);
      if (bStartMs && bEndMs) busy.push({ start: bStartMs, end: bEndMs });
    }
  }

  // Compara ocupações do mesmo dia
  const sameDay = busy.filter(x => {
    const xDateStr = toBrasiliaDateParts(x.start).dateStr;
    return xDateStr === dateStr;
  });

  let touchesLeft = false;  // existe ocupação que termina no início do slot
  let touchesRight = false; // existe ocupação que começa no fim do slot
  for (const x of sameDay) {
    if (Math.abs(x.end - startMs) / 60000 <= ADJ_TOLERANCE_MIN && x.end <= startMs) touchesLeft = true;
    if (Math.abs(x.start - endMs) / 60000 <= ADJ_TOLERANCE_MIN && x.start >= endMs) touchesRight = true;
  }

  let score = 0;
  if (touchesLeft) score += 10;
  if (touchesRight) score += 10;
  if (touchesLeft && touchesRight) score += 15; // encaixe perfeito

  // Se o dia inteiro está vazio, leve preferência por horários mais cedo.
  if (sameDay.length === 0) {
    const hour = parseInt(timeFormatted.split(':')[0], 10) || 9;
    score -= Math.max(0, hour - 9) * 0.2;
  }

  return score;
}

// Reordena slots disponíveis priorizando os que preenchem buracos.
export function rankSlotsByFit({ slots, date, durationMin, professionalId, appointments = [], blocks = [] }) {
  if (!professionalId || professionalId === 'any') return slots;
  const enriched = slots.map(time => {
    const { isoBrasilia, timestamp } = toBrasiliaDateParts(date, time);
    const score = scoreSlot({ slotStart: isoBrasilia, durationMin, professionalId, appointments, blocks });
    return { time, timestamp, score };
  });
  enriched.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.timestamp - b.timestamp;
  });
  return enriched.map(e => e.time);
}

// Marca quais slots são "encaixe inteligente"
export function annotateSlots({ slots, date, durationMin, professionalId, appointments = [], blocks = [] }) {
  if (!professionalId || professionalId === 'any') {
    return slots.map(time => ({ time, smart: false, score: 0 }));
  }
  return slots.map(time => {
    const { isoBrasilia } = toBrasiliaDateParts(date, time);
    const score = scoreSlot({ slotStart: isoBrasilia, durationMin, professionalId, appointments, blocks });
    return { time, smart: score >= 10, score };
  });
}