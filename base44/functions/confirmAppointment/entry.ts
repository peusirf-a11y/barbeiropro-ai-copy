// Endpoint público — confirma um agendamento via token único.
// Não exige login. Idempotente. Valida expiração e formato do token.
// Rate-limit em memória por IP (best-effort, instância única).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TOKEN_RE = /^[a-f0-9]{16,64}$/i;

// Rate limit em memória: 10 tentativas / 5min por IP
const ipBucket = new Map();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_HITS = 10;

function rateLimit(ip) {
  const now = Date.now();
  const entry = ipBucket.get(ip) || { hits: 0, reset: now + WINDOW_MS };
  if (now > entry.reset) { entry.hits = 0; entry.reset = now + WINDOW_MS; }
  entry.hits += 1;
  ipBucket.set(ip, entry);
  return entry.hits <= MAX_HITS;
}

Deno.serve(async (req) => {
  console.log('JOB START: confirmAppointment');
  try {
    const base44 = createClientFromRequest(req);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    if (!rateLimit(ip)) {
      console.warn('Rate limit exceeded for IP:', ip);
      return Response.json({ success: false, error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 });
    }

    const { token } = await req.json().catch(() => ({}));
    if (!token || !TOKEN_RE.test(token)) {
      console.warn('Invalid token format from IP:', ip);
      return Response.json({ success: false, error: 'Token inválido' }, { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.Appointment.filter({ confirm_token: token }, '-created_date', 1);
    const appt = matches?.[0];
    if (!appt) {
      console.warn('Token not found:', { ip, tokenPrefix: token.slice(0, 6) });
      return Response.json({ success: false, error: 'Agendamento não encontrado ou link inválido' }, { status: 404 });
    }

    let company = null;
    try { company = await base44.asServiceRole.entities.Company.get(appt.company_id); } catch { /* ignore */ }
    const companyOut = company ? { name: company.name, primary_color: company.primary_color, address: company.address } : null;

    // Expiração
    if (appt.confirm_token_expires_at && new Date() > new Date(appt.confirm_token_expires_at)) {
      return Response.json({
        success: false,
        expired: true,
        appointment: { customer_name: appt.customer_name, scheduled_at: appt.scheduled_at, service_name: appt.service_name },
        company: companyOut,
        error: 'Este link de confirmação expirou.',
      });
    }

    // Estados finais
    if (['cancelado', 'concluido', 'faltou'].includes(appt.status)) {
      return Response.json({
        success: false,
        already_final: true,
        status: appt.status,
        appointment: { customer_name: appt.customer_name, scheduled_at: appt.scheduled_at, service_name: appt.service_name },
        company: companyOut,
        error: 'Este agendamento não pode mais ser confirmado.',
      });
    }

    // Idempotente
    if (appt.status === 'confirmado') {
      return Response.json({
        success: true,
        already_confirmed: true,
        appointment: { customer_name: appt.customer_name, scheduled_at: appt.scheduled_at, service_name: appt.service_name, professional_name: appt.professional_name },
        company: companyOut,
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
      company: companyOut,
    });
  } catch (error) {
    console.error('JOB ERROR: confirmAppointment:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});