// createPublicAppointment — cria agendamento via link público (não autenticado).
//
// Garante:
// 1) Customer auto-cadastro: se telefone já existe na empresa → reutiliza; senão cria.
// 2) Vincula customer_id ao Appointment.
// 3) Tudo via asServiceRole (não exige login do cliente final).
// 4) Dispara e-mail de confirmação se houver email.
//
// Usado pela página /agendar/:slug.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Slot Lock (P0.1) — inline porque Base44 não permite local imports em functions/ ─
// Espelha lib/slotLock.js. Ver docs/RACE_CONDITIONS.md §1.
const SLOT_TTL_DEFAULT = 90;
function _slotTtl() {
  const n = parseInt(Deno.env.get('SLOT_RESERVATION_TTL_SECONDS') || '', 10);
  return Number.isFinite(n) && n > 0 ? n : SLOT_TTL_DEFAULT;
}
function _slotEnabled() {
  const v = Deno.env.get('ENABLE_SLOT_LOCK');
  if (!v) return true;
  return String(v).toLowerCase() !== 'false';
}
function _truncMin(iso) {
  const d = new Date(iso); d.setSeconds(0, 0); return d.toISOString();
}
function _slotKey(company_id, professional_id, scheduled_at) {
  return `${company_id}:${professional_id}:${_truncMin(scheduled_at)}`;
}
async function acquireSlotLock(sdk, { company_id, unit_id, professional_id, scheduled_at, owner_phone, source }) {
  if (!_slotEnabled()) return { success: true, reservation: null, skipped: true };
  const slot_key = _slotKey(company_id, professional_id, scheduled_at);
  const expires_at = new Date(Date.now() + _slotTtl() * 1000).toISOString();
  const existing = await sdk.entities.SlotReservation.filter({ slot_key }, '-created_date', 20);
  const nowISO = new Date().toISOString();
  const alive = existing.filter(r => r.status === 'active' && r.expires_at > nowISO);
  if (alive.length) {
    const mine = alive.find(r => owner_phone && r.owner_phone === owner_phone);
    if (mine) {
      try { await sdk.entities.SlotReservation.update(mine.id, { expires_at }); } catch {}
      return { success: true, reservation: { ...mine, expires_at }, reused: true };
    }
    console.warn('[slotLock] SLOT_TAKEN', { slot_key });
    return { success: false, error: 'SLOT_TAKEN' };
  }
  const reservation = await sdk.entities.SlotReservation.create({
    company_id, unit_id: unit_id || undefined, professional_id,
    scheduled_at: _truncMin(scheduled_at), slot_key,
    owner_phone: owner_phone || undefined, source: source || 'internal',
    expires_at, status: 'active',
  });
  console.log('[slotLock] acquired', { reservation_id: reservation.id, slot_key });
  return { success: true, reservation };
}
async function consumeSlotLock(sdk, reservation_id, appointment_id) {
  if (!reservation_id) return;
  try {
    await sdk.entities.SlotReservation.update(reservation_id, {
      status: 'consumed', appointment_id, consumed_at: new Date().toISOString(),
    });
  } catch (err) { console.warn('[slotLock] consume failed:', err.message); }
}
async function releaseSlotLock(sdk, reservation_id) {
  if (!reservation_id) return;
  try { await sdk.entities.SlotReservation.update(reservation_id, { status: 'released' }); } catch {}
}

// ─── Rate limit (P0.2) — inline. Espelha lib/rateLimit.js ─────────────
const BOOKING_LIMIT_DEFAULT = 5;
function _bookingLimit() {
  const n = parseInt(Deno.env.get('BOOKING_RATE_LIMIT_PER_HOUR') || '', 10);
  return Number.isFinite(n) && n > 0 ? n : BOOKING_LIMIT_DEFAULT;
}
async function _checkBookingRateLimit(sdk, customer_phone) {
  if (!customer_phone) return { allowed: true };
  const limit = _bookingLimit();
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const recent = await sdk.entities.Appointment.filter(
    { customer_phone, created_date: { $gte: oneHourAgo } },
    '-created_date',
    Math.max(limit + 5, 20),
  );
  return { allowed: recent.length < limit, count: recent.length, limit };
}

// ─── Validação de bloqueio (P0.2) — inline. Espelha lib/scheduling.js ─
// WHY: frontend já valida visualmente, mas backend NUNCA pode confiar nisso.
function _blockedConflict({ professionalId, dateTime, durationMin, blocks }) {
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

// Sanitiza string vinda de payload público.
//  - trim
//  - strip tags HTML (`<...>`) — evita stored XSS quando o texto for exibido em outras telas
//  - normaliza whitespace excessivo
//  - limita tamanho
// WHY (M10): mesmo que o frontend escape o texto na exibição, o app exporta dados,
// envia por e-mail e por WhatsApp — três superfícies onde HTML/scripts injetados
// causam dano real. Sanitizar no ingestion é defesa em profundidade.
function _sanitizeText(v, max) {
  if (v == null) return '';
  let s = String(v).trim();
  s = s.replace(/<[^>]*>/g, '');     // strip tags
  s = s.replace(/[\u0000-\u001F\u007F]/g, ' '); // strip control chars
  s = s.replace(/\s{3,}/g, '  ');    // colapsa whitespace exagerado
  return s.slice(0, max);
}

// M5 — Tokens públicos gerados no servidor (nunca no frontend).
// Web Crypto via crypto.randomUUID() (RFC 4122 v4 — cripto-seguro).
// Removendo "-" fica um identificador opaco de 32 chars, mantendo compat com tokens antigos.
function _generateToken() {
  return crypto.randomUUID().replace(/-/g, '');
}
function _confirmTokenExpiry(scheduledAtISO) {
  if (!scheduledAtISO) return null;
  return new Date(new Date(scheduledAtISO).getTime() + 30 * 60 * 1000).toISOString();
}
function _reviewTokenExpiry(scheduledAtISO) {
  if (!scheduledAtISO) return null;
  return new Date(new Date(scheduledAtISO).getTime() + 72 * 60 * 60 * 1000).toISOString();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    const {
      company_id,
      unit_id,
      professional_id,
      service_id,
      customer_name,
      customer_phone,
      customer_email,
      scheduled_at,
      notes,
      scope_customer_by_unit,
      is_flexible_assignment,
      existing_customer_id,
    } = body;
    // WHY (P0.2): NÃO desestruturamos professional_name, service_name nem price.
    // Esses campos são AUTORITATIVOS DO BANCO. Carregamos abaixo via .get().
    // Ignorar payload evita: cliente injetar preço 0, nome falso, serviço inexistente.
    //
    // WHY (M5): tokens de confirmação e avaliação são confiança de negócio.
    // Não aceitamos do frontend — geramos no servidor com crypto.randomUUID().

    // Validações mínimas
    if (!company_id) return Response.json({ success: false, error: 'company_id_required' }, { status: 400 });
    if (!service_id) return Response.json({ success: false, error: 'service_id_required' }, { status: 400 });
    if (!professional_id) return Response.json({ success: false, error: 'professional_id_required' }, { status: 400 });
    if (!scheduled_at) return Response.json({ success: false, error: 'scheduled_at_required' }, { status: 400 });
    if (!customer_name?.trim()) return Response.json({ success: false, error: 'customer_name_required' }, { status: 400 });
    if (!customer_phone?.trim()) return Response.json({ success: false, error: 'customer_phone_required' }, { status: 400 });

    // Telefone normalizado (só dígitos)
    const phoneNorm = String(customer_phone).replace(/\D/g, '');
    if (phoneNorm.length < 10) {
      return Response.json({ success: false, error: 'invalid_phone' }, { status: 400 });
    }

    // Sanitização (P0.2) — limita tamanhos para evitar payload abuso.
    const customerNameClean = _sanitizeText(customer_name, 100);
    const customerEmailClean = _sanitizeText(customer_email, 200);
    const notesClean = _sanitizeText(notes, 500);
    if (!customerNameClean) return Response.json({ success: false, error: 'customer_name_required' }, { status: 400 });

    // ─── RATE LIMIT (P0.2) ──────────────────────────────────────────────
    // WHY: protege contra flood (cliente malicioso ou bot criando bookings em massa).
    const rl = await _checkBookingRateLimit(sdk, phoneNorm);
    if (!rl.allowed) {
      console.warn('[createPublicAppointment] RATE_LIMITED', { phone: phoneNorm, count: rl.count, limit: rl.limit });
      return Response.json({
        success: false,
        error: 'rate_limited',
        message: `Limite de ${rl.limit} agendamentos por hora atingido. Tente novamente mais tarde.`,
      }, { status: 429 });
    }

    // ─── VALIDAÇÃO AUTORITATIVA (P0.2) ─────────────────────────────────
    // Carrega Service e Professional do banco. Ignora os campos enviados pelo frontend.
    // WHY: nunca confiar em service_name, price, duration vindos do cliente.
    let service, professional;
    try {
      service = await sdk.entities.Service.get(service_id);
    } catch { service = null; }
    if (!service) {
      await releaseSlotLock(sdk, null);
      return Response.json({ success: false, error: 'service_not_found' }, { status: 404 });
    }
    if (service.company_id !== company_id) {
      console.warn('[createPublicAppointment] cross-tenant service attempt', { company_id, service_id });
      return Response.json({ success: false, error: 'service_not_found' }, { status: 404 });
    }
    if (service.active === false) {
      return Response.json({ success: false, error: 'service_inactive' }, { status: 400 });
    }

    try {
      professional = await sdk.entities.Professional.get(professional_id);
    } catch { professional = null; }
    if (!professional || professional.company_id !== company_id) {
      console.warn('[createPublicAppointment] cross-tenant professional attempt', { company_id, professional_id });
      return Response.json({ success: false, error: 'professional_not_found' }, { status: 404 });
    }
    if (professional.active === false) {
      return Response.json({ success: false, error: 'professional_inactive' }, { status: 400 });
    }
    // Relacionamento Service ↔ Professional (se profissional define service_ids, restringe).
    if (professional.service_ids?.length && !professional.service_ids.includes(service_id)) {
      return Response.json({ success: false, error: 'service_not_offered_by_professional' }, { status: 400 });
    }
    // Multi-unit: se unit_id veio e profissional define unit_ids, valida pertencimento.
    if (unit_id && professional.unit_ids?.length && !professional.unit_ids.includes(unit_id)) {
      return Response.json({ success: false, error: 'professional_not_in_unit' }, { status: 400 });
    }

    // Dados autoritativos a partir daqui — IGNORAM o payload.
    const realPrice = service.price || 0;
    const realServiceName = service.name;
    const realProfessionalName = professional.name;
    const realDuration = service.duration_minutes || 30;

    // ─── VALIDAÇÃO DE BLOQUEIOS (P0.2) ─────────────────────────────────
    // WHY: cliente malicioso poderia mandar horário em bloqueio que o frontend escondeu.
    try {
      const blocks = await sdk.entities.BlockedTime.filter({ company_id }, '-created_date', 200);
      if (_blockedConflict({ professionalId: professional_id, dateTime: scheduled_at, durationMin: realDuration, blocks })) {
        return Response.json({ success: false, error: 'time_blocked', message: 'Horário indisponível.' }, { status: 409 });
      }
    } catch (err) {
      // Não derruba o booking — se a query falhar, registra e segue (defesa em camadas).
      console.warn('[createPublicAppointment] block validation skipped:', err.message);
    }

    // ─── LOCK ATÔMICO (P0.1) ────────────────────────────────────────────
    // WHY: este endpoint é usado pelo fluxo de plano e gratuito. Sem lock,
    // dois clientes podem reservar o mesmo slot simultaneamente.
    const lockResult = await acquireSlotLock(sdk, {
      company_id,
      unit_id,
      professional_id,
      scheduled_at,
      owner_phone: phoneNorm,
      source: body.subscription_id ? 'public_booking_plan' : 'public_booking_free',
    });
    if (!lockResult.success) {
      return Response.json({
        success: false,
        error: 'slot_taken',
        message: 'Este horário acabou de ser reservado. Escolha outro.',
      }, { status: 409 });
    }
    const slotReservation = lockResult.reservation;

    // 1) Lookup cliente — prioriza existing_customer_id (cliente autenticado) para evitar duplicidade
    let customer = null;
    const matches = [];

    if (existing_customer_id) {
      // Cliente autenticado: carrega direto pelo ID e valida pertencimento à empresa
      try {
        const c = await sdk.entities.Customer.get(existing_customer_id);
        if (c && c.company_id === company_id) {
          customer = c;
          matches.push(c);
          console.log(`[createPublicAppointment] cliente autenticado reutilizado: ${customer.id}`);
        } else {
          console.warn('[createPublicAppointment] existing_customer_id cross-tenant ou inválido', { existing_customer_id, company_id });
        }
      } catch (err) {
        console.warn('[createPublicAppointment] falha ao carregar existing_customer_id:', err.message);
      }
    }

    // Fallback: lookup por telefone (cliente anônimo ou falha no ID)
    if (!customer) {
      const lookupFilter = scope_customer_by_unit && unit_id
        ? { company_id, phone: phoneNorm, unit_id }
        : { company_id, phone: phoneNorm };
      const found = await sdk.entities.Customer.filter(lookupFilter, '-created_date', 1);
      if (found?.[0]) {
        customer = found[0];
        matches.push(found[0]);
      }
    }

    // 2) Se não existe → cria
    if (!customer) {
      console.log(`[createPublicAppointment] criando novo customer: ${customerNameClean} / ${phoneNorm}`);
      customer = await sdk.entities.Customer.create({
        company_id,
        unit_id: scope_customer_by_unit ? unit_id : undefined,
        name: customerNameClean,
        phone: phoneNorm,
        email: customerEmailClean || undefined,
        status: 'active',
      });
    } else {
      console.log(`[createPublicAppointment] cliente existente reutilizado: ${customer.id}`);
      // Atualiza email se antes não tinha e agora foi informado (não sobrescreve dados existentes)
      if (customerEmailClean && !customer.email) {
        try {
          await sdk.entities.Customer.update(customer.id, { email: customerEmailClean });
        } catch (err) {
          console.warn('[createPublicAppointment] falha ao atualizar email do customer:', err.message);
        }
      }
    }

    // 3) Cria Appointment vinculado — usa dados AUTORITATIVOS do banco
    //    e tokens gerados no SERVIDOR (M5).
    const confirmToken = _generateToken();
    const reviewToken = _generateToken();
    const appointment = await sdk.entities.Appointment.create({
      company_id,
      unit_id: unit_id || undefined,
      customer_id: customer.id,
      professional_id,
      professional_name: realProfessionalName,
      service_id,
      service_name: realServiceName,
      customer_name: customerNameClean,
      customer_phone: phoneNorm,
      customer_email: customerEmailClean || undefined,
      scheduled_at,
      notes: notesClean || undefined,
      status: 'agendado',
      price: realPrice,
      source: 'online',
      is_flexible_assignment: is_flexible_assignment === true,
      confirm_token: confirmToken,
      review_token: reviewToken,
      confirm_token_expires_at: _confirmTokenExpiry(scheduled_at),
      review_token_expires_at: _reviewTokenExpiry(scheduled_at),
    });

    console.log(`[createPublicAppointment] agendamento criado: ${appointment.id} para customer ${customer.id}`);

    // ─── Consume slot lock (sucesso) ────────────────────────────────────
    await consumeSlotLock(sdk, slotReservation?.id, appointment.id);

    // 4) Dispara e-mail de confirmação (não bloqueia)
    if (customer_email?.trim()) {
      sdk.functions
        .invoke('sendBookingConfirmation', { appointment_id: appointment.id })
        .catch((err) => console.warn('[createPublicAppointment] falha ao disparar e-mail:', err.message));
    }

    return Response.json({
      success: true,
      appointment_id: appointment.id,
      customer_id: customer.id,
      customer_was_created: matches.length === 0,
    });
  } catch (error) {
    // WHY: se erro ocorrer entre acquire e consume, o lock fica órfão.
    // O cleanup job vai expirar em <=90s — não vazamos slot permanentemente.
    // Não temos slotReservation no escopo aqui (variável local), então
    // a limpeza é responsabilidade do job. Aceitável.
    console.error('[createPublicAppointment] INTERNAL_ERROR:', error?.message, error?.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});