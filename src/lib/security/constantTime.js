/**
 * constantTime.js — Utilitários de tempo constante para prevenir timing attacks.
 *
 * Garante que comparações sensíveis (tokens, hashes) levem o mesmo tempo
 * independente do resultado, impedindo timing oracles.
 *
 * Compatível com browser (WebCrypto) e Deno.
 */

/**
 * Compara dois strings em tempo constante usando HMAC challenge.
 * Mais seguro que comparação caractere-a-caractere.
 * 
 * @param {string} a
 * @param {string} b
 * @returns {Promise<boolean>}
 */
export async function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);

  // Sempre processa ambos (mesmo tamanho diferente)
  // para evitar leak de tamanho via timing
  try {
    const key = await crypto.subtle.generateKey(
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    // Pad para mesmo tamanho antes de assinar
    const maxLen = Math.max(bufA.length, bufB.length);
    const paddedA = new Uint8Array(maxLen);
    const paddedB = new Uint8Array(maxLen);
    paddedA.set(bufA);
    paddedB.set(bufB);

    const [sigA, sigB] = await Promise.all([
      crypto.subtle.sign('HMAC', key, new Uint8Array([...paddedA, ...challenge])),
      crypto.subtle.sign('HMAC', key, new Uint8Array([...paddedB, ...challenge])),
    ]);

    const arrA = new Uint8Array(sigA);
    const arrB = new Uint8Array(sigB);
    let diff = 0;
    for (let i = 0; i < arrA.length; i++) diff |= arrA[i] ^ arrB[i];
    
    // Resultado correto apenas se os strings são idênticos E mesmo tamanho
    return diff === 0 && bufA.length === bufB.length;
  } catch {
    // Fallback síncrono simples (menos seguro, mas não quebra)
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
}

/**
 * Sempre executa a mesma operação assíncrona com delay mínimo garantido.
 * Útil para login: mesmo quando o usuário não existe, executa o hash.
 * @param {Function} fn - Função a executar
 * @param {number} minMs - Tempo mínimo garantido em ms
 */
export async function withMinDelay(fn, minMs = 200) {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  if (elapsed < minMs) {
    await new Promise(r => setTimeout(r, minMs - elapsed));
  }
  return result;
}

/**
 * Gera token seguro de N bytes (retorna hex).
 * @param {number} bytes
 * @returns {string}
 */
export function generateSecureToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calcula SHA-256 hash de um string.
 * @param {string} input
 * @returns {Promise<string>} hex digest
 */
export async function sha256(input) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Mensagens padronizadas anti-enumeração.
 * Sempre use estas constantes para respostas de erro sensíveis.
 */
export const SAFE_MESSAGES = {
  // Login — nunca revela se email existe ou senha está errada
  LOGIN_FAIL: 'Credenciais inválidas',
  
  // Reset — nunca revela se email existe
  RESET_SENT: 'Se existir uma conta com este e-mail, enviaremos as instruções de redefinição.',
  RESET_INVALID: 'Link inválido ou expirado.',
  
  // Booking — nunca revela dados de outros clientes
  BOOKING_CONFLICT: 'Este horário não está disponível. Por favor, escolha outro.',
  CUSTOMER_NOT_FOUND: 'Dados não encontrados.',
  
  // Genérico
  UNAUTHORIZED: 'Acesso não autorizado.',
  FORBIDDEN: 'Ação não permitida.',
  TOO_MANY_REQUESTS: 'Muitas tentativas. Aguarde alguns minutos.',
};