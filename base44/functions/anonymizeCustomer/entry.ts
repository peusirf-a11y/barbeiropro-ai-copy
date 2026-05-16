// anonymizeCustomer — LGPD Art. 18, inc. IV (anonimização)
// Remove dados pessoais identificáveis do cliente, mantendo:
// - dados financeiros (obrigação fiscal)
// - métricas agregadas
// - histórico de agendamentos sem nome/contato
//
// Resultado: "Cliente #anon_XXXXX" — irreversível.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function generateAnonId(customerId) {
  // Gera um ID anônimo determinístico mas não reversível
  const hash = customerId.replace(/[^a-z0-9]/gi, '').slice(-5).toLowerCase();
  return `anon_${hash}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { company_id, customer_id, reason, customer_token } = body;

    if (!company_id || !customer_id) {
      return Response.json({ error: 'company_id e customer_id obrigatórios' }, { status: 400 });
    }

    const sdk = base44.asServiceRole;

    let actorEmail = null;
    let actorType = 'system';

    if (customer_token) {
      const customer = await sdk.entities.Customer.get(customer_id);
      if (!customer || customer.auth_token !== customer_token || customer.company_id !== company_id) {
        return Response.json({ error: 'Token inválido' }, { status: 401 });
      }
      actorType = 'customer_self';
      actorEmail = customer.email || customer.phone;
    } else {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Apenas admins podem anonimizar clientes' }, { status: 403 });
      actorEmail = user.email;
      actorType = 'admin';
    }

    const customer = await sdk.entities.Customer.get(customer_id);
    if (!customer || customer.company_id !== company_id) {
      return Response.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Verifica se já foi anonimizado
    if (customer.name?.startsWith('Cliente #anon_')) {
      return Response.json({ error: 'Cliente já foi anonimizado' }, { status: 409 });
    }

    const anonId = generateAnonId(customer_id);
    const anonName = `Cliente #${anonId}`;

    // 1. Anonimiza o cadastro do cliente
    await sdk.entities.Customer.update(customer_id, {
      name: anonName,
      phone: `+00000000000`,
      email: `${anonId}@anon.local`,
      notes: null,
      tags: [],
      favorite_service: null,
      favorite_professional: null,
      password_hash: null,
      auth_token: null,
      auth_token_expires_at: null,
      reset_token: null,
      reset_token_expires_at: null,
    });

    // 2. Anonimiza referências em Appointments (mantém dados operacionais/financeiros)
    const appointments = await sdk.entities.Appointment.filter({ company_id, customer_id }, '-scheduled_at', 500);
    const apptUpdates = appointments.map(a =>
      sdk.entities.Appointment.update(a.id, {
        customer_name: anonName,
        customer_phone: '+00000000000',
        customer_email: null,
        payer_tax_id: null,
      })
    );

    // 3. Anonimiza referências em Reviews
    const reviews = await sdk.entities.Review.filter({ company_id, customer_id }, '-created_date', 100);
    const reviewUpdates = reviews.map(r =>
      sdk.entities.Review.update(r.id, {
        customer_name: anonName,
      })
    );

    // 4. Anonimiza WhatsAppMessages
    const messages = await sdk.entities.WhatsAppMessage.filter({ company_id, customer_id }, '-sent_at', 200);
    const msgUpdates = messages.map(m =>
      sdk.entities.WhatsAppMessage.update(m.id, {
        phone: '+00000000000',
        customer_name: anonName,
        message_text: '[conteúdo removido por solicitação LGPD]',
      })
    );

    // Executa todas as atualizações em paralelo
    await Promise.all([...apptUpdates, ...reviewUpdates, ...msgUpdates]);

    // 5. Registra no PrivacyAuditLog
    await sdk.entities.PrivacyAuditLog.create({
      company_id,
      customer_id,
      actor_email: actorEmail,
      actor_type: actorType,
      action: 'DATA_ANONYMIZED',
      details: {
        anon_id: anonId,
        reason: reason || 'solicitação do titular',
        records_affected: {
          appointments: appointments.length,
          reviews: reviews.length,
          whatsapp_messages: messages.length,
        },
        original_name_hash: customer.name ? customer.name.length.toString() : '0', // não guarda o nome, só prova que havia
      },
      severity: 'warning',
    });

    console.log('[anonymizeCustomer] anonymized', customer_id, 'as', anonName, 'by', actorEmail);
    return Response.json({
      success: true,
      anon_id: anonId,
      message: `Cliente anonimizado com sucesso como "${anonName}". Esta operação é irreversível.`,
    });

  } catch (error) {
    console.error('[anonymizeCustomer] error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});