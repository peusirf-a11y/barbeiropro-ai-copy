// anonymizeCustomer — LGPD Art. 18, inc. IV (anonimização).
// HARDENED:
//  - Valida tenant do caller (não confia em company_id do payload)
//  - UUID aleatório para anon ID (não previsível)
//  - Idempotência segura
//  - Audit log completo

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const REQUEST_ID = () => crypto.randomUUID().split('-')[0];

// Gera ID anônimo completamente aleatório e não previsível
function generateAnonId() {
  return `anon_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

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
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = req.headers.get('user-agent') || null;

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { company_id, customer_id, reason, customer_token } = body;

    if (!company_id || !customer_id) {
      return Response.json({ error: 'company_id e customer_id obrigatórios', request_id: rid }, { status: 400 });
    }

    const sdk = base44.asServiceRole;
    let actorEmail = null;
    let actorType = 'system';

    if (customer_token) {
      const customer = await sdk.entities.Customer.get(customer_id).catch(() => null);
      if (!customer || customer.auth_token !== customer_token || customer.company_id !== company_id) {
        return Response.json({ error: 'Token inválido', request_id: rid }, { status: 401 });
      }
      actorType = 'customer_self';
      actorEmail = customer.email || customer.phone;
    } else {
      // Autenticação como admin — VALIDA TENANT
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized', request_id: rid }, { status: 401 });

      // Apenas admin pode anonimizar no painel (não staff genérico)
      const callerCompanyId = await resolveCallerCompanyId(sdk, user);
      if (!callerCompanyId) {
        return Response.json({ error: 'FORBIDDEN_TENANT', request_id: rid }, { status: 403 });
      }

      // CRÍTICO: validação cross-tenant
      if (callerCompanyId !== '__SUPER__' && callerCompanyId !== company_id) {
        console.error(`[anonymizeCustomer] rid=${rid} CROSS_TENANT_ATTEMPT user=${user.email} claimed=${company_id} actual=${callerCompanyId}`);
        await sdk.entities.SecurityEvent.create({
          event_type: 'cross_tenant_attempt',
          severity: 'critical',
          company_id,
          actor_email: user.email,
          ip_address: ip,
          route: 'anonymizeCustomer',
          details: { claimed_company_id: company_id, actual_company_id: callerCompanyId, customer_id },
          blocked: true,
          request_id: rid,
        }).catch(() => {});
        return Response.json({ error: 'FORBIDDEN_TENANT', request_id: rid }, { status: 403 });
      }

      // Verificar role: apenas admin pode anonimizar
      if (callerCompanyId !== '__SUPER__') {
        const tm = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
        const role = tm?.[0]?.role || 'admin'; // owner = admin
        if (!['admin'].includes(role)) {
          return Response.json({ error: 'Apenas admins podem anonimizar clientes', request_id: rid }, { status: 403 });
        }
      }

      actorEmail = user.email;
      actorType = 'admin';
    }

    const customer = await sdk.entities.Customer.get(customer_id).catch(() => null);
    if (!customer || customer.company_id !== company_id) {
      return Response.json({ error: 'Cliente não encontrado', request_id: rid }, { status: 404 });
    }

    // Idempotência segura — verifica se já foi anonimizado
    if (customer.name?.startsWith('Cliente #anon_')) {
      return Response.json({ error: 'Cliente já foi anonimizado', request_id: rid }, { status: 409 });
    }

    // Gera ID totalmente aleatório (não derivado do customer_id)
    const anonId = generateAnonId();
    const anonName = `Cliente #${anonId}`;

    // 1. Anonimiza o cadastro do cliente — remove todos os dados pessoais
    await sdk.entities.Customer.update(customer_id, {
      name: anonName,
      phone: '+00000000000',
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
      token_version: (customer.token_version || 0) + 1, // invalida sessões ativas
    });

    // 2. Anonimiza referências em Appointments
    const appointments = await sdk.entities.Appointment.filter({ company_id, customer_id }, '-scheduled_at', 500);
    await Promise.all(appointments.map(a =>
      sdk.entities.Appointment.update(a.id, {
        customer_name: anonName,
        customer_phone: '+00000000000',
        customer_email: null,
        payer_tax_id: null,
      })
    ));

    // 3. Anonimiza Reviews
    const reviews = await sdk.entities.Review.filter({ company_id, customer_id }, '-created_date', 100);
    await Promise.all(reviews.map(r =>
      sdk.entities.Review.update(r.id, { customer_name: anonName })
    ));

    // 4. Anonimiza WhatsAppMessages
    const messages = await sdk.entities.WhatsAppMessage.filter({ company_id, customer_id }, '-sent_at', 200);
    await Promise.all(messages.map(m =>
      sdk.entities.WhatsAppMessage.update(m.id, {
        phone: '+00000000000',
        customer_name: anonName,
        message_text: '[conteúdo removido por solicitação LGPD]',
      })
    ));

    // 5. Auditoria completa
    await sdk.entities.PrivacyAuditLog.create({
      company_id, customer_id,
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
        request_id: rid,
      },
      severity: 'warning',
      ip_address: ip,
      user_agent: ua,
    }).catch(e => console.warn('[anonymizeCustomer] audit log failed:', e.message));

    console.log(`[anonymizeCustomer] rid=${rid} anonymized customer=${customer_id} as ${anonName} by ${actorEmail}`);
    return Response.json({
      success: true,
      message: `Cliente anonimizado com sucesso. Esta operação é irreversível.`,
    });

  } catch (error) {
    console.error(`[anonymizeCustomer] rid=${rid} INTERNAL_ERROR:`, error?.message, error?.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});