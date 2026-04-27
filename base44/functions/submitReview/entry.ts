// Endpoint público — recebe avaliação pós-atendimento via token único.
// GET (action=fetch): retorna info do agendamento. POST (action=submit): grava review.
// Não exige login. Idempotente: se já existe review pra esse appointment, retorna ela.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('JOB START: submitReview');
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action, token, rating, comment } = body;

    if (!token) {
      return Response.json({ success: false, error: 'Token obrigatório' }, { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.Appointment.filter({ review_token: token }, '-created_date', 1);
    const appt = matches?.[0];
    if (!appt) {
      return Response.json({ success: false, error: 'Link inválido ou expirado' }, { status: 404 });
    }

    let company = null;
    try { company = await base44.asServiceRole.entities.Company.get(appt.company_id); } catch { /* ignore */ }

    // Reviews já existentes
    const existing = await base44.asServiceRole.entities.Review.filter({ appointment_id: appt.id }, '-created_date', 1);

    // FETCH: retornar dados pra preencher tela
    if (action === 'fetch') {
      return Response.json({
        success: true,
        appointment: {
          customer_name: appt.customer_name,
          service_name: appt.service_name,
          professional_name: appt.professional_name,
          scheduled_at: appt.scheduled_at,
        },
        company: company ? { name: company.name, primary_color: company.primary_color, logo_url: company.logo_url } : null,
        existing_review: existing?.[0] || null,
      });
    }

    // SUBMIT
    if (!rating || rating < 1 || rating > 5) {
      return Response.json({ success: false, error: 'Avaliação inválida (1 a 5 estrelas)' }, { status: 400 });
    }

    if (existing && existing.length > 0) {
      return Response.json({ success: true, already_reviewed: true, review_id: existing[0].id });
    }

    const review = await base44.asServiceRole.entities.Review.create({
      company_id: appt.company_id,
      appointment_id: appt.id,
      customer_id: appt.customer_id,
      customer_name: appt.customer_name,
      professional_id: appt.professional_id,
      professional_name: appt.professional_name,
      service_name: appt.service_name,
      rating: Number(rating),
      comment: comment || '',
      published: true,
    });

    await base44.asServiceRole.entities.Appointment.update(appt.id, {
      reviewed_at: new Date().toISOString(),
    });

    console.log('JOB END: submitReview', { review_id: review.id, rating });
    return Response.json({ success: true, review_id: review.id });
  } catch (error) {
    console.error('JOB ERROR: submitReview:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});