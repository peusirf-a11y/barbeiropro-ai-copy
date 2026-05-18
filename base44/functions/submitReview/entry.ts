// Endpoint público — recebe avaliação pós-atendimento via token único.
// HARDENED v2:
//  - Rate limit persistente no banco (não em memória)
//  - SecurityEvent em abuso de token
//  - Resposta genérica anti-enumeração
//  - Sem stack trace público

import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TOKEN_RE = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{16,64})$/i;

// Rate limit persistente inline
async function checkRateLimitPersistent(sdk, ip) {
  const key = `submitReview:${ip}`;
  const now = new Date();
  const windowMs = 5 * 60 * 1000;
  const limit = 15;

  const existing = await sdk.entities.SecurityRateLimit.filter({ key }, '-created_date', 1).catch(() => []);
  const record = existing?.[0];

  if (record?.is_blocked && record?.blocked_until && new Date(record.blocked_until) > now) {
    return { allowed: false };
  }

  if (record && record.window_end && new Date(record.window_end) > now) {
    const newAttempts = (record.attempts || 0) + 1;
    if (newAttempts >= limit) {
      const blocked_until = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
      await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts, is_blocked: true, blocked_until }).catch(() => {});
      return { allowed: false };
    }
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts }).catch(() => {});
    return { allowed: true };
  }

  const window_start = now.toISOString();
  const window_end = new Date(now.getTime() + windowMs).toISOString();
  if (record) {
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: 1, window_start, window_end, is_blocked: false, blocked_until: null }).catch(() => {});
  } else {
    await sdk.entities.SecurityRateLimit.create({ key, route: 'submitReview', ip, identifier: ip, attempts: 1, window_start, window_end, is_blocked: false }).catch(() => {});
  }
  return { allowed: true };
}

function npsToRating(nps) {
  if (nps >= 9) return 5;
  if (nps >= 7) return 4;
  if (nps >= 5) return 3;
  if (nps >= 3) return 2;
  return 1;
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch {
      base44 = createClient({ appId: Deno.env.get('BASE44_APP_ID'), requiresAuth: false });
    }
    const sdk = base44.asServiceRole;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const rl = await checkRateLimitPersistent(sdk, ip);
    if (!rl.allowed) {
      console.warn(`[submitReview] rid=${rid} RATE_LIMITED ip=${ip}`);
      return Response.json({ success: false, error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, token } = body;

    if (!token || !TOKEN_RE.test(token)) {
      console.warn(`[submitReview] rid=${rid} invalid token format ip=${ip}`);
      return Response.json({ success: false, error: 'Link inválido.' }, { status: 404 });
    }

    const matches = await sdk.entities.Appointment.filter({ review_token: token }, '-created_date', 1);
    const appt = matches?.[0];
    if (!appt) {
      // ── Anti-enumeração (Fase 3) ──────────────────────────────────────────
      // Conta tentativas FALHAS separadamente. 5 fails em 15min → bloqueio + SecurityEvent.
      try {
        const failKey = `submitReview:fail:${ip}`;
        const now = new Date();
        const failWindowMs = 15 * 60 * 1000;
        const failLimit = 5;
        const existingFail = await sdk.entities.SecurityRateLimit.filter({ key: failKey }, '-created_date', 1).catch(() => []);
        const failRec = existingFail?.[0];
        if (failRec && failRec.window_end && new Date(failRec.window_end) > now) {
          const newAttempts = (failRec.attempts || 0) + 1;
          if (newAttempts >= failLimit) {
            const blocked_until = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
            await sdk.entities.SecurityRateLimit.update(failRec.id, { attempts: newAttempts, is_blocked: true, blocked_until }).catch(() => {});
            await sdk.entities.SecurityEvent.create({
              event_type: 'brute_force_attempt', severity: 'high',
              ip_address: ip, route: 'submitReview',
              details: { fail_attempts: newAttempts, request_id: rid },
              blocked: true, request_id: rid,
            }).catch(() => {});
          } else {
            await sdk.entities.SecurityRateLimit.update(failRec.id, { attempts: newAttempts }).catch(() => {});
          }
        } else {
          const window_end = new Date(now.getTime() + failWindowMs).toISOString();
          if (failRec) {
            await sdk.entities.SecurityRateLimit.update(failRec.id, { attempts: 1, window_start: now.toISOString(), window_end, is_blocked: false, blocked_until: null }).catch(() => {});
          } else {
            await sdk.entities.SecurityRateLimit.create({ key: failKey, route: 'submitReview:fail', ip, identifier: ip, attempts: 1, window_start: now.toISOString(), window_end, is_blocked: false }).catch(() => {});
          }
        }
      } catch { /* não bloquear fluxo se SecurityRateLimit falhar */ }

      console.warn(`[submitReview] rid=${rid} token not found prefix=${token.slice(0, 8)}`);
      return Response.json({ success: false, error: 'Link inválido ou expirado.' }, { status: 404 });
    }

    let company = null;
    try { company = await sdk.entities.Company.get(appt.company_id); } catch { /* ignore */ }

    const expired = appt.review_token_expires_at && new Date() > new Date(appt.review_token_expires_at);
    const existingList = await sdk.entities.Review.filter({ appointment_id: appt.id }, '-created_date', 1);
    const existingReview = existingList?.[0] || null;

    // ── FETCH ──────────────────────────────────────────────────────────────────
    if (action === 'fetch') {
      if (existingReview) {
        return Response.json({
          success: true, expired: false,
          appointment: { customer_name: appt.customer_name, service_name: appt.service_name, professional_name: appt.professional_name, scheduled_at: appt.scheduled_at },
          company: company ? { name: company.name, primary_color: company.primary_color, logo_url: company.logo_url } : null,
          existing_review: existingReview,
        });
      }
      if (expired) {
        return Response.json({
          success: false, expired: true,
          error: 'Este link de avaliação expirou.',
          appointment: { customer_name: appt.customer_name, service_name: appt.service_name, professional_name: appt.professional_name },
          company: company ? { name: company.name, primary_color: company.primary_color, logo_url: company.logo_url } : null,
        });
      }
      return Response.json({
        success: true, expired: false,
        appointment: { customer_name: appt.customer_name, service_name: appt.service_name, professional_name: appt.professional_name, scheduled_at: appt.scheduled_at },
        company: company ? { name: company.name, primary_color: company.primary_color, logo_url: company.logo_url } : null,
        existing_review: null,
      });
    }

    // ── SUBMIT ─────────────────────────────────────────────────────────────────
    if (action === 'submit') {
      const { nps_score, rating, comment, service_rating, punctuality_rating, environment_rating } = body;
      const hasNps = nps_score != null && nps_score >= 0 && nps_score <= 10;
      const hasLegacyRating = rating && rating >= 1 && rating <= 5;

      if (!hasNps && !hasLegacyRating) {
        return Response.json({ success: false, error: 'Avaliação inválida' }, { status: 400 });
      }

      if (existingReview) {
        const googleUrl = (nps_score >= 9 || (existingReview.nps_score >= 9)) && company?.whatsapp_settings?.review_link
          ? company.whatsapp_settings.review_link : null;
        return Response.json({ success: true, already_reviewed: true, review_id: existingReview.id, google_review_url: googleUrl });
      }

      if (expired) {
        console.log(`[submitReview] rid=${rid} submit with expired token — accepting gracefully for appt=${appt.id}`);
      }

      if (appt.reviewed_at) {
        const recheck = await sdk.entities.Review.filter({ appointment_id: appt.id }, '-created_date', 1);
        const googleUrl = company?.whatsapp_settings?.review_link && (nps_score >= 9) ? company.whatsapp_settings.review_link : null;
        return Response.json({ success: true, already_reviewed: true, review_id: recheck?.[0]?.id || null, google_review_url: googleUrl });
      }

      const finalRating = hasNps ? npsToRating(nps_score) : Number(rating);
      const finalNps = hasNps ? nps_score : null;

      await sdk.entities.Appointment.update(appt.id, { reviewed_at: new Date().toISOString() });

      const finalCheck = await sdk.entities.Review.filter({ appointment_id: appt.id }, '-created_date', 1);
      if (finalCheck && finalCheck.length > 0) {
        const googleUrl = company?.whatsapp_settings?.review_link && finalNps >= 9 ? company.whatsapp_settings.review_link : null;
        return Response.json({ success: true, already_reviewed: true, review_id: finalCheck[0].id, google_review_url: googleUrl });
      }

      const npsAlertNeeded = finalNps != null && finalNps <= 6;

      const review = await sdk.entities.Review.create({
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

      if (npsAlertNeeded) {
        try {
          await sdk.entities.SystemAlert.create({
            type: 'info', severity: 'warning',
            message: `NPS detrator: ${appt.customer_name} deu nota ${finalNps} para ${appt.professional_name || 'profissional'} (${appt.service_name})`,
            company_id: appt.company_id,
            metadata: { review_id: review.id, nps_score: finalNps, appointment_id: appt.id },
          });
          await sdk.entities.Review.update(review.id, { nps_alert_created: true });
        } catch (alertErr) {
          console.warn(`[submitReview] rid=${rid} alert creation failed:`, alertErr.message);
        }
      }

      const googleReviewUrl = finalNps >= 9 && company?.whatsapp_settings?.review_link ? company.whatsapp_settings.review_link : null;
      if (googleReviewUrl) {
        try { await sdk.entities.Review.update(review.id, { google_redirected: true }); } catch { /* ignore */ }
      }

      console.log(`[submitReview] rid=${rid} success review=${review.id} nps=${finalNps}`);
      return Response.json({ success: true, review_id: review.id, google_review_url: googleReviewUrl });
    }

    return Response.json({ success: false, error: 'Ação inválida' }, { status: 400 });

  } catch (error) {
    console.error(`[submitReview] rid=${rid} INTERNAL_ERROR:`, error?.message);
    // Nunca expor error.message ao caller externo
    return Response.json({ success: false, error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});