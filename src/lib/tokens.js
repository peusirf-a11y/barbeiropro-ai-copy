// Helpers para tokens públicos (confirmação e avaliação).
// Tokens fortes de 32 chars hex (16 bytes aleatórios via Web Crypto).

export function generateToken() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16); // 128 bits
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (não deve ocorrer em browsers modernos)
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 18)}`;
}

// Confirmação: expira no próprio horário do agendamento (limite máximo).
// Mas como o lembrete 24h é o disparo, usamos o agendamento + 30min como teto.
export function confirmTokenExpiry(scheduledAt) {
  if (!scheduledAt) return null;
  const dt = new Date(scheduledAt);
  // 30min depois do início — depois disso confirmar não faz mais sentido
  return new Date(dt.getTime() + 30 * 60 * 1000).toISOString();
}

// Review: 72h após o agendamento.
export function reviewTokenExpiry(scheduledAt) {
  if (!scheduledAt) return null;
  const dt = new Date(scheduledAt);
  return new Date(dt.getTime() + 72 * 60 * 60 * 1000).toISOString();
}