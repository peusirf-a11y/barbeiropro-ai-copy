// exportCustomerData — LGPD Art. 18 (portabilidade e acesso)
// Gera um JSON estruturado com todos os dados pessoais do cliente.
// Pode ser chamado pelo próprio cliente (via token) ou por admin da empresa.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { company_id, customer_id, customer_token } = body;

    if (!company_id || !customer_id) {
      return Response.json({ error: 'company_id e customer_id obrigatórios' }, { status: 400 });
    }

    const sdk = base44.asServiceRole;

    // Auth: aceita admin da plataforma OU token do próprio cliente
    let actorEmail = null;
    let actorType = 'system';

    if (customer_token) {
      // Verifica token do cliente
      const customer = await sdk.entities.Customer.get(customer_id);
      if (!customer || customer.auth_token !== customer_token || customer.company_id !== company_id) {
        return Response.json({ error: 'Token inválido ou expirado' }, { status: 401 });
      }
      if (customer.auth_token_expires_at && new Date(customer.auth_token_expires_at) < new Date()) {
        return Response.json({ error: 'Token expirado' }, { status: 401 });
      }
      actorType = 'customer_self';
      actorEmail = customer.email || customer.phone;
    } else {
      // Verifica usuário autenticado (admin/staff)
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      actorEmail = user.email;
      actorType = user.role === 'admin' ? 'admin' : 'staff';
    }

    // Busca todos os dados do cliente
    const [customer, appointments, financialEntries, subscriptions, reviews, whatsappMessages, consents] = await Promise.all([
      sdk.entities.Customer.get(customer_id),
      sdk.entities.Appointment.filter({ company_id, customer_id }, '-scheduled_at', 500),
      sdk.entities.FinancialEntry.filter({ company_id, customer_id }, '-date', 500),
      sdk.entities.CustomerSubscription.filter({ company_id, customer_id }, '-created_date', 100),
      sdk.entities.Review.filter({ company_id, customer_id }, '-created_date', 100),
      sdk.entities.WhatsAppMessage.filter({ company_id, customer_id }, '-sent_at', 200),
      sdk.entities.CustomerConsent.filter({ company_id, customer_id }, '-created_date', 100),
    ]);

    if (!customer || customer.company_id !== company_id) {
      return Response.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Monta o pacote de dados — remove campos sensíveis internos
    const exportData = {
      export_metadata: {
        generated_at: new Date().toISOString(),
        lgpd_basis: 'Art. 18, inciso V — Portabilidade',
        customer_id,
        company_id,
        version: '1.0',
      },
      personal_data: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email || null,
        notes: customer.notes || null,
        tags: customer.tags || [],
        status: customer.status,
        lifecycle_status: customer.lifecycle_status || null,
        favorite_service: customer.favorite_service || null,
        favorite_professional: customer.favorite_professional || null,
        registered_at: customer.created_date,
        last_appointment: customer.last_completed_at || null,
        total_appointments: customer.total_appointments || 0,
      },
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

    // Registra no PrivacyAuditLog
    await sdk.entities.PrivacyAuditLog.create({
      company_id,
      customer_id,
      actor_email: actorEmail,
      actor_type: actorType,
      action: 'DATA_EXPORT_REQUESTED',
      details: {
        records_exported: {
          appointments: appointments.length,
          financial_entries: financialEntries.length,
          subscriptions: subscriptions.length,
          reviews: reviews.length,
          whatsapp_messages: whatsappMessages.length,
          consents: consents.length,
        },
      },
      severity: 'info',
    });

    console.log('[exportCustomerData] exported for', customer_id, 'by', actorEmail, actorType);
    return Response.json({ success: true, data: exportData });

  } catch (error) {
    console.error('[exportCustomerData] error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});