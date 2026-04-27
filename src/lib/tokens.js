// Helpers para tokens públicos de agendamento (confirmação e avaliação).
// Token de 24 chars hexadecimais via crypto seguro do navegador.

export function generateToken() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (não deve ocorrer em browsers modernos)
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}