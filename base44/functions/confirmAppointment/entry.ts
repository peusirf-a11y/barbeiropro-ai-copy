// Endpoint público — confirma um agendamento via token único.
// Não exige login. Idempotente: já confirmado retorna sucesso.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: confirmAppointment');
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json().catch(() => ({}));
    if (!token) {
      return Response.json({ success: false, error: 'Token obrigatório' }, { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.Appointment.filter({ confirm_token: token }, '-created_date', 1);
    const appt = matches?.[0];
    if (!appt) {
      return Response.json({ success: false, error: 'Agendamento não encontrado ou link inválido' }, { status: 404 });
    }

    // Buscar empresa para retorno bonito
    let company = null;
    try { company = await base44.asServiceRole.entities.Company.get(appt.company_id); } catch { /* ignore */ }

    // Estados finais — não pode confirmar
    if (['cancelado', 'concluido', 'faltou'].includes(appt.status)) {
      return Response.json({
        success: false,
        already_final: true,
        status: appt.status,
        appointment: { customer_name: appt.customer_name, scheduled_at: appt.scheduled_at, service_name: appt.service_name },
        company: company ? { name: company.name, primary_color: company.primary_color } : null,
        error: 'Este agendamento não pode mais ser confirmado.',
      });
    }

    // Já confirmado — idempotente
    if (appt.status === 'confirmado') {
      return Response.json({
        success: true,
        already_confirmed: true,
        appointment: { customer_name: appt.customer_name, scheduled_at: appt.scheduled_at, service_name: appt.service_name, professional_name: appt.professional_name },
        company: company ? { name: company.name, primary_color: company.primary_color, address: company.address } : null,
      });
    }

    await base44.asServiceRole.entities.Appointment.update(appt.id, {
      status: 'confirmado',
      confirmed_at: new Date().toISOString(),
    });

    console.log('JOB END: confirmAppointment', { appointment_id: appt.id });
    return Response.json({
      success: true,
      appointment: { customer_name: appt.customer_name, scheduled_at: appt.scheduled_at, service_name: appt.service_name, professional_name: appt.professional_name },
      company: company ? { name: company.name, primary_color: company.primary_color, address: company.address } : null,
    });
  } catch (error) {
    console.error('JOB ERROR: confirmAppointment:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});