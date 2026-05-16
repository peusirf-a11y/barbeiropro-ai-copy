// manageConsent — Gerencia consentimentos LGPD de clientes.
// HARDENED: valida tenant do caller antes de qualquer operação.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_CONSENT_TYPES = [
  'whatsapp_marketing', 'email_marketing', 'automated_reminders',
  'post_service_review', 'ai_recommendations', 'data_processing_general',
];

const LEGAL_TEXT = {
  whatsapp_marketing: 'Autorizo receber mensagens de marketing, promoções e campanhas via WhatsApp. Você pode revogar este consentimento a qualquer momento.',
  email_marketing: 'Autorizo receber e-mails de marketing, novidades e promoções. Você pode cancelar a qualquer momento.',
  automated_reminders: 'Autorizo receber lembretes automáticos sobre meus agendamentos via WhatsApp.',
  post_service_review: 'Autorizo receber solicitação de avaliação após meus atendimentos via WhatsApp.',
  ai_recommendations: 'Autorizo o uso do meu histórico de visitas para receber sugestões personalizadas de planos e serviços.',
  data_processing_general: 'Concordo com o tratamento dos meus dados pessoais para prestação dos serviços contratados, conforme a Política de Privacidade.',
};

const LEGAL_TEXT_VERSION = '1.0';
const REQUEST_ID = () => crypto.randomUUID().split('-')[0];

// Inline tenant resolver
async function resolveCallerCompanyId(sdk, user) {
  if (user.is_super_admin) return '__SUPER__';
  const co = await sdk.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (co?.[0]) return co[0].id;
  const tm = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  if (tm?.[0] && tm[0].active !== false) return tm[0].company_id;
  return null;
}

Deno.serve(async (req) => {
  const rid = REQUEST_ID();
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, company_id, customer_id, customer_token, consent_type, granted } = body;

    if (!company_id || !customer_id) {
      return Response.json({ error: 'company_id e customer_id obrigatórios', request_id: rid }, { status: 400 });
    }

    const sdk = base44.asServiceRole;
    let actorEmail = null;
    let actorType = 'system';
    let source = 'api';

    if (customer_token) {
      // Autenticação por token do cliente
      const customer = await sdk.entities.Customer.get(customer_id).catch(() => null);
      if (!customer || customer.auth_token !== customer_token || customer.company_id !== company_id) {
        return Response.json({ error: 'Token inválido', request_id: rid }, { status: 401 });
      }
      if (customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) < new Date()) {
        return Response.json({ error: 'Token expirado', request_id: rid }, { status: 401 });
      }
      actorType = 'customer_self';
      actorEmail = customer.email || customer.phone;
      source = 'customer_dashboard';
    } else {
      // Autenticação como admin/staff — VALIDA TENANT
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized', request_id: rid }, { status: 401 });

      const callerCompanyId = await resolveCallerCompanyId(sdk, user);
      if (!callerCompanyId) {
        return Response.json({ error: 'FORBIDDEN_TENANT', request_id: rid }, { status: 403 });
      }

      // CRÍTICO: bloquear cross-tenant
      if (callerCompanyId !== '__SUPER__' && callerCompanyId !== company_id) {
        console.error(`[manageConsent] rid=${rid} CROSS_TENANT user=${user.email} claimed=${company_id} actual=${callerCompanyId}`);
        await sdk.entities.SecurityEvent.create({
          event_type: 'cross_tenant_attempt',
          severity: 'critical',
          company_id,
          actor_email: user.email,
          ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
          route: 'manageConsent',
          details: { claimed_company_id: company_id, actual_company_id: callerCompanyId, action },
          blocked: true,
          request_id: rid,
        }).catch(() => {});
        return Response.json({ error: 'FORBIDDEN_TENANT', request_id: rid }, { status: 403 });
      }

      actorEmail = user.email;
      actorType = user.role === 'admin' ? 'admin' : 'staff';
      source = 'staff_on_behalf';
    }

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (action === 'list') {
      const consents = await sdk.entities.CustomerConsent.filter({ company_id, customer_id }, '-created_date', 100);
      return Response.json({ success: true, consents });
    }

    // ── SET (grant/revoke) ────────────────────────────────────────────────────
    if (action === 'set') {
      if (!consent_type || !VALID_CONSENT_TYPES.includes(consent_type)) {
        return Response.json({ error: `consent_type inválido`, request_id: rid }, { status: 400 });
      }
      if (typeof granted !== 'boolean') {
        return Response.json({ error: 'granted deve ser boolean', request_id: rid }, { status: 400 });
      }

      const existing = await sdk.entities.CustomerConsent.filter({ company_id, customer_id, consent_type }, '-created_date', 1);
      const now = new Date().toISOString();
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;
      const userAgent = req.headers.get('user-agent') || null;

      if (existing.length > 0) {
        const updated = {
          granted, legal_text_version: LEGAL_TEXT_VERSION,
          legal_text_snippet: LEGAL_TEXT[consent_type] || null,
          source, ip_address: ip, user_agent: userAgent,
          ...(granted ? { granted_at: now, revoked_at: null } : { revoked_at: now, granted_at: existing[0].granted_at || null }),
        };
        await sdk.entities.CustomerConsent.update(existing[0].id, updated);
      } else {
        await sdk.entities.CustomerConsent.create({
          company_id, customer_id, consent_type, granted,
          granted_at: granted ? now : null, revoked_at: granted ? null : now,
          source, ip_address: ip, user_agent: userAgent,
          legal_text_version: LEGAL_TEXT_VERSION,
          legal_text_snippet: LEGAL_TEXT[consent_type] || null,
        });
      }

      await sdk.entities.PrivacyAuditLog.create({
        company_id, customer_id, actor_email: actorEmail, actor_type: actorType,
        action: granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
        details: { consent_type, legal_text_version: LEGAL_TEXT_VERSION, request_id: rid },
        ip_address: ip, user_agent: userAgent, severity: 'info',
      }).catch(e => console.warn('[manageConsent] audit log failed:', e.message));

      return Response.json({ success: true, consent_type, granted });
    }

    return Response.json({ error: 'action deve ser "list" ou "set"', request_id: rid }, { status: 400 });

  } catch (error) {
    console.error(`[manageConsent] rid=${rid} INTERNAL_ERROR:`, error?.message, error?.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});