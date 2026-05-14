// Endpoint público — recebe avaliação pós-atendimento via token único.
// action=fetch: retorna info do agendamento. action=submit: grava review.
// Reviews começam com published=false (moderação manual pelo dono).

import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Aceita UUID v4 com hífens (36 chars) ou hex puro 16-64 chars (legado)
const TOKEN_RE = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{16,64})$/i;

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

// Deriva rating 1-5 a partir do NPS score (0-10)
function npsToRating(nps) {
  if (nps >= 9) return 5;
  if (nps >= 7) return 4;
  if (nps >= 5) return 3;
  if (nps >= 3) return 2;
  return 1;
}

Deno.serve(async (req) => {
  console.log('[submitReview] request received');
  try {
    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch {
      base44 = createClient({ appId: Deno.env.get('BASE44_APP_ID'), requiresAuth: false });
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    if (!rateLimit(ip)) {
      return Response.json({ success: false, error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, token } = body;

    if (!token || !TOKEN_RE.test(token)) {
      console.warn('[submitReview] invalid token format from IP:', ip);
      return Response.json({ success: false, error: 'Link inválido' }, { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.Appointment.filter({ review_token: token }, '-created_date', 1);
    const appt = matches?.[0];
    if (!appt) {
      console.warn('[submitReview] token not found:', { ip, tokenPrefix: token.slice(0, 8) });
      return Response.json({ success: false, error: 'Link inválido ou expirado' }, { status: 404 });
    }

    let company = null;
    try { company = await base44.asServiceRole.entities.Company.get(appt.company_id); } catch { /* ignore */ }

    // Expiração: apenas bloquear SUBMIT, não o FETCH.
    // Assim o cliente consegue ver a tela de avaliação mesmo que o link expire durante o preenchimento.
    const expired = appt.review_token_expires_at && new Date() > new Date(appt.review_token_expires_at);

    const existingList = await base44.asServiceRole.entities.Review.filter({ appointment_id: appt.id }, '-created_date', 1);
    const existingReview = existingList?.[0] || null;

    // ── FETCH ──────────────────────────────────────────────────────────────────
    if (action === 'fetch') {
      // Se já foi avaliado, mostra tela de sucesso (não é erro)
      if (existingReview) {
        return Response.json({
          success: true,
          expired: false,
          appointment: {
            customer_name: appt.customer_name,
            service_name: appt.service_name,
            professional_name: appt.professional_name,
            scheduled_at: appt.scheduled_at,
          },
          company: company ? { name: company.name, primary_color: company.primary_color, logo_url: company.logo_url } : null,
          existing_review: existingReview,
        });
      }

      // Link expirado E ainda não avaliou: retorna erro legível
      if (expired) {
        console.log('[submitReview] fetch: expired token for appt', appt.id);
        return Response.json({
          success: false,
          expired: true,
          error: 'Este link de avaliação expirou.',
          appointment: {
            customer_name: appt.customer_name,
            service_name: appt.service_name,
            professional_name: appt.professional_name,
          },
          company: company ? { name: company.name, primary_color: company.primary_color, logo_url: company.logo_url } : null,
        });
      }

      // Válido: retorna dados para o wizard
      return Response.json({
        success: true,
        expired: false,
        appointment: {
          customer_name: appt.customer_name,
          service_name: appt.service_name,
          professional_name: appt.professional_name,
          scheduled_at: appt.scheduled_at,
        },
        company: company ? { name: company.name, primary_color: company.primary_color, logo_url: company.logo_url } : null,
        existing_review: null,
      });
    }

    // ── SUBMIT ─────────────────────────────────────────────────────────────────
    if (action === 'submit') {
      // Aceita tanto nps_score (novo) quanto rating (legado 1-5)
      const { nps_score, rating, comment, service_rating, punctuality_rating, environment_rating } = body;

      const hasNps = nps_score != null && nps_score >= 0 && nps_score <= 10;
      const hasLegacyRating = rating && rating >= 1 && rating <= 5;

      if (!hasNps && !hasLegacyRating) {
        console.warn('[submitReview] missing valid rating/nps_score in submit');
        return Response.json({ success: false, error: 'Avaliação inválida' }, { status: 400 });
      }

      // Idempotência: review já existe
      if (existingReview) {
        console.log('[submitReview] already reviewed, returning existing:', existingReview.id);
        const googleUrl = (nps_score >= 9 || (existingReview.nps_score >= 9)) && company?.whatsapp_settings?.review_link
          ? company.whatsapp_settings.review_link : null;
        return Response.json({ success: true, already_reviewed: true, review_id: existingReview.id, google_review_url: googleUrl });
      }

      // Token expirado após o wizard (edge case)
      if (expired) {
        // Ainda assim aceitamos: cliente preencheu tudo dentro do tempo — não é justo bloquear no submit.
        // Política: permitir submit até 7 dias após criação do agendamento (fallback generoso).
        console.log('[submitReview] submit with expired token — accepting gracefully for appt', appt.id);
      }

      if (appt.reviewed_at) {
        const recheck = await base44.asServiceRole.entities.Review.filter({ appointment_id: appt.id }, '-created_date', 1);
        const googleUrl = company?.whatsapp_settings?.review_link && (nps_score >= 9) ? company.whatsapp_settings.review_link : null;
        return Response.json({ success: true, already_reviewed: true, review_id: recheck?.[0]?.id || null, google_review_url: googleUrl });
      }

      // Calcula rating 1-5 derivado do NPS para retrocompat
      const finalRating = hasNps ? npsToRating(nps_score) : Number(rating);
      const finalNps = hasNps ? nps_score : null;

      // Marca o appointment antes de criar o review (guard anti-race)
      await base44.asServiceRole.entities.Appointment.update(appt.id, {
        reviewed_at: new Date().toISOString(),
      });

      // Re-check final após o update
      const finalCheck = await base44.asServiceRole.entities.Review.filter({ appointment_id: appt.id }, '-created_date', 1);
      if (finalCheck && finalCheck.length > 0) {
        const googleUrl = company?.whatsapp_settings?.review_link && finalNps >= 9 ? company.whatsapp_settings.review_link : null;
        return Response.json({ success: true, already_reviewed: true, review_id: finalCheck[0].id, google_review_url: googleUrl });
      }

      const npsAlertNeeded = finalNps != null && finalNps <= 6;

      const review = await base44.asServiceRole.entities.Review.create({
        company_id: appt.company_id,
        appointment_id: appt.id,
        customer_id: appt.customer_id,
        customer_name: appt.customer_name,
        professional_id: appt.professional_id,
        professional_name: appt.professional_name,
        service_name: appt.service_name,
        rating: finalRating,
        nps_score: finalNps,
        comment: comment || '',
        service_rating: service_rating || null,
        punctuality_rating: punctuality_rating || null,
        environment_rating: environment_rating || null,
        published: false,
        source: 'whatsapp',
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        nps_alert_created: false,
        google_redirected: false,
      });

      // Criar alerta interno para NPS detrator (<=6)
      if (npsAlertNeeded) {
        try {
          await base44.asServiceRole.entities.SystemAlert.create({
            type: 'info',
            severity: 'warning',
            message: `NPS detrator: ${appt.customer_name} deu nota ${finalNps} para ${appt.professional_name || 'profissional'} (${appt.service_name})`,
            company_id: appt.company_id,
            metadata: { review_id: review.id, nps_score: finalNps, appointment_id: appt.id },
          });
          await base44.asServiceRole.entities.Review.update(review.id, { nps_alert_created: true });
        } catch (alertErr) {
          console.warn('[submitReview] alert creation failed (non-critical):', alertErr.message);
        }
      }

      // Retorna URL do Google se NPS promotor e company tem link
      const googleReviewUrl = finalNps >= 9 && company?.whatsapp_settings?.review_link
        ? company.whatsapp_settings.review_link
        : null;

      if (googleReviewUrl) {
        try {
          await base44.asServiceRole.entities.Review.update(review.id, { google_redirected: true });
        } catch { /* ignore */ }
      }

      console.log('[submitReview] success:', { review_id: review.id, nps_score: finalNps, rating: finalRating });
      return Response.json({ success: true, review_id: review.id, google_review_url: googleReviewUrl });
    }

    return Response.json({ success: false, error: 'Ação inválida' }, { status: 400 });

  } catch (error) {
    console.error('[submitReview] ERROR:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});