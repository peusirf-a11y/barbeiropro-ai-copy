// BFF — Mutations de Appointment (create/update/delete) com tenant + role
// + conflict check + token generation no servidor.
//
// Por que existe (BFF Fase 3):
//  - Antes: AppAgenda chamava base44.entities.Appointment.create/update/delete
//    direto. Frontend gerava tokens, decidia company_id/unit_id, e podia setar
//    QUALQUER campo (paid_online, payment_intent_id, commission_created, etc.).
//  - Agora: tudo decidido no servidor. Frontend só manda dados de UI.
//
// Payload:
//   { action: 'create' | 'update' | 'delete',
//     id?: string,                // obrigatório para update/delete
//     data?: object,              // payload aceito (campos editáveis)
//     active_unit_id?: string     // unidade selecionada na UI (multi-unit)
//   }
//
// Regras críticas de segurança:
//   - company_id SEMPRE derivado do caller (nunca aceito do payload)
//   - role=barbeiro NÃO pode criar nem deletar; só pode atualizar próprios appts
//   - allow-list rígida: campos sensíveis bloqueados
//       * paid_online, payment_intent_id, payment_status,
//         payment_expires_at, payment_idempotency_key, payer_tax_id
//         (gerenciados só por Stripe webhook + createBookingPaymentIntent)
//       * subscription_id, commission_created
//         (gerenciados só por consumeSubscriptionUse / registerCommission)
//       * confirm_token, review_token e seus expires_at
//         (gerados aqui no servidor — não aceitos do payload)
//   - Conflict + block check feitos NOVAMENTE no servidor (espelha lib/scheduling)
//   - source forçado para 'interno' (criados pelo painel)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

class AuthzError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

async function getCallerContext(base44, user) {
  if (!user?.email) throw new AuthzError('UNAUTHORIZED', 401);
  const sdk = base44.asServiceRole;

  if (user.is_super_admin) throw new AuthzError('USE_MASTER_PANEL', 403);

  const ownerHits = await sdk.entities.Company.filter({ owner_email: user.email }, '-created_date', 1);
  if (ownerHits?.length) {
    return { role: 'admin', company_id: ownerHits[0].id, company: ownerHits[0], email: user.email };
  }

  const tmHits = await sdk.entities.TeamMember.filter({ email: user.email }, '-created_date', 1);
  const tm = tmHits?.[0];
  if (!tm) throw new AuthzError('NO_TEAM_MEMBER', 403);
  if (tm.active === false) throw new AuthzError('USER_INACTIVE', 403);

  const company = await sdk.entities.Company.get(tm.company_id).catch(() => null);
  if (!company) throw new AuthzError('COMPANY_NOT_FOUND', 404);

  return {
    role: tm.role,
    company_id: tm.company_id,
    company,
    email: user.email,
    professional_id: tm.professional_id || null,
  };
}

// Campos que o frontend pode setar/alterar livremente.
// Tudo fora dessa lista é descartado em create/update.
const EDITABLE_FIELDS = new Set([
  'customer_id', 'customer_name', 'customer_phone', 'customer_email',
  'professional_id', 'professional_name',
  'service_id', 'service_name',
  'scheduled_at',
  'status',
  'notes',
  'price',
  'custom_duration_minutes',
  'paid', 'paid_at',     // marcação presencial (não confundir com paid_online)
  'completed_at',
]);

const VALID_STATUS = new Set([
  'aguardando_pagamento', 'agendado', 'confirmado',
  'em_atendimento', 'concluido', 'cancelado', 'faltou',
]);

function sanitizePayload(data) {
  if (!data || typeof data !== 'object') return {};
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    if (!EDITABLE_FIELDS.has(k)) continue;
    if (k === 'status' && !VALID_STATUS.has(v)) continue;
    if (typeof v === 'string') clean[k] = v.trim().slice(0, 500);
    else clean[k] = v;
  }
  return clean;
}

function notFound() {
  return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
}

// ── Conflict check (mirror de lib/scheduling.js mas com dados do servidor) ──
function appointmentConflict({ professionalId, dateTime, durationMin, appointments, excludeId = null }) {
  if (!professionalId || !dateTime) return false;
  const start = new Date(dateTime);
  const end = new Date(start.getTime() + (durationMin || 30) * 60000);
  return appointments.some(a => {
    if (a.id === excludeId) return false;
    if (a.professional_id !== professionalId) return false;
    if (['cancelado', 'faltou'].includes(a.status)) return false;
    const aStart = new Date(a.scheduled_at);
    const aDur = a.custom_duration_minutes || a.__duration || 30;
    const aEnd = new Date(aStart.getTime() + aDur * 60000);
    return start < aEnd && end > aStart;
  });
}

function blockedConflict({ professionalId, dateTime, durationMin, blocks }) {
  if (!dateTime) return false;
  const start = new Date(dateTime);
  const end = new Date(start.getTime() + (durationMin || 30) * 60000);
  return blocks.some(b => {
    if (b.professional_id && b.professional_id !== professionalId) return false;
    if (b.recurring) {
      if (typeof b.weekday !== 'number' || !b.time_start || !b.time_end) return false;
      if (start.getDay() !== b.weekday) return false;
      const [sh, sm] = String(b.time_start).split(':').map(Number);
      const [eh, em] = String(b.time_end).split(':').map(Number);
      const bStart = new Date(start); bStart.setHours(sh || 0, sm || 0, 0, 0);
      const bEnd = new Date(start);   bEnd.setHours(eh || 0, em || 0, 0, 0);
      return start < bEnd && end > bStart;
    }
    if (!b.start_time || !b.end_time) return false;
    const bStart = new Date(b.start_time);
    const bEnd = new Date(b.end_time);
    return start < bEnd && end > bStart;
  });
}

// Gera token UUID v4 via Web Crypto (mesmo padrão do createPublicAppointment)
function generateToken() {
  return crypto.randomUUID();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const caller = await getCallerContext(base44, user);
    const sdk = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { action, id, data, active_unit_id } = body || {};

    if (!['create', 'update', 'delete'].includes(action)) {
      return Response.json({ error: 'INVALID_ACTION' }, { status: 400 });
    }

    // ─── CREATE ──────────────────────────────────────────────────────
    if (action === 'create') {
      if (caller.role === 'barbeiro') {
        return Response.json({ error: 'FORBIDDEN_ROLE' }, { status: 403 });
      }
      const clean = sanitizePayload(data);
      if (!clean.professional_id || !clean.service_id || !clean.scheduled_at) {
        return Response.json({ error: 'MISSING_FIELDS' }, { status: 400 });
      }

      // Carrega service/professional reais para validar tenant + duração
      const [service, professional] = await Promise.all([
        sdk.entities.Service.get(clean.service_id).catch(() => null),
        sdk.entities.Professional.get(clean.professional_id).catch(() => null),
      ]);
      if (!service || service.company_id !== caller.company_id) {
        return Response.json({ error: 'INVALID_SERVICE' }, { status: 400 });
      }
      if (!professional || professional.company_id !== caller.company_id) {
        return Response.json({ error: 'INVALID_PROFESSIONAL' }, { status: 400 });
      }

      // Conflict + block check com dados do servidor
      const durationMin = clean.custom_duration_minutes || service.duration_minutes || 30;
      const [appts, blocks] = await Promise.all([
        sdk.entities.Appointment.filter(
          { company_id: caller.company_id, professional_id: clean.professional_id },
          '-scheduled_at', 200
        ),
        sdk.entities.BlockedTime.filter({ company_id: caller.company_id }, '-start_time', 200),
      ]);

      if (appointmentConflict({
        professionalId: clean.professional_id,
        dateTime: clean.scheduled_at,
        durationMin,
        appointments: appts,
      })) {
        return Response.json({ error: 'SLOT_CONFLICT' }, { status: 409 });
      }
      if (blockedConflict({
        professionalId: clean.professional_id,
        dateTime: clean.scheduled_at,
        durationMin,
        blocks,
      })) {
        return Response.json({ error: 'SLOT_BLOCKED' }, { status: 409 });
      }

      // Tokens + expiries gerados no servidor — payload do front é ignorado
      const scheduledAt = new Date(clean.scheduled_at);
      const confirmExpires = new Date(scheduledAt.getTime() - 0); // até o horário do appt
      const reviewExpires = new Date(scheduledAt.getTime() + 14 * 24 * 60 * 60 * 1000); // +14d

      const appointment = await sdk.entities.Appointment.create({
        ...clean,
        company_id: caller.company_id,
        unit_id: active_unit_id || professional.unit_ids?.[0] || undefined,
        // Snapshot dos nomes — não confiamos no que vem do front
        service_name: service.name,
        professional_name: professional.name,
        price: service.price ?? clean.price ?? 0,
        source: 'interno',
        status: clean.status || 'agendado',
        confirm_token: generateToken(),
        review_token: generateToken(),
        confirm_token_expires_at: confirmExpires.toISOString(),
        review_token_expires_at: reviewExpires.toISOString(),
      });

      return Response.json({ appointment });
    }

    // ─── UPDATE ──────────────────────────────────────────────────────
    if (action === 'update') {
      if (!id) return Response.json({ error: 'ID_REQUIRED' }, { status: 400 });

      let existing;
      try { existing = await sdk.entities.Appointment.get(id); }
      catch { return notFound(); }
      if (!existing) return notFound();
      if (existing.company_id !== caller.company_id) return notFound();

      // Barbeiro só altera seus próprios atendimentos
      if (caller.role === 'barbeiro' && existing.professional_id !== caller.professional_id) {
        return notFound();
      }

      const clean = sanitizePayload(data);

      // Auto-stamp completed_at quando status vira concluido
      if (clean.status === 'concluido' && !clean.completed_at && !existing.completed_at) {
        clean.completed_at = new Date().toISOString();
      }

      // Se o user mexeu em horário ou profissional, revalida conflito
      const newScheduledAt = clean.scheduled_at || existing.scheduled_at;
      const newProId = clean.professional_id || existing.professional_id;
      const needsConflictCheck =
        clean.scheduled_at !== undefined ||
        clean.professional_id !== undefined ||
        clean.custom_duration_minutes !== undefined ||
        clean.service_id !== undefined;

      if (needsConflictCheck && !['cancelado', 'faltou'].includes(clean.status || existing.status)) {
        const serviceId = clean.service_id || existing.service_id;
        const service = serviceId
          ? await sdk.entities.Service.get(serviceId).catch(() => null)
          : null;
        const durationMin =
          clean.custom_duration_minutes ||
          existing.custom_duration_minutes ||
          service?.duration_minutes || 30;

        const [appts, blocks] = await Promise.all([
          sdk.entities.Appointment.filter(
            { company_id: caller.company_id, professional_id: newProId },
            '-scheduled_at', 200
          ),
          sdk.entities.BlockedTime.filter({ company_id: caller.company_id }, '-start_time', 200),
        ]);

        if (appointmentConflict({
          professionalId: newProId,
          dateTime: newScheduledAt,
          durationMin,
          appointments: appts,
          excludeId: id,
        })) {
          return Response.json({ error: 'SLOT_CONFLICT' }, { status: 409 });
        }
        if (blockedConflict({
          professionalId: newProId,
          dateTime: newScheduledAt,
          durationMin,
          blocks,
        })) {
          return Response.json({ error: 'SLOT_BLOCKED' }, { status: 409 });
        }
      }

      // Bloqueia mexer em paid quando o appointment é paid_online (Stripe)
      if ('paid' in clean && existing.paid_online) {
        delete clean.paid;
        delete clean.paid_at;
      }

      const appointment = await sdk.entities.Appointment.update(id, clean);
      return Response.json({ appointment });
    }

    // ─── DELETE ──────────────────────────────────────────────────────
    if (action === 'delete') {
      if (!id) return Response.json({ error: 'ID_REQUIRED' }, { status: 400 });
      if (caller.role === 'barbeiro') {
        return Response.json({ error: 'FORBIDDEN_ROLE' }, { status: 403 });
      }

      let existing;
      try { existing = await sdk.entities.Appointment.get(id); }
      catch { return notFound(); }
      if (!existing) return notFound();
      if (existing.company_id !== caller.company_id) return notFound();

      await sdk.entities.Appointment.delete(id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'INVALID_ACTION' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    console.error('[mutateAppointment] error:', error.message, error.stack);
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});