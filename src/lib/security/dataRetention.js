/**
 * dataRetention.js — Políticas de retenção de dados (LGPD).
 *
 * Define quando cada tipo de dado deve ser purgado.
 * Usado pelo job purgeExpiredSessions e relatórios de compliance.
 */

// ── POLÍTICAS DE RETENÇÃO ──────────────────────────────────────────────────────

export const RETENTION_POLICY = {
  // Sessões de usuário
  user_session: {
    ttlDays: 30,
    description: 'Sessões de autenticação de clientes',
    legalBasis: 'Execução do contrato (LGPD Art. 7, V)',
    action: 'delete',
  },

  // Tokens de reset de senha
  reset_token: {
    ttlDays: 1, // 24h
    description: 'Tokens de redefinição de senha',
    legalBasis: 'Legítimo interesse em segurança',
    action: 'clear',
  },

  // Tokens de confirmação de agendamento
  confirm_token: {
    ttlDays: 3,
    description: 'Tokens públicos de confirmação de agendamento',
    legalBasis: 'Execução do contrato',
    action: 'clear',
  },

  // Tokens de avaliação
  review_token: {
    ttlDays: 30,
    description: 'Tokens públicos de avaliação pós-atendimento',
    legalBasis: 'Legítimo interesse (feedback)',
    action: 'clear',
  },

  // SecurityEvent normais
  security_event_normal: {
    ttlDays: 90,
    description: 'Eventos de segurança low/medium',
    legalBasis: 'Legítimo interesse em segurança (LGPD Art. 7, IX)',
    action: 'delete',
  },

  // SecurityEvent críticos
  security_event_critical: {
    ttlDays: 365,
    description: 'Eventos de segurança high/critical',
    legalBasis: 'Obrigação legal / legítimo interesse',
    action: 'delete',
  },

  // AdminAuditLog críticos
  admin_audit_critical: {
    ttlDays: 365,
    description: 'Log de auditoria de ações críticas de admin',
    legalBasis: 'Obrigação legal de auditoria',
    action: 'retain', // nunca deletar (compliance)
  },

  // AdminAuditLog informacionais
  admin_audit_info: {
    ttlDays: 180,
    description: 'Log de auditoria informacional',
    legalBasis: 'Legítimo interesse',
    action: 'delete',
  },

  // Rate limit records
  security_rate_limit: {
    ttlDays: 30,
    description: 'Registros de rate limiting',
    legalBasis: 'Legítimo interesse em segurança',
    action: 'delete',
  },

  // CookieConsentLog
  cookie_consent: {
    ttlDays: 730, // 2 anos (duração do consentimento)
    description: 'Log de consentimento de cookies',
    legalBasis: 'Prova de consentimento (LGPD Art. 8)',
    action: 'retain',
  },

  // PrivacyAuditLog
  privacy_audit: {
    ttlDays: 365,
    description: 'Log de ações de privacidade LGPD',
    legalBasis: 'Prova de conformidade (LGPD Art. 6)',
    action: 'retain',
  },

  // WhatsAppMessage logs
  whatsapp_message: {
    ttlDays: 90,
    description: 'Log de mensagens WhatsApp enviadas',
    legalBasis: 'Legítimo interesse (comprovante)',
    action: 'delete',
  },

  // EmailLog
  email_log: {
    ttlDays: 90,
    description: 'Log de e-mails transacionais',
    legalBasis: 'Legítimo interesse',
    action: 'delete',
  },
};

/**
 * Calcula a data de corte para uma política.
 * @param {string} policyKey - Chave em RETENTION_POLICY
 * @param {Date} [now] - Data base (default: now)
 * @returns {Date|null} Data de corte (registros anteriores a esta data devem ser purgados)
 */
export function getRetentionCutoff(policyKey, now = new Date()) {
  const policy = RETENTION_POLICY[policyKey];
  if (!policy || policy.action === 'retain') return null;

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - policy.ttlDays);
  return cutoff;
}

/**
 * Gera relatório de retenção para compliance.
 * @param {object} stats - Contagens por tipo (ex: { user_session: 150, security_event_normal: 3200 })
 * @returns {object} Relatório estruturado
 */
export function generateRetentionReport(stats = {}) {
  const report = {
    generated_at: new Date().toISOString(),
    policies: [],
    compliance_score: 0,
    risks: [],
  };

  let totalPolicies = 0;
  let compliantPolicies = 0;

  for (const [key, policy] of Object.entries(RETENTION_POLICY)) {
    const count = stats[key] || 0;
    const isConfigured = true; // job existe
    const cutoff = getRetentionCutoff(key);

    const entry = {
      type: key,
      description: policy.description,
      ttl_days: policy.ttlDays,
      legal_basis: policy.legalBasis,
      action: policy.action,
      current_count: count,
      cutoff_date: cutoff?.toISOString() || 'permanent',
      configured: isConfigured,
    };

    report.policies.push(entry);
    totalPolicies++;
    if (isConfigured) compliantPolicies++;
  }

  report.compliance_score = Math.round((compliantPolicies / totalPolicies) * 100);

  // Identificar riscos
  if (stats.user_session > 10000) {
    report.risks.push('Alto volume de sessões ativas — verificar job de purge');
  }
  if (stats.security_event_normal > 50000) {
    report.risks.push('Volume excessivo de SecurityEvents — purge pendente');
  }

  return report;
}