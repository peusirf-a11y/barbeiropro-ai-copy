// createAsaasBookingPayment — endpoint PÚBLICO (sem auth) chamado pelo PublicBooking.
// Substitui createBookingPaymentIntent (Stripe) para o fluxo de pagamento PIX no link público.
//
// Diferenças x versão Stripe:
//  - Recebimento centralizado na conta master Asaas (sem Connect/destination charge).
//  - Repasse à barbearia é manual no início (Sprint 2). Split entra em fase posterior.
//  - Apenas PIX neste primeiro corte (cartão/boleto serão habilitados depois).
//
// Responsabilidades preservadas (espelham createBookingPaymentIntent):
//  1. Rate limit IP + telefone.
//  2. Validação autoritativa de service, professional, bloqueios.
//  3. Slot lock atômico.
//  4. Idempotency Base44 (proteção contra duplo-clique/refresh).
//  5. Criação de Appointment com status='aguardando_pagamento' e expires_at = now+15min.
//  6. Cancelamento de tentativas anteriores do MESMO cliente no mesmo slot (troca de método).
//
// Asaas:
//  - Cria Customer (idempotência via externalReference = customerId Base44).
//  - Cria Payment PIX com dueDate hoje, recebe QR code via /payments/{id}/pixQrCode.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PAYMENT_EXPIRY_MINUTES = 15;

// ─── Asaas HTTP client (inline) ─────────────────────────────────────
function getAsaasConfig() {
  const apiKey = Deno.env.get('ASAAS_API_KEY');
  const environment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
  const baseUrl = Deno.env.get('ASAAS_BASE_URL')
    || (environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
  return { apiKey, baseUrl, isConfigured: !!apiKey };
}

function digitsOnly(v) { return String(v || '').replace(/\D+/g, ''); }
function sanitizeCpfCnpj(v) {
  const d = digitsOnly(v);
  return (d.length === 11 || d.length === 14) ? d : null;
}
function sanitizePhone(v) {
  const d = digitsOnly(v);
  return (d.length >= 10 && d.length <= 13) ? d : null;
}

async function asaasFetch(method, path, { body, query, idempotencyKey } = {}) {
  const cfg = getAsaasConfig();
  if (!cfg.isConfigured) {
    const e = new Error('ASAAS_API_KEY not configured');
    e.code = 'asaas_not_configured'; e.status = 503; throw e;
  }
  let url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v != null) qs.append(k, String(v));
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'access_token': cfg.apiKey,
    'User-Agent': 'OCorte-SaaS/1.0 (+booking-asaas)',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    clearTimeout(t);
    const txt = await res.text();
    let data = null;
    if (txt) { try { data = JSON.parse(txt); } catch { data = txt; } }
    if (!res.ok) {
      const e = new Error(extractErr(data) || `HTTP ${res.status}`);
      e.code = res.status === 401 ? 'asaas_unauthorized' : res.status === 400 ? 'asaas_bad_request' : 'asaas_error';
      e.status = res.status; e.details = data;
      throw e;
    }
    return data;
  } catch (err) {
    clearTimeout(t);
    if (err.code) throw err;
    if (err.name === 'AbortError') { const e = new Error('asaas timeout'); e.code = 'asaas_timeout'; e.status = 504; throw e; }
    const e = new Error(err.message || 'network'); e.code = 'asaas_network'; e.status = 502; throw e;
  }
}

function extractErr(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.slice(0, 200);
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors.map(e => e?.description || e?.code).filter(Boolean).join('; ');
  return data?.message || data?.error || null;
}

// ─── Slot Lock (espelha createBookingPaymentIntent) ─────────────────
const SLOT_TTL_DEFAULT = 90;
function _slotTtl() { const n = parseInt(Deno.env.get('SLOT_RESERVATION_TTL_SECONDS') || '', 10); return Number.isFinite(n) && n > 0 ? n : SLOT_TTL_DEFAULT; }
function _slotEnabled() { const v = Deno.env.get('ENABLE_SLOT_LOCK'); if (!v) return true; return String(v).toLowerCase() !== 'false'; }
function _truncMin(iso) { const d = new Date(iso); d.setSeconds(0, 0); return d.toISOString(); }
function _slotKey(c, p, s) { return `${c}:${p}:${_truncMin(s)}`; }
async function acquireSlotLock(sdk, { company_id, unit_id, professional_id, scheduled_at, owner_phone, reservation_owner_id, source }) {
  if (!_slotEnabled()) return { success: true, reservation: null, skipped: true };
  const slot_key = _slotKey(company_id, professional_id, scheduled_at);
  const expires_at = new Date(Date.now() + _slotTtl() * 1000).toISOString();
  const existing = await sdk.entities.SlotReservation.filter({ slot_key }, '-created_date', 20);
  const nowISO = new Date().toISOString();
  const alive = existing.filter(r => r.status === 'active' && r.expires_at > nowISO);
  if (alive.length) {
    const mine = alive.find(r => {
      if (reservation_owner_id) return r.reservation_owner_id === reservation_owner_id;
      return owner_phone && r.owner_phone === owner_phone && !r.reservation_owner_id;
    });
    if (mine) {
      try { await sdk.entities.SlotReservation.update(mine.id, { expires_at }); } catch {}
      return { success: true, reservation: { ...mine, expires_at }, reused: true };
    }
    return { success: false, error: 'SLOT_TAKEN' };
  }
  const reservation = await sdk.entities.SlotReservation.create({
    company_id, unit_id: unit_id || undefined, professional_id,
    scheduled_at: _truncMin(scheduled_at), slot_key,
    owner_phone: owner_phone || undefined,
    reservation_owner_id: reservation_owner_id || undefined,
    source: source || 'public_booking_pix_asaas',
    expires_at, status: 'active',
  });
  return { success: true, reservation };
}
async function consumeSlotLock(sdk, reservation_id, appointment_id) {
  if (!reservation_id) return;
  try { await sdk.entities.SlotReservation.update(reservation_id, { status: 'consumed', appointment_id, consumed_at: new Date().toISOString() }); } catch {}
}
async function releaseSlotLock(sdk, reservation_id) {
  if (!reservation_id) return;
  try { await sdk.entities.SlotReservation.update(reservation_id, { status: 'released' }); } catch {}
}

// ─── Rate limit (mesmo modelo do PaymentIntent original) ────────────
const BOOKING_LIMIT_DEFAULT = 5;
function _bookingLimit() { const n = parseInt(Deno.env.get('BOOKING_RATE_LIMIT_PER_HOUR') || '', 10); return Number.isFinite(n) && n > 0 ? n : BOOKING_LIMIT_DEFAULT; }
async function _checkBookingRateLimit(sdk, customer_phone) {
  if (!customer_phone) return { allowed: true };
  const limit = _bookingLimit();
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const recent = await sdk.entities.Appointment.filter({ customer_phone, created_date: { $gte: oneHourAgo } }, '-created_date', Math.max(limit + 5, 20));
  return { allowed: recent.length < limit, count: recent.length, limit };
}
async function _checkIpRateLimit(sdk, ip, route) {
  if (!ip || ip === 'unknown') return { allowed: true };
  const key = `${route}:ip:${ip}`;
  const now = new Date();
  const limit = _bookingLimit();
  const windowMs = 3600_000, softBlockMs = 3600_000, hardBlockMs = 24 * 3600_000, hardMult = 3;
  const existing = await sdk.entities.SecurityRateLimit.filter({ key }, '-created_date', 1).catch(() => []);
  const record = existing?.[0];
  if (record?.is_blocked && record?.blocked_until && new Date(record.blocked_until) > now) {
    return { allowed: false, blocked_until: record.blocked_until, reason: 'IP_BLOCKED', attempts: record.attempts };
  }
  if (record && record.window_end && new Date(record.window_end) > now) {
    const newAttempts = (record.attempts || 0) + 1;
    if (newAttempts >= limit * hardMult) {
      const blocked_until = new Date(now.getTime() + hardBlockMs).toISOString();
      await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts, is_blocked: true, blocked_until }).catch(() => {});
      return { allowed: false, blocked_until, reason: 'HARD_BLOCKED', attempts: newAttempts };
    }
    if (newAttempts >= limit) {
      const blocked_until = new Date(now.getTime() + softBlockMs).toISOString();
      await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts, is_blocked: true, blocked_until }).catch(() => {});
      return { allowed: false, blocked_until, reason: 'SOFT_BLOCKED', attempts: newAttempts };
    }
    await sdk.entities.SecurityRateLimit.update(record.id, { attempts: newAttempts }).catch(() => {});
    return { allowed: true, attempts: newAttempts };
  }
  const window_start = now.toISOString();
  const window_end = new Date(now.getTime() + windowMs).toISOString();
  if (record) await sdk.entities.SecurityRateLimit.update(record.id, { attempts: 1, window_start, window_end, is_blocked: false, blocked_until: null }).catch(() => {});
  else await sdk.entities.SecurityRateLimit.create({ key, route, ip, identifier: ip, attempts: 1, window_start, window_end, is_blocked: false }).catch(() => {});
  return { allowed: true, attempts: 1 };
}

// ─── Bloqueios (cópia de createBookingPaymentIntent) ────────────────
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
      const bEnd = new Date(start); bEnd.setHours(eh || 0, em || 0, 0, 0);
      return start < bEnd && end > bStart;
    }
    if (!b.start_time || !b.end_time) return false;
    return start < new Date(b.end_time) && end > new Date(b.start_time);
  });
}

function _sanitizeText(v, max) {
  if (v == null) return '';
  let s = String(v).trim();
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.replace(/\s{3,}/g, '  ');
  return s.slice(0, max);
}

function _generateToken() { return crypto.randomUUID().replace(/-/g, ''); }
function _confirmTokenExpiry(iso) { return iso ? new Date(new Date(iso).getTime() + 30 * 60_000).toISOString() : null; }
function _reviewTokenExpiry(iso) { return iso ? new Date(new Date(iso).getTime() + 72 * 3600_000).toISOString() : null; }

// ─── Idempotency Base44 ─────────────────────────────────────────────
const IDEMPOTENCY_TTL_MS = 3600_000;
async function _sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function _stableJSON(v) {
  if (Array.isArray(v)) return '[' + v.map(_stableJSON).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + _stableJSON(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const body = await req.json().catch(() => ({}));

    // ─── Rate limit IP ────────────────────────────────────────────
    const ipRl = await _checkIpRateLimit(sdk, ip, 'createAsaasBookingPayment');
    if (!ipRl.allowed) {
      console.warn(`[createAsaasBookingPayment] rid=${rid} IP_RATE_LIMITED ip=${ip} reason=${ipRl.reason}`);
      return Response.json({ error: 'rate_limited', message: 'Muitas tentativas. Tente novamente mais tarde.' }, { status: 429 });
    }

    const {
      company_id, unit_id, professional_id, service_id,
      customer_name, customer_phone, customer_email, customer_cpf,
      scheduled_at, notes,
      payment_method, // 'pix' (cartão entra depois)
      scope_customer_by_unit,
      is_flexible_assignment,
      idempotency_key,
      customer_id: authenticatedCustomerId,
    } = body;

    // Idempotency
    const idemPayload = { company_id, professional_id, service_id, scheduled_at, payment_method, customer_phone };
    let idemRecord = null;
    if (idempotency_key) {
      try {
        const reqHash = await _sha256Hex(_stableJSON(idemPayload));
        const existing = await sdk.entities.IdempotencyKey.filter({ key: idempotency_key, route: 'createAsaasBookingPayment' }, '-created_date', 1);
        const found = existing?.[0];
        const nowISO = new Date().toISOString();
        if (found) {
          if (found.expires_at && found.expires_at >= nowISO) {
            if (found.request_hash && found.request_hash !== reqHash) {
              return Response.json({ error: 'idempotency_conflict' }, { status: 409 });
            }
            if (found.status === 'completed') return Response.json(found.response_snapshot || {}, { status: found.response_status || 200 });
            if (found.status === 'pending') return Response.json({ error: 'in_flight', message: 'Pagamento em processamento, aguarde.' }, { status: 409 });
            if (found.status === 'failed') { try { await sdk.entities.IdempotencyKey.delete(found.id); } catch {} }
          }
        }
        idemRecord = await sdk.entities.IdempotencyKey.create({
          key: idempotency_key, route: 'createAsaasBookingPayment',
          company_id: company_id || undefined,
          user_id: customer_phone || 'public',
          request_hash: reqHash, status: 'pending',
          expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
        });
      } catch (e) {
        console.warn('[createAsaasBookingPayment] idempotency skip:', e.message);
      }
    }
    const respond = async (data, status = 200) => {
      if (idemRecord?.id) {
        await sdk.entities.IdempotencyKey.update(idemRecord.id, {
          status: data?.error ? 'failed' : 'completed',
          response_snapshot: data, response_status: status,
        }).catch(() => {});
      }
      return Response.json(data, { status });
    };

    // Validações
    if (!company_id) return respond({ error: 'company_id_required' }, 400);
    if (!service_id) return respond({ error: 'service_id_required' }, 400);
    if (!professional_id) return respond({ error: 'professional_id_required' }, 400);
    if (!scheduled_at) return respond({ error: 'scheduled_at_required' }, 400);
    if (!customer_name?.trim()) return respond({ error: 'customer_name_required' }, 400);
    if (!customer_phone?.trim()) return respond({ error: 'customer_phone_required' }, 400);
    if (payment_method !== 'pix') return respond({ error: 'invalid_payment_method', message: 'Por enquanto apenas PIX está disponível.' }, 400);
    const cpfNorm = sanitizeCpfCnpj(customer_cpf);
    if (!cpfNorm) return respond({ error: 'cpf_required', message: 'CPF/CNPJ é obrigatório.' }, 400);
    const phoneNorm = sanitizePhone(customer_phone);
    if (!phoneNorm) return respond({ error: 'invalid_phone' }, 400);

    const customerNameClean = _sanitizeText(customer_name, 100);
    const customerEmailClean = _sanitizeText(customer_email, 200);
    const notesClean = _sanitizeText(notes, 500);
    if (!customerNameClean) return respond({ error: 'customer_name_required' }, 400);

    // Rate limit por telefone
    const rl = await _checkBookingRateLimit(sdk, phoneNorm);
    if (!rl.allowed) {
      return respond({ error: 'rate_limited', message: `Limite de ${rl.limit} agendamentos por hora atingido.` }, 429);
    }

    // Carrega empresa + valida que aceita Asaas PIX
    const companies = await sdk.entities.Company.filter({ id: company_id });
    if (!companies.length) return respond({ error: 'company_not_found' }, 404);
    const company = companies[0];
    if (!company.asaas_pix_enabled) {
      return respond({
        error: 'asaas_pix_not_enabled',
        message: 'Esta barbearia ainda não habilitou pagamento online via PIX.',
      }, 400);
    }

    // Validação autoritativa de service e professional
    let service = null, professional = null;
    try { service = await sdk.entities.Service.get(service_id); } catch {}
    if (!service || service.company_id !== company_id) return respond({ error: 'service_not_found' }, 404);
    if (service.active === false) return respond({ error: 'service_inactive' }, 400);
    try { professional = await sdk.entities.Professional.get(professional_id); } catch {}
    if (!professional || professional.company_id !== company_id) return respond({ error: 'professional_not_found' }, 404);
    if (professional.active === false) return respond({ error: 'professional_inactive' }, 400);
    if (professional.service_ids?.length && !professional.service_ids.includes(service_id)) return respond({ error: 'service_not_offered_by_professional' }, 400);
    if (unit_id && professional.unit_ids?.length && !professional.unit_ids.includes(unit_id)) return respond({ error: 'professional_not_in_unit' }, 400);

    const realPrice = Number(service.price) || 0;
    if (realPrice <= 0) return respond({ error: 'invalid_price', message: 'Serviço sem preço — pague no balcão.' }, 400);
    const realServiceName = service.name;
    const realProfessionalName = professional.name;
    const realDuration = service.duration_minutes || 30;
    const scheduledAtISO = new Date(scheduled_at).toISOString();

    // Bloqueios
    try {
      const blocks = await sdk.entities.BlockedTime.filter({ company_id }, '-created_date', 200);
      if (_blockedConflict({ professionalId: professional_id, dateTime: scheduledAtISO, durationMin: realDuration, blocks })) {
        return respond({ error: 'time_blocked', message: 'Horário indisponível.' }, 409);
      }
    } catch (err) { console.warn('[createAsaasBookingPayment] block check skipped:', err.message); }

    // Slot lock
    const lockResult = await acquireSlotLock(sdk, {
      company_id, unit_id, professional_id, scheduled_at: scheduledAtISO,
      owner_phone: phoneNorm,
      reservation_owner_id: authenticatedCustomerId || undefined,
      source: 'public_booking_pix_asaas',
    });
    if (!lockResult.success) {
      return respond({ error: 'slot_taken', message: 'Este horário acabou de ser reservado por outra pessoa. Escolha outro.' }, 409);
    }
    const slotReservation = lockResult.reservation;

    // Segunda camada: filter Appointment + reuse próprio
    const sameSlot = await sdk.entities.Appointment.filter({ company_id, professional_id, scheduled_at: scheduledAtISO });
    const blockingStatuses = ['aguardando_pagamento', 'agendado', 'confirmado', 'em_atendimento'];
    const ownPendingToReuse = [];
    const conflict = sameSlot.find(a => {
      if (!blockingStatuses.includes(a.status)) return false;
      if (a.status === 'aguardando_pagamento' && a.payment_expires_at && new Date(a.payment_expires_at) < new Date()) return false;
      if (a.status === 'aguardando_pagamento' && a.customer_phone === phoneNorm) { ownPendingToReuse.push(a); return false; }
      return true;
    });
    if (conflict) {
      await releaseSlotLock(sdk, slotReservation?.id);
      return respond({ error: 'slot_taken', message: 'Este horário acabou de ser reservado por outra pessoa.' }, 409);
    }
    for (const old of ownPendingToReuse) {
      try {
        await sdk.entities.Appointment.update(old.id, { status: 'cancelado', payment_status: 'canceled' });
      } catch (err) { console.warn('[createAsaasBookingPayment] release old pending failed:', err.message); }
    }

    // Customer Base44
    const lookupFilter = scope_customer_by_unit && unit_id ? { company_id, phone: phoneNorm, unit_id } : { company_id, phone: phoneNorm };
    const matches = await sdk.entities.Customer.filter(lookupFilter, '-created_date', 1);
    let customer = matches?.[0] || null;
    if (!customer) {
      customer = await sdk.entities.Customer.create({
        company_id, unit_id: scope_customer_by_unit ? unit_id : undefined,
        name: customerNameClean, phone: phoneNorm, email: customerEmailClean || undefined,
        status: 'active',
      });
    } else if (customerEmailClean && !customer.email) {
      try { await sdk.entities.Customer.update(customer.id, { email: customerEmailClean }); } catch {}
    }

    // ─── Asaas Customer ───────────────────────────────────────────
    // externalReference = customerId Base44 (idempotente por barbearia+cliente).
    const customerExtRef = `cust:${company_id}:${customer.id}`;
    let asaasCustomerId = null;
    try {
      const found = await asaasFetch('GET', '/customers', { query: { externalReference: customerExtRef, limit: 1 } });
      if (found?.data?.[0]?.id) asaasCustomerId = found.data[0].id;
    } catch (err) { console.warn('[createAsaasBookingPayment] customer lookup:', err.message); }
    if (!asaasCustomerId) {
      try {
        const created = await asaasFetch('POST', '/customers', {
          idempotencyKey: `bk_cust:${customer.id}`,
          body: {
            name: customerNameClean,
            email: customerEmailClean || undefined,
            cpfCnpj: cpfNorm,
            mobilePhone: phoneNorm,
            externalReference: customerExtRef,
            notificationDisabled: false,
          },
        });
        asaasCustomerId = created?.id;
      } catch (err) {
        await releaseSlotLock(sdk, slotReservation?.id);
        return respond({ error: err.code || 'asaas_error', message: err.message || 'Falha ao registrar cliente no Asaas.' }, err.status || 502);
      }
    }

    // Cria Appointment como aguardando_pagamento
    const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60_000).toISOString();
    const appointment = await sdk.entities.Appointment.create({
      company_id,
      unit_id: unit_id || undefined,
      customer_id: customer.id,
      professional_id, professional_name: realProfessionalName,
      service_id, service_name: realServiceName,
      customer_name: customerNameClean,
      customer_phone: phoneNorm,
      customer_email: customerEmailClean || undefined,
      scheduled_at: scheduledAtISO,
      notes: notesClean || undefined,
      status: 'aguardando_pagamento',
      price: realPrice,
      custom_duration_minutes: realDuration,
      source: 'online',
      payment_method: 'pix',
      payment_status: 'pending',
      payment_expires_at: expiresAt,
      payer_tax_id: cpfNorm,
      paid_online: false,
      is_flexible_assignment: is_flexible_assignment === true,
      confirm_token: _generateToken(),
      review_token: _generateToken(),
      confirm_token_expires_at: _confirmTokenExpiry(scheduledAtISO),
      review_token_expires_at: _reviewTokenExpiry(scheduledAtISO),
    });

    // ─── Cria Payment PIX no Asaas ────────────────────────────────
    const externalRef = `booking:${appointment.id}`;
    const todayYmd = new Date().toISOString().slice(0, 10);
    let payment = null;
    try {
      payment = await asaasFetch('POST', '/payments', {
        idempotencyKey: `bk_pay:${appointment.id}`,
        body: {
          customer: asaasCustomerId,
          billingType: 'PIX',
          value: realPrice,
          dueDate: todayYmd,
          externalReference: externalRef,
          description: `Agendamento ${realServiceName} — ${company.name}`,
          postalService: false,
        },
      });
    } catch (err) {
      // Rollback: cancela appointment e libera lock
      await sdk.entities.Appointment.update(appointment.id, { status: 'cancelado', payment_status: 'failed' }).catch(() => {});
      await releaseSlotLock(sdk, slotReservation?.id);
      return respond({ error: err.code || 'asaas_error', message: err.message || 'Falha ao iniciar PIX.' }, err.status || 502);
    }

    // Persiste payment_intent_id (reaproveitamos o campo — guarda o Asaas Payment ID)
    await sdk.entities.Appointment.update(appointment.id, { payment_intent_id: payment.id }).catch(() => {});

    // Busca QR code PIX
    let pixQrCode = null, pixCopyPaste = null;
    try {
      const qr = await asaasFetch('GET', `/payments/${payment.id}/pixQrCode`);
      if (qr) {
        pixCopyPaste = qr.payload || null;
        // qr.encodedImage = base64 PNG (sem prefixo). Convertemos para data URL.
        if (qr.encodedImage) pixQrCode = `data:image/png;base64,${qr.encodedImage}`;
      }
    } catch (err) {
      console.warn('[createAsaasBookingPayment] pix QR fetch warn:', err.message);
    }

    await consumeSlotLock(sdk, slotReservation?.id, appointment.id);

    return respond({
      success: true,
      appointment_id: appointment.id,
      customer_id: customer.id,
      asaas_payment_id: payment.id,
      asaas_invoice_url: payment.invoiceUrl || null,
      expires_at: expiresAt,
      pix: (pixQrCode || pixCopyPaste) ? { qr_code_url: pixQrCode, copy_paste: pixCopyPaste } : null,
    }, 200);
  } catch (error) {
    console.error('[createAsaasBookingPayment] INTERNAL_ERROR:', error?.message, error?.stack);
    return Response.json({ success: false, error: 'INTERNAL_ERROR', message: error?.message }, { status: 500 });
  }
});