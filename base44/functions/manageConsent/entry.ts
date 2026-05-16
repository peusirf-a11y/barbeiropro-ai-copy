// manageConsent — Gerencia consentimentos LGPD de clientes.
// Suporta: granting, revoking e listing.
// Chamado pela área do cliente (token) ou pelo staff (admin).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_CONSENT_TYPES = [
  'whatsapp_marketing',
  'email_marketing',
  'automated_reminders',
  'post_service_review',
  'ai_recommendations',
  'data_processing_general',
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, company_id, customer_id, customer_token, consent_type, granted } = body;

    if (!company_id || !customer_id) {
      return Response.json({ error: 'company_id e customer_id obrigatórios' }, { status: 400 });
    }

    const sdk = base44.asServiceRole;
    let actorEmail = null;
    let actorType = 'system';
    let source = 'api';

    if (customer_token) {
      const customer = await sdk.entities.Customer.get(customer_id);
      if (!customer || customer.auth_token !== customer_token || customer.company_id !== company_id) {
        return Response.json({ error: 'Token inválido' }, { status: 401 });
      }
      if (customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) < new Date()) {
        return Response.json({ error: 'Token expirado' }, { status: 401 });
      }
      actorType = 'customer_self';
      actorEmail = customer.email || customer.phone;
      source = 'customer_dashboard';
    } else {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
        return Response.json({ error: `consent_type inválido. Valores aceitos: ${VALID_CONSENT_TYPES.join(', ')}` }, { status: 400 });
      }
      if (typeof granted !== 'boolean') {
        return Response.json({ error: 'granted deve ser boolean' }, { status: 400 });
      }

      // Busca consentimento existente do mesmo tipo
      const existing = await sdk.entities.CustomerConsent.filter({ company_id, customer_id, consent_type }, '-created_date', 1);

      const now = new Date().toISOString();
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;
      const userAgent = req.headers.get('user-agent') || null;

      if (existing.length > 0) {
        // Atualiza o existente
        const updated = {
          granted,
          legal_text_version: LEGAL_TEXT_VERSION,
          legal_text_snippet: LEGAL_TEXT[consent_type] || null,
          source,
          ip_address: ip,
          user_agent: userAgent,
        };
        if (granted) {
          updated.granted_at = now;
          updated.revoked_at = null;
        } else {
          updated.revoked_at = now;
          updated.granted_at = existing[0].granted_at || null;
        }
        await sdk.entities.CustomerConsent.update(existing[0].id, updated);
      } else {
        // Cria novo
        await sdk.entities.CustomerConsent.create({
          company_id,
          customer_id,
          consent_type,
          granted,
          granted_at: granted ? now : null,
          revoked_at: granted ? null : now,
          source,
          ip_address: ip,
          user_agent: userAgent,
          legal_text_version: LEGAL_TEXT_VERSION,
          legal_text_snippet: LEGAL_TEXT[consent_type] || null,
        });
      }

      // Registra no PrivacyAuditLog
      await sdk.entities.PrivacyAuditLog.create({
        company_id,
        customer_id,
        actor_email: actorEmail,
        actor_type: actorType,
        action: granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
        details: { consent_type, legal_text_version: LEGAL_TEXT_VERSION },
        ip_address: ip,
        user_agent: userAgent,
        severity: 'info',
      });

      console.log('[manageConsent] set', consent_type, '=', granted, 'for', customer_id, 'by', actorEmail);
      return Response.json({ success: true, consent_type, granted });
    }

    return Response.json({ error: 'action deve ser "list" ou "set"' }, { status: 400 });

  } catch (error) {
    console.error('[manageConsent] error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});