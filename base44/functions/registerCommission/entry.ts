// Calcula e registra a comissão de um profissional ao concluir um atendimento.
// IDEMPOTENTE TRIPLO:
//   1) flag commission_created no Appointment (rápido)
//   2) busca em Commission por appointment_id (defensivo)
//   3) marca commission_created=true após criar
// Pode ser chamado pelo frontend OU pela automação de entidade (status=concluido).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: registerCommission');
  try {
    const base44 = createClientFromRequest(req);

    // Aceita payload direto (frontend) OU payload de automação de entidade
    const body = await req.json().catch(() => ({}));
    const appointment_id = body.appointment_id
      || body?.event?.entity_id
      || body?.data?.id;

    if (!appointment_id) {
      return Response.json({ success: false, error: 'appointment_id required' }, { status: 400 });
    }

    // Service role: o gatilho não tem usuário logado
    const sdk = base44.asServiceRole;

    const appt = await sdk.entities.Appointment.get(appointment_id);
    if (!appt) {
      return Response.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    // Só processa se concluído
    if (appt.status !== 'concluido') {
      console.log('Skipped: appointment not concluded', { status: appt.status });
      return Response.json({ success: true, skipped: true, reason: 'not_concluded' });
    }

    // 1) Flag idempotente
    if (appt.commission_created) {
      console.log('Skipped: commission_created flag already true');
      return Response.json({ success: true, skipped: true, reason: 'flag_set' });
    }

    // 2) Defesa extra: já existe Commission para esse appointment_id?
    const existing = await sdk.entities.Commission.filter({ appointment_id });
    if (existing && existing.length > 0) {
      // Marca a flag para não cair aqui de novo
      await sdk.entities.Appointment.update(appointment_id, { commission_created: true });
      console.log('Skipped: existing commission found, flag synced');
      return Response.json({ success: true, skipped: true, commission_id: existing[0].id });
    }

    const pro = await sdk.entities.Professional.get(appt.professional_id);
    if (!pro) return Response.json({ success: false, error: 'Professional not found' }, { status: 404 });

    const price = Number(appt.price) || 0;
    const type = pro.commission_type || 'percent';
    const value = Number(pro.commission_value) || 0;

    let amount = 0;
    if (type === 'percent') amount = +(price * value / 100).toFixed(2);
    else amount = value;

    const commission = await sdk.entities.Commission.create({
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

    // 3) Marca flag para garantir idempotência mesmo em chamadas concorrentes
    await sdk.entities.Appointment.update(appointment_id, { commission_created: true });

    console.log('JOB END: registerCommission', { commission_id: commission.id, amount });
    return Response.json({ success: true, commission_id: commission.id, amount });
  } catch (error) {
    console.error('JOB ERROR: registerCommission:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});