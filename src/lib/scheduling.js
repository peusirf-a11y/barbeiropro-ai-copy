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
export function blockedConflict({ professionalId, dateTime, durationMin, blocks }) {
  if (!dateTime) return false;
  const start = new Date(dateTime);
  const end = new Date(start.getTime() + (durationMin || 30) * 60000);
  return blocks.some(b => {
    if (b.professional_id && b.professional_id !== professionalId) return false;
    const bStart = new Date(b.start_time);
    const bEnd = new Date(b.end_time);
    return start < bEnd && end > bStart;
  });
}