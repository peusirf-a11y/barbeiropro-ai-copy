// Endpoint público — recebe avaliação pós-atendimento via token único.
// action=fetch: retorna info do agendamento. action=submit: grava review.
// Reviews começam com published=false (moderação manual pelo dono).
// Rate-limit em memória por IP + validação de formato + expiração.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TOKEN_RE = /^[a-f0-9]{16,64}$/i;

const ipBucket = new Map();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_HITS = 15;

function rateLimit(ip) {
  const now = Date.now();
  const entry = ipBucket.get(ip) || { hits: 0, reset: now + WINDOW_MS };
  if (now > entry.reset) { entry.hits = 0; entry.reset = now + WINDOW_MS; }
  entry.hits += 1;
  ipBucket.set(ip, entry);
  return entry.hits <= MAX_HITS;
}

Deno.serve(async (req) => {
  console.log('JOB START: submitReview');
  try {
    const base44 = createClientFromRequest(req);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    if (!rateLimit(ip)) {
      return Response.json({ success: false, error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, token, rating, comment } = body;

    if (!token || !TOKEN_RE.test(token)) {
      console.warn('Invalid token format from IP:', ip);
      return Response.json({ success: false, error: 'Link inválido' }, { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.Appointment.filter({ review_token: token }, '-created_date', 1);
    const appt = matches?.[0];
    if (!appt) {
      console.warn('Review token not found:', { ip, tokenPrefix: token.slice(0, 6) });
      return Response.json({ success: false, error: 'Link inválido ou expirado' }, { status: 404 });
    }

    let company = null;
    try { company = await base44.asServiceRole.entities.Company.get(appt.company_id); } catch { /* ignore */ }

    // Expiração do review token
    const expired = appt.review_token_expires_at && new Date() > new Date(appt.review_token_expires_at);

    const existing = await base44.asServiceRole.entities.Review.filter({ appointment_id: appt.id }, '-created_date', 1);

    if (action === 'fetch') {
      return Response.json({
        success: !expired,
        expired,
        appointment: {
          customer_name: appt.customer_name,
          service_name: appt.service_name,
          professional_name: appt.professional_name,
          scheduled_at: appt.scheduled_at,
        },
        company: company ? { name: company.name, primary_color: company.primary_color, logo_url: company.logo_url } : null,
        existing_review: existing?.[0] || null,
        error: expired ? 'Este link de avaliação expirou.' : undefined,
      });
    }

    // SUBMIT
    if (expired) {
      return Response.json({ success: false, expired: true, error: 'Link de avaliação expirado' }, { status: 410 });
    }
    if (!rating || rating < 1 || rating > 5) {
      return Response.json({ success: false, error: 'Avaliação inválida (1 a 5 estrelas)' }, { status: 400 });
    }

    // Guard idempotente DUPLO contra race condition:
    // 1) Review já existe na tabela
    // 2) Appointment já tem reviewed_at setado (escrita atômica antes do create)
    if (existing && existing.length > 0) {
      return Response.json({ success: true, already_reviewed: true, review_id: existing[0].id });
    }
    if (appt.reviewed_at) {
      // Re-checa a tabela (pode ter sido criada por chamada concorrente)
      const recheck = await base44.asServiceRole.entities.Review.filter({ appointment_id: appt.id }, '-created_date', 1);
      return Response.json({ success: true, already_reviewed: true, review_id: recheck?.[0]?.id || null });
    }

    // Marca o appointment ANTES de criar o review — se 2 requests passarem na checagem
    // acima ao mesmo tempo, a 2ª vai falhar/sobrescrever, mas só 1 review será criado
    // pois re-checamos `existing` logo após o update.
    await base44.asServiceRole.entities.Appointment.update(appt.id, {
      reviewed_at: new Date().toISOString(),
    });

    // Re-check final após o update — se houve race, retorna o review existente
    const finalCheck = await base44.asServiceRole.entities.Review.filter({ appointment_id: appt.id }, '-created_date', 1);
    if (finalCheck && finalCheck.length > 0) {
      return Response.json({ success: true, already_reviewed: true, review_id: finalCheck[0].id });
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
      published: false, // Moderação: dono aprova antes de publicar
    });

    console.log('JOB END: submitReview', { review_id: review.id, rating });
    return Response.json({ success: true, review_id: review.id });
  } catch (error) {
    console.error('JOB ERROR: submitReview:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});