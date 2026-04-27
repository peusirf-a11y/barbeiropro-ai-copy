// Estorna comissão quando um appointment já concluído é alterado para
// "cancelado" ou "faltou". Disparado pela automação `onAppointmentReversed`.
// Idempotente: se a Commission já foi removida, retorna sucesso silenciosamente.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: reverseCommission');
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Aceita tanto chamada manual { appointment_id } quanto payload de automação
    // de entidade { event: { entity_id }, data, old_data }.
    const appointmentId = body.appointment_id || body?.event?.entity_id;
    if (!appointmentId) {
      return Response.json({ success: false, error: 'appointment_id required' }, { status: 400 });
    }

    const appt = await base44.asServiceRole.entities.Appointment.get(appointmentId);
    if (!appt) {
      return Response.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    // Só estorna se status atual é cancelado/faltou
    if (!['cancelado', 'faltou'].includes(appt.status)) {
      console.log('Skipped: status is not cancelado/faltou', { status: appt.status });
      return Response.json({ success: true, skipped: true, reason: 'invalid_status' });
    }

    // Busca comissão associada (idempotente: pode não existir se nunca foi concluído)
    const commissions = await base44.asServiceRole.entities.Commission.filter({ appointment_id: appointmentId }, '-created_date', 5);
    if (!commissions || commissions.length === 0) {
      console.log('No commission to reverse');
      // Garante que o flag fica em false para permitir registro futuro se reabrirem
      if (appt.commission_created) {
        await base44.asServiceRole.entities.Appointment.update(appointmentId, { commission_created: false });
      }
      return Response.json({ success: true, skipped: true, reason: 'no_commission' });
    }

    // Bloqueia estorno se já foi paga ao profissional (evita inconsistência financeira)
    const paid = commissions.find(c => c.status === 'pago');
    if (paid) {
      console.warn('Commission already paid, cannot reverse', { commission_id: paid.id });
      return Response.json({ success: false, error: 'Comissão já paga ao profissional. Estorne manualmente.', commission_id: paid.id }, { status: 409 });
    }

    // Deleta todas as comissões pendentes vinculadas
    const deletedIds = [];
    for (const c of commissions) {
      await base44.asServiceRole.entities.Commission.delete(c.id);
      deletedIds.push(c.id);
    }

    // Reseta o flag para manter consistência (caso o dono reabra o appointment)
    await base44.asServiceRole.entities.Appointment.update(appointmentId, {
      commission_created: false,
      completed_at: null,
    });

    console.log('JOB END: reverseCommission', { reversed: deletedIds.length, ids: deletedIds });
    return Response.json({ success: true, reversed: deletedIds.length, commission_ids: deletedIds });
  } catch (error) {
    console.error('JOB ERROR: reverseCommission:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});