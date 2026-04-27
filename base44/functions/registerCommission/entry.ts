// Calcula e registra a comissão de um profissional ao concluir um atendimento.
// Chamado pelo frontend quando o status do agendamento muda para "concluido".
// Idempotente: se já existe Commission para o appointment_id, não duplica.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: registerCommission');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { appointment_id } = await req.json().catch(() => ({}));
    if (!appointment_id) return Response.json({ success: false, error: 'appointment_id required' }, { status: 400 });

    // Idempotência
    const existing = await base44.entities.Commission.filter({ appointment_id });
    if (existing && existing.length > 0) {
      console.log('Commission already registered for appointment', appointment_id);
      return Response.json({ success: true, skipped: true, commission_id: existing[0].id });
    }

    const appt = await base44.entities.Appointment.get(appointment_id);
    if (!appt) return Response.json({ success: false, error: 'Appointment not found' }, { status: 404 });

    const pro = await base44.entities.Professional.get(appt.professional_id);
    if (!pro) return Response.json({ success: false, error: 'Professional not found' }, { status: 404 });

    const price = Number(appt.price) || 0;
    const type = pro.commission_type || 'percent';
    const value = Number(pro.commission_value) || 0;

    let amount = 0;
    if (type === 'percent') amount = +(price * value / 100).toFixed(2);
    else amount = value;

    const commission = await base44.entities.Commission.create({
      company_id: appt.company_id,
      professional_id: pro.id,
      professional_name: pro.name,
      appointment_id: appt.id,
      service_name: appt.service_name,
      service_price: price,
      commission_type: type,
      commission_value: value,
      amount,
      earned_at: appt.completed_at || new Date().toISOString(),
      status: 'pendente',
    });

    console.log('JOB END: registerCommission', { commission_id: commission.id, amount });
    return Response.json({ success: true, commission_id: commission.id, amount });
  } catch (error) {
    console.error('JOB ERROR: registerCommission:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});