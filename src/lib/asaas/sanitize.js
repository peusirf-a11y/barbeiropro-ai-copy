// Sanitização de dados sensíveis antes de enviar ao Asaas ou logar.
// Asaas espera CPF/CNPJ e telefone apenas com dígitos.

export function digitsOnly(value) {
  if (!value) return '';
  return String(value).replace(/\D+/g, '');
}

export function sanitizeCpfCnpj(value) {
  const digits = digitsOnly(value);
  if (digits.length !== 11 && digits.length !== 14) return null;
  return digits;
}

export function sanitizePhone(value) {
  const digits = digitsOnly(value);
  if (digits.length < 10 || digits.length > 13) return null;
  return digits;
}

export function sanitizeEmail(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  // Regex simples — Asaas faz validação própria também.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

// Mascara CPF/CNPJ para logs (mantém 3 primeiros + 2 últimos).
export function maskCpfCnpj(value) {
  const digits = digitsOnly(value);
  if (!digits) return '<none>';
  if (digits.length === 11) return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
  if (digits.length === 14) return `${digits.slice(0, 2)}.***.***/****-${digits.slice(-2)}`;
  return `${digits.slice(0, 3)}***`;
}

// Remove qualquer campo sensível antes de logar payload Asaas.
export function scrubAsaasPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = { ...payload };
  if (clone.cpfCnpj) clone.cpfCnpj = maskCpfCnpj(clone.cpfCnpj);
  if (clone.creditCard) clone.creditCard = '<redacted>';
  if (clone.creditCardHolderInfo) clone.creditCardHolderInfo = '<redacted>';
  return clone;
}