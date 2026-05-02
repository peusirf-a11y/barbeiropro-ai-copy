// createPublicAppointment — cria agendamento via link público (não autenticado).
//
// Garante:
// 1) Customer auto-cadastro: se telefone já existe na empresa → reutiliza; senão cria.
// 2) Vincula customer_id ao Appointment.
// 3) Tudo via asServiceRole (não exige login do cliente final).
// 4) Dispara e-mail de confirmação se houver email.
//
// Usado pela página /agendar/:slug.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    const {
      company_id,
      unit_id,
      professional_id,
      professional_name,
      service_id,
      service_name,
      customer_name,
      customer_phone,
      customer_email,
      scheduled_at,
      notes,
      price,
      confirm_token,
      review_token,
      confirm_token_expires_at,
      review_token_expires_at,
      scope_customer_by_unit,
    } = body;

    // Validações mínimas
    if (!company_id) return Response.json({ success: false, error: 'company_id_required' }, { status: 400 });
    if (!service_id) return Response.json({ success: false, error: 'service_id_required' }, { status: 400 });
    if (!professional_id) return Response.json({ success: false, error: 'professional_id_required' }, { status: 400 });
    if (!scheduled_at) return Response.json({ success: false, error: 'scheduled_at_required' }, { status: 400 });
    if (!customer_name?.trim()) return Response.json({ success: false, error: 'customer_name_required' }, { status: 400 });
    if (!customer_phone?.trim()) return Response.json({ success: false, error: 'customer_phone_required' }, { status: 400 });

    // Telefone normalizado (só dígitos)
    const phoneNorm = String(customer_phone).replace(/\D/g, '');
    if (phoneNorm.length < 10) {
      return Response.json({ success: false, error: 'invalid_phone' }, { status: 400 });
    }

    // 1) Lookup cliente por telefone
    const lookupFilter = scope_customer_by_unit && unit_id
      ? { company_id, phone: phoneNorm, unit_id }
      : { company_id, phone: phoneNorm };

    const matches = await sdk.entities.Customer.filter(lookupFilter, '-created_date', 1);
    let customer = matches?.[0] || null;

    // 2) Se não existe → cria
    if (!customer) {
      console.log(`[createPublicAppointment] criando novo customer: ${customer_name} / ${phoneNorm}`);
      customer = await sdk.entities.Customer.create({
        company_id,
        unit_id: scope_customer_by_unit ? unit_id : undefined,
        name: customer_name.trim(),
        phone: phoneNorm,
        email: customer_email?.trim() || undefined,
        status: 'active',
      });
    } else {
      console.log(`[createPublicAppointment] cliente existente reutilizado: ${customer.id}`);
      // Atualiza email se antes não tinha e agora foi informado (não sobrescreve dados existentes)
      if (customer_email?.trim() && !customer.email) {
        try {
          await sdk.entities.Customer.update(customer.id, { email: customer_email.trim() });
        } catch (err) {
          console.warn('[createPublicAppointment] falha ao atualizar email do customer:', err.message);
        }
      }
    }

    // 3) Cria Appointment vinculado
    const appointment = await sdk.entities.Appointment.create({
      company_id,
      unit_id: unit_id || undefined,
      customer_id: customer.id,
      professional_id,
      professional_name,
      service_id,
      service_name,
      customer_name: customer_name.trim(),
      customer_phone: phoneNorm,
      customer_email: customer_email?.trim() || undefined,
      scheduled_at,
      notes,
      status: 'agendado',
      price,
      source: 'online',
      confirm_token,
      review_token,
      confirm_token_expires_at,
      review_token_expires_at,
    });

    console.log(`[createPublicAppointment] agendamento criado: ${appointment.id} para customer ${customer.id}`);

    // 4) Dispara e-mail de confirmação (não bloqueia)
    if (customer_email?.trim()) {
      sdk.functions
        .invoke('sendBookingConfirmation', { appointment_id: appointment.id })
        .catch((err) => console.warn('[createPublicAppointment] falha ao disparar e-mail:', err.message));
    }

    return Response.json({
      success: true,
      appointment_id: appointment.id,
      customer_id: customer.id,
      customer_was_created: !matches?.length,
    });
  } catch (error) {
    console.error('[createPublicAppointment] erro:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});