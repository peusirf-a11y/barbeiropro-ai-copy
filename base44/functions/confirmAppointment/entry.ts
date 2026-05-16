// Endpoint público — confirma um agendamento via token único.
// HARDENED v2:
//  - Rate limit persistente no banco por IP (não em memória)
//  - SecurityEvent registrado em abuso
//  - Resposta genérica anti-enumeração
//  - Sem stack trace público

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TOKEN_RE = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{16,64})$/i;

// Rate limit persistente inline — espelha lib/security/persistentRateLimit.js
async function checkRateLimitPersistent(sdk, ip) {
  const key = `confirmAppointment:${ip}`;
  const now = new Date();
  const windowMs = 5 * 60 * 1000; // 5 min
  const limit = 10;

  const existing = await sdk.entities.SecurityRateLimit.filter({ key }, '-created_date', 1).catch(() => []);
  const record = existing?.[0];

  if (record?.is_blocked && record?.blocked_until && new Date(record.blocked_until) > now) {
    return { allowed: false, blocked_until: record.blocked_until };
  }

  if (record && record.window_end && new Date(record.window_end) > now) {
    const newAttempts = (record.attempts || 0) + 1;
    if (newAttempts >= limit) {
      const blocked_until = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // 30 min
      await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts, is_blocked: true, blocked_until }).catch(() => {});
      return { allowed: false, blocked_until };
    }
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts }).catch(() => {});
    return { allowed: true };
  }

  const window_start = now.toISOString();
  const window_end = new Date(now.getTime() + windowMs).toISOString();
  if (record) {
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: 1, window_start, window_end, is_blocked: false, blocked_until: null }).catch(() => {});
  } else {
    await sdk.entities.SecurityRateLimit.create({ key, route: 'confirmAppointment', ip, identifier: ip, attempts: 1, window_start, window_end, is_blocked: false }).catch(() => {});
  }
  return { allowed: true };
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const rl = await checkRateLimitPersistent(sdk, ip);
    if (!rl.allowed) {
      console.warn(`[confirmAppointment] rid=${rid} RATE_LIMITED ip=${ip}`);
      await sdk.entities.SecurityEvent.create({
        event_type: 'rate_limit_exceeded', severity: 'medium',
        ip_address: ip, route: 'confirmAppointment',
        details: { blocked_until: rl.blocked_until, request_id: rid },
        blocked: true, request_id: rid,
      }).catch(() => {});
      return Response.json({ success: false, error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 });
    }

    const { token } = await req.json().catch(() => ({}));
    if (!token || !TOKEN_RE.test(token)) {
      console.warn(`[confirmAppointment] rid=${rid} invalid token format ip=${ip}`);
      // Anti-enumeração: mesmo erro para token inválido e não encontrado
      return Response.json({ success: false, error: 'Link inválido ou expirado.' }, { status: 404 });
    }

    const matches = await sdk.entities.Appointment.filter({ confirm_token: token }, '-created_date', 1);
    const appt = matches?.[0];
    if (!appt) {
      console.warn(`[confirmAppointment] rid=${rid} token not found prefix=${token.slice(0, 6)}`);
      return Response.json({ success: false, error: 'Link inválido ou expirado.' }, { status: 404 });
    }

    let company = null;
    try { company = await sdk.entities.Company.get(appt.company_id); } catch { /* ignore */ }
    const companyOut = company ? { name: company.name, primary_color: company.primary_color, address: company.address } : null;

    if (appt.confirm_token_expires_at && new Date() > new Date(appt.confirm_token_expires_at)) {
      return Response.json({
        success: false, expired: true,
        appointment: { customer_name: appt.customer_name, scheduled_at: appt.scheduled_at, service_name: appt.service_name },
        company: companyOut,
        error: 'Este link de confirmação expirou.',
      });
    }

    if (['cancelado', 'concluido', 'faltou'].includes(appt.status)) {
      return Response.json({
        success: false, already_final: true, status: appt.status,
        appointment: { customer_name: appt.customer_name, scheduled_at: appt.scheduled_at, service_name: appt.service_name },
        company: companyOut,
        error: 'Este agendamento não pode mais ser confirmado.',
      });
    }

    if (appt.status === 'confirmado') {
      return Response.json({
        success: true, already_confirmed: true,
        appointment: { customer_name: appt.customer_name, scheduled_at: appt.scheduled_at, service_name: appt.service_name, professional_name: appt.professional_name },
        company: companyOut,
      });
    }

    await sdk.entities.Appointment.update(appt.id, {
      status: 'confirmado',
      confirmed_at: new Date().toISOString(),
    });

    console.log(`[confirmAppointment] rid=${rid} confirmed appointment=${appt.id}`);
    return Response.json({
      success: true,
      appointment: { customer_name: appt.customer_name, scheduled_at: appt.scheduled_at, service_name: appt.service_name, professional_name: appt.professional_name },
      company: companyOut,
    });

  } catch (error) {
    console.error(`[confirmAppointment] rid=${rid} INTERNAL_ERROR:`, error?.message);
    // Nunca expor error.message ao caller externo
    return Response.json({ success: false, error: 'INTERNAL_ERROR', request_id: rid }, { status: 500 });
  }
});