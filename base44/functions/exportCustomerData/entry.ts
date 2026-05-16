// exportCustomerData — LGPD Art. 18 (portabilidade e acesso).
// HARDENED: valida tenant do caller autenticado (não confia em company_id do payload).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const REQUEST_ID = () => crypto.randomUUID().split('-')[0];

// Inline tenant resolver (Deno não suporta local imports entre functions)
async function resolveCallerCompanyId(sdk, user, company_id_claimed) {
  if (user.is_super_admin) return '__SUPER__'; // Master pode exportar qualquer tenant

  // Owner?
  const co = await sdk.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (co?.[0]) return co[0].id;

  // TeamMember?
  const tm = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  if (tm?.[0] && tm[0].active !== false) return tm[0].company_id;

  return null;
}

Deno.serve(async (req) => {
  const rid = REQUEST_ID();
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { company_id, customer_id, customer_token } = body;

    if (!company_id || !customer_id) {
      return Response.json({ error: 'company_id e customer_id obrigatórios', request_id: rid }, { status: 400 });
    }

    const sdk = base44.asServiceRole;
    let actorEmail = null;
    let actorType = 'system';

    if (customer_token) {
      // Autenticação por token do próprio cliente
      const customer = await sdk.entities.Customer.get(customer_id).catch(() => null);
      if (!customer || customer.auth_token !== customer_token || customer.company_id !== company_id) {
        return Response.json({ error: 'Token inválido ou expirado', request_id: rid }, { status: 401 });
      }
      if (customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) < new Date()) {
        return Response.json({ error: 'Token expirado', request_id: rid }, { status: 401 });
      }
      actorType = 'customer_self';
      actorEmail = customer.email || customer.phone;
    } else {
      // Autenticação como admin/staff — VALIDA TENANT
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized', request_id: rid }, { status: 401 });

      const callerCompanyId = await resolveCallerCompanyId(sdk, user, company_id);

      if (!callerCompanyId) {
        console.warn(`[exportCustomerData] rid=${rid} no company for user=${user.email}`);
        return Response.json({ error: 'FORBIDDEN_TENANT', request_id: rid }, { status: 403 });
      }

      // CRÍTICO: valida que o caller tem acesso à empresa solicitada
      if (callerCompanyId !== '__SUPER__' && callerCompanyId !== company_id) {
        // Registra tentativa de acesso cross-tenant
        console.error(`[exportCustomerData] rid=${rid} CROSS_TENANT_ATTEMPT user=${user.email} claimed=${company_id} actual=${callerCompanyId}`);
        await sdk.entities.SecurityEvent.create({
          event_type: 'cross_tenant_attempt',
          severity: 'critical',
          company_id,
          actor_email: user.email,
          ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
          route: 'exportCustomerData',
          details: { claimed_company_id: company_id, actual_company_id: callerCompanyId },
          blocked: true,
          request_id: rid,
        }).catch(() => {});
        return Response.json({ error: 'FORBIDDEN_TENANT', request_id: rid }, { status: 403 });
      }

      actorEmail = user.email;
      actorType = user.role === 'admin' ? 'admin' : 'staff';
    }

    // Busca todos os dados do cliente
    const [customer, appointments, financialEntries, subscriptions, reviews, whatsappMessages, consents] = await Promise.all([
      sdk.entities.Customer.get(customer_id).catch(() => null),
      sdk.entities.Appointment.filter({ company_id, customer_id }, '-scheduled_at', 500),
      sdk.entities.FinancialEntry.filter({ company_id, customer_id }, '-date', 500),
      sdk.entities.CustomerSubscription.filter({ company_id, customer_id }, '-created_date', 100),
      sdk.entities.Review.filter({ company_id, customer_id }, '-created_date', 100),
      sdk.entities.WhatsAppMessage.filter({ company_id, customer_id }, '-sent_at', 200),
      sdk.entities.CustomerConsent.filter({ company_id, customer_id }, '-created_date', 100),
    ]);

    if (!customer || customer.company_id !== company_id) {
      return Response.json({ error: 'Cliente não encontrado', request_id: rid }, { status: 404 });
    }

    // Monta pacote — remove campos sensíveis internos
    const exportData = {
      export_metadata: {
        generated_at: new Date().toISOString(),
        lgpd_basis: 'Art. 18, inciso V — Portabilidade',
        customer_id,
        company_id,
        version: '2.0',
        request_id: rid,
      },
      personal_data: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email || null,
        notes: customer.notes || null,
        tags: customer.tags || [],
        status: customer.status,
        lifecycle_status: customer.lifecycle_status || null,
        registered_at: customer.created_date,
        last_appointment: customer.last_completed_at || null,
        total_appointments: customer.total_appointments || 0,
      },
      // Nunca incluir: password_hash, auth_token, reset_token, payment_intent_id, payer_tax_id
      appointments: appointments.map(a => ({
        id: a.id,
        scheduled_at: a.scheduled_at,
        service: a.service_name,
        professional: a.professional_name,
        status: a.status,
        price: a.price || null,
        payment_method: a.payment_method || null,
        source: a.source,
      })),
      subscriptions: subscriptions.map(s => ({
        id: s.id,
        plan_name: s.plan_name_snapshot,
        price: s.plan_price_snapshot,
        status: s.status,
        started_at: s.created_date,
        current_cycle_end: s.current_cycle_end || null,
        uses_remaining: s.uses_remaining,
      })),
      financial_entries: financialEntries.map(f => ({
        id: f.id,
        date: f.date,
        type: f.type,
        amount: f.amount,
        description: f.description,
        origin: f.origin,
        payment_method: f.payment_method || null,
      })),
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        nps_score: r.nps_score || null,
        comment: r.comment || null,
        service: r.service_name,
        submitted_at: r.submitted_at || r.created_date,
        published: r.published,
      })),
      whatsapp_messages: whatsappMessages.map(m => ({
        id: m.id,
        type: m.type,
        sent_at: m.sent_at,
        status: m.status,
        message_preview: m.message_text ? m.message_text.slice(0, 100) + (m.message_text.length > 100 ? '...' : '') : null,
      })),
      consents: consents.map(c => ({
        consent_type: c.consent_type,
        granted: c.granted,
        granted_at: c.granted_at || null,
        revoked_at: c.revoked_at || null,
        source: c.source,
        legal_text_version: c.legal_text_version || null,
      })),
    };

    // Auditoria
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await sdk.entities.PrivacyAuditLog.create({
      company_id, customer_id, actor_email: actorEmail, actor_type: actorType,
      action: 'DATA_EXPORT_REQUESTED',
      details: {
        records_exported: {
          appointments: appointments.length, financial_entries: financialEntries.length,
          subscriptions: subscriptions.length, reviews: reviews.length,
          whatsapp_messages: whatsappMessages.length, consents: consents.length,
        },
        request_id: rid,
      },
      severity: 'info', ip_address: ip,
    }).catch(e => console.warn('[exportCustomerData] audit log failed:', e.message));

    console.log(`[exportCustomerData] rid=${rid} exported for customer=${customer_id} by ${actorEmail}/${actorType}`);
    return Response.json({ success: true, data: exportData });

  } catch (error) {
    console.error(`[exportCustomerData] rid=${rid} INTERNAL_ERROR:`, error?.message, error?.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});