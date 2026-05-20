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

// ─── Idempotency (Fase 1) — inline porque functions/ não permite local imports ────
// Espelha lib/system/idempotency.js. Quando o frontend manda `idempotency_key`,
// guardamos o response da PRIMEIRA execução e devolvemos esse mesmo response em
// chamadas subsequentes com a mesma key (proteção contra duplo-clique, refresh).
const IDEMPOTENCY_TTL_MUTATION_MS = 24 * 60 * 60 * 1000; // 24h
async function _sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function _stableJSON(v) {
  if (Array.isArray(v)) return '[' + v.map(_stableJSON).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + _stableJSON(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}
// Tenta reservar a key. Retorna:
//   { hit: false, record }                 → primeira vez; siga e finalize com _idempotencyFinalize.
//   { hit: true, status: 'completed', snapshot, response_status } → devolva o snapshot direto.
//   { hit: true, status: 'pending' }       → outra execução está em curso (in-flight).
//   { hit: true, status: 'conflict' }      → mesma key, payload diferente (HTTP 409).
//   { hit: true, status: 'failed' }        → execução anterior falhou; deixe retry tentar.
async function _idempotencyReserve(sdk, { key, route, payload, company_id, user_id, ttl_ms }) {
  if (!key) return { hit: false, record: null };
  try {
    const request_hash = await _sha256Hex(_stableJSON(payload || {}));
    const existing = await sdk.entities.IdempotencyKey.filter({ key, route }, '-created_date', 1);
    const found = existing?.[0];
    const nowISO = new Date().toISOString();
    if (found) {
      // Expirado: tratamos como inexistente (cria nova).
      if (found.expires_at && found.expires_at < nowISO) {
        // pass through to create
      } else if (found.request_hash && found.request_hash !== request_hash) {
        return { hit: true, status: 'conflict' };
      } else if (found.status === 'completed') {
        return { hit: true, status: 'completed', snapshot: found.response_snapshot || {}, response_status: found.response_status || 200 };
      } else if (found.status === 'pending') {
        return { hit: true, status: 'pending' };
      } else if (found.status === 'failed') {
        // Permite retry: derruba o registro antigo e cria um novo.
        try { await sdk.entities.IdempotencyKey.delete(found.id); } catch {}
      }
    }
    const ttl = ttl_ms || IDEMPOTENCY_TTL_MUTATION_MS;
    const record = await sdk.entities.IdempotencyKey.create({
      key, route,
      company_id: company_id || undefined,
      user_id: user_id || undefined,
      request_hash,
      status: 'pending',
      expires_at: new Date(Date.now() + ttl).toISOString(),
    });
    return { hit: false, record };
  } catch (err) {
    // Idempotency é defesa em profundidade — falha aqui NÃO bloqueia a operação.
    console.warn('[idempotency] reserve failed (proceeding without):', err.message);
    return { hit: false, record: null };
  }
}
async function _idempotencyFinalize(sdk, record, { status, snapshot, response_status }) {
  if (!record?.id) return;
  try {
    await sdk.entities.IdempotencyKey.update(record.id, {
      status: status || 'completed',
      response_snapshot: snapshot || undefined,
      response_status: response_status || 200,
    });
  } catch (err) { console.warn('[idempotency] finalize failed:', err.message); }
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
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      scheduled_at,
      notes,
      scope_customer_by_unit,
      is_flexible_assignment,
      idempotency_key,
    } = body;
    // Fase 9: customer_id agora é OBRIGATÓRIO (cliente autenticado via AuthGate).
    // Removido existing_customer_id — apenas customer_id é aceito.
    // Removido fallback de lookup por telefone (era era do flow antigo).

    // ─── IDEMPOTENCY GUARD (Fase 1) ─────────────────────────────────────
    // Cliente pode mandar `idempotency_key`. Se mandar, protegemos contra:
    // - duplo-clique no botão "Confirmar"
    // - refresh durante envio
    // - retry automático do React Query
    // Sem a key, o fluxo continua como antes (compat).
    const idemRoute = 'createPublicAppointment';
    const idemPayload = { company_id, professional_id, service_id, customer_id, scheduled_at };
    const idem = await _idempotencyReserve(sdk, {
      key: idempotency_key,
      route: idemRoute,
      payload: idemPayload,
      company_id,
      user_id: customer_id || 'public',
    });
    if (idem.hit) {
      if (idem.status === 'completed') {
        console.log('[createPublicAppointment] idempotency replay', { key: idempotency_key });
        return Response.json(idem.snapshot, { status: idem.response_status || 200 });
      }
      if (idem.status === 'pending') {
        return Response.json({ success: false, error: 'in_flight', message: 'Operação em andamento, aguarde.' }, { status: 409 });
      }
      if (idem.status === 'conflict') {
        return Response.json({ success: false, error: 'idempotency_conflict', message: 'Chave já usada para outra operação.' }, { status: 409 });
      }
    }
    const idemRecord = idem.record;

    // Helper local — encapsula resposta + finalização da idempotency key.
    const respond = async (body, status = 200) => {
      await _idempotencyFinalize(sdk, idemRecord, {
        status: body?.success === false ? 'failed' : 'completed',
        snapshot: body,
        response_status: status,
      });
      return Response.json(body, { status });
    };

    // Validações mínimas
    if (!company_id) return respond({ success: false, error: 'company_id_required' }, 400);
    if (!customer_id) return respond({ success: false, error: 'customer_id_required (Fase 9: obrigatório)' }, 400);
    if (!service_id) return respond({ success: false, error: 'service_id_required' }, 400);
    if (!professional_id) return respond({ success: false, error: 'professional_id_required' }, 400);
    if (!scheduled_at) return respond({ success: false, error: 'scheduled_at_required' }, 400);
    if (!customer_name?.trim()) return respond({ success: false, error: 'customer_name_required' }, 400);
    if (!customer_phone?.trim()) return respond({ success: false, error: 'customer_phone_required' }, 400);

    // Telefone normalizado (só dígitos)
    const phoneNorm = String(customer_phone).replace(/\D/g, '');
    if (phoneNorm.length < 10) {
      return respond({ success: false, error: 'invalid_phone' }, 400);
    }

    // Sanitização (P0.2) — limita tamanhos para evitar payload abuso.
    const customerNameClean = _sanitizeText(customer_name, 100);
    const customerEmailClean = _sanitizeText(customer_email, 200);
    const notesClean = _sanitizeText(notes, 500);
    if (!customerNameClean) return respond({ success: false, error: 'customer_name_required' }, 400);

    // ─── RATE LIMIT (P0.2) ──────────────────────────────────────────────
    // WHY: protege contra flood (cliente malicioso ou bot criando bookings em massa).
    const rl = await _checkBookingRateLimit(sdk, phoneNorm);
    if (!rl.allowed) {
      console.warn('[createPublicAppointment] RATE_LIMITED', { phone: phoneNorm, count: rl.count, limit: rl.limit });
      return respond({
        success: false,
        error: 'rate_limited',
        message: `Limite de ${rl.limit} agendamentos por hora atingido. Tente novamente mais tarde.`,
      }, 429);
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
      return respond({ success: false, error: 'service_not_found' }, 404);
    }
    if (service.company_id !== company_id) {
      console.warn('[createPublicAppointment] cross-tenant service attempt', { company_id, service_id });
      return respond({ success: false, error: 'service_not_found' }, 404);
    }
    if (service.active === false) {
      return respond({ success: false, error: 'service_inactive' }, 400);
    }

    try {
      professional = await sdk.entities.Professional.get(professional_id);
    } catch { professional = null; }
    if (!professional || professional.company_id !== company_id) {
      console.warn('[createPublicAppointment] cross-tenant professional attempt', { company_id, professional_id });
      return respond({ success: false, error: 'professional_not_found' }, 404);
    }
    if (professional.active === false) {
      return respond({ success: false, error: 'professional_inactive' }, 400);
    }
    // Relacionamento Service ↔ Professional (se profissional define service_ids, restringe).
    if (professional.service_ids?.length && !professional.service_ids.includes(service_id)) {
      return respond({ success: false, error: 'service_not_offered_by_professional' }, 400);
    }
    // Multi-unit: se unit_id veio e profissional define unit_ids, valida pertencimento.
    if (unit_id && professional.unit_ids?.length && !professional.unit_ids.includes(unit_id)) {
      return respond({ success: false, error: 'professional_not_in_unit' }, 400);
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
        return respond({ success: false, error: 'time_blocked', message: 'Horário indisponível.' }, 409);
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
      return respond({
        success: false,
        error: 'slot_taken',
        message: 'Este horário acabou de ser reservado. Escolha outro.',
      }, 409);
    }
    const slotReservation = lockResult.reservation;

    // Fase 9: customer_id vem autenticado do AuthGate — lookup direto e valida pertencimento
    let customer = null;
    try {
      const c = await sdk.entities.Customer.get(customer_id);
      if (c && c.company_id === company_id) {
        customer = c;
        console.log(`[createPublicAppointment] cliente autenticado carregado: ${customer.id}`);
      } else {
        console.warn('[createPublicAppointment] customer_id cross-tenant ou inválido', { customer_id, company_id });
        await releaseSlotLock(sdk, slotReservation?.id);
        return respond({ success: false, error: 'customer_not_found_or_cross_tenant' }, 404);
      }
    } catch (err) {
      console.warn('[createPublicAppointment] falha ao carregar customer:', err.message);
      await releaseSlotLock(sdk, slotReservation?.id);
      return respond({ success: false, error: 'customer_not_found' }, 404);
    }

    // Atualiza campos do customer se diferentes (não sobrescreve dados existentes críticos)
    if ((customerEmailClean && !customer.email) || customer.name !== customerNameClean) {
      try {
        await sdk.entities.Customer.update(customer.id, {
          ...(customerEmailClean && !customer.email ? { email: customerEmailClean } : {}),
          name: customerNameClean, // Sempre atualiza nome do agendamento atual
        });
      } catch (err) {
        console.warn('[createPublicAppointment] falha ao atualizar customer:', err.message);
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

    return respond({
      success: true,
      appointment_id: appointment.id,
      customer_id: customer.id,
    }, 200);
  } catch (error) {
    // WHY: se erro ocorrer entre acquire e consume, o lock fica órfão.
    // O cleanup job vai expirar em <=90s — não vazamos slot permanentemente.
    // Não temos slotReservation no escopo aqui (variável local), então
    // a limpeza é responsabilidade do job. Aceitável.
    console.error('[createPublicAppointment] INTERNAL_ERROR:', error?.message, error?.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
});