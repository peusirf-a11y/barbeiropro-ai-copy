/**
 * honeypot.js — Campos honeypot para detecção de bots.
 *
 * Campos invisíveis que humanos não preenchem mas bots preenchem.
 * Ao detectar, bloqueia silenciosamente e registra SecurityEvent.
 * 
 * USO: frontend + backend (validação dupla).
 */

// Nome dos campos honeypot (devem ser únicos e parecer legítimos para bots)
export const HONEYPOT_FIELDS = {
  EMAIL_CONFIRM: 'email_confirm',    // "confirme o email" — bots preenchem
  PHONE_ALT: 'phone_alt',           // "telefone alternativo" — bots preenchem
  WEBSITE: 'website',               // campo "website" — bots adoram
  FULL_ADDRESS: 'full_address',     // "endereço completo" — isca para form-fillers
};

/**
 * Verifica se algum campo honeypot foi preenchido.
 * @param {object} formData - Dados do formulário
 * @returns {{ triggered: boolean, fields: string[] }}
 */
export function checkHoneypot(formData) {
  if (!formData) return { triggered: false, fields: [] };

  const triggered = [];
  
  for (const field of Object.values(HONEYPOT_FIELDS)) {
    const value = formData[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      triggered.push(field);
    }
  }

  return {
    triggered: triggered.length > 0,
    fields: triggered,
  };
}

/**
 * Validação do honeypot no backend (Deno).
 * @param {object} body - Request body
 * @returns {{ isBot: boolean, reason: string|null }}
 */
export function validateHoneypot(body) {
  if (!body) return { isBot: false, reason: null };

  const { triggered, fields } = checkHoneypot(body);

  if (triggered) {
    return {
      isBot: true,
      reason: `Honeypot preenchido: ${fields.join(', ')}`,
    };
  }

  return { isBot: false, reason: null };
}

/**
 * Gera props para input honeypot (React).
 * Renderiza input oculto visualmente mas detectável por bots.
 * @param {string} fieldName - Nome do campo honeypot
 * @returns {object} Props para o input
 */
export function honeypotInputProps(fieldName) {
  return {
    name: fieldName,
    type: 'text',
    autoComplete: 'off',
    tabIndex: -1,
    'aria-hidden': 'true',
    style: {
      position: 'absolute',
      left: '-9999px',
      top: '-9999px',
      width: '1px',
      height: '1px',
      opacity: 0,
      pointerEvents: 'none',
    },
  };
}

// useHoneypot é um React hook — importar apenas em componentes React
// Ver: components/security/HoneypotFields.jsx para o hook de UI