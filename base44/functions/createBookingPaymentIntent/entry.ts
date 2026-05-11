// createBookingPaymentIntent — endpoint PÚBLICO (sem auth) chamado pelo PublicBooking.
//
// Responsabilidades:
//  1. Validar que a barbearia aceita pagamento online (stripe_connect_charges_enabled).
//  2. Criar/reutilizar Customer da barbearia (mesma lógica do createPublicAppointment).
//  3. LOCK do slot: rejeita se já existir Appointment confirmado/aguardando_pagamento
//     no mesmo professional+horário.
//  4. Criar Appointment com status='aguardando_pagamento' e payment_expires_at = now+15min.
//  5. Criar PaymentIntent na conta CONNECT da barbearia (destination charge),
//     idempotency key determinística (evita duplicidade em refresh/duplo-clique).
//  6. Devolver { client_secret, payment_intent_id, appointment_id, expires_at, qr_code_pix }
//
// O Appointment NÃO entra na agenda como confirmado até o webhook receber
// `payment_intent.succeeded` (fonte da verdade).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

const PAYMENT_EXPIRY_MINUTES = 15;

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

// Sanitiza texto vindo do payload público.
function _sanitizeText(v, max) {
  if (v == null) return '';
  return String(v).trim().slice(0, max);
}

// Resolve a chave secreta do Stripe baseado em STRIPE_ENVIRONMENT ('test' | 'live').
// Default = 'test' por segurança. Valida o prefixo da chave para evitar mismatch.
function getStripeSecret() {
  const env = (Deno.env.get('STRIPE_ENVIRONMENT') || 'test').toLowerCase();
  const isLive = env === 'live';
  const key = (isLive ? Deno.env.get('STRIPE_SECRET_KEY') : Deno.env.get('STRIPE_TEST_SECRET_KEY')) || '';
  if (!key) throw new Error(`Stripe secret missing for environment=${env}`);
  const expectedPrefix = isLive ? 'sk_live_' : 'sk_test_';
  if (!key.startsWith(expectedPrefix)) {
    throw new Error(`Stripe key prefix mismatch for environment=${env} (expected ${expectedPrefix})`);
  }
  console.log(`[stripe] environment=${env}`);
  return key;
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}
function normalizeCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const stripe = new Stripe(getStripeSecret(), { apiVersion: '2024-06-20' });
    const body = await req.json().catch(() => ({}));

    const {
      company_id,
      unit_id,
      professional_id,
      service_id,
      customer_name,
      customer_phone,
      customer_email,
      customer_cpf,
      scheduled_at,
      notes,
      payment_method, // 'pix' ou 'card'
      scope_customer_by_unit,
      confirm_token,
      review_token,
      confirm_token_expires_at,
      review_token_expires_at,
    } = body;
    // WHY (P0.2): NÃO desestruturamos price, service_name, professional_name.
    // Esses são AUTORITATIVOS DO BANCO. Carregamos via .get() abaixo.
    // Cliente malicioso poderia mandar price=0.01 ou serviço de outra barbearia.

    // ─── Validações ─────────────────────────────────────────────────────
    const fail = (code, status = 400, extra = {}) => {
      console.warn(`[createBookingPaymentIntent] validation failed: ${code}`, {
        company_id, service_id, professional_id, scheduled_at,
        has_name: !!customer_name, has_phone: !!customer_phone,
        payment_method, has_cpf: !!customer_cpf,
      });
      return Response.json({ error: code, ...extra }, { status });
    };
    if (!company_id) return fail('company_id_required');
    if (!service_id) return fail('service_id_required');
    if (!professional_id) return fail('professional_id_required');
    if (!scheduled_at) return fail('scheduled_at_required');
    if (!customer_name?.trim()) return fail('customer_name_required');
    if (!customer_phone?.trim()) return fail('customer_phone_required');
    if (!['pix', 'card'].includes(payment_method)) return fail('invalid_payment_method');
    const cpfNorm = normalizeCpf(customer_cpf);
    if (cpfNorm.length !== 11) return fail('cpf_required', 400, { message: 'CPF é obrigatório (11 dígitos)' });
    const phoneNorm = normalizePhone(customer_phone);
    if (phoneNorm.length < 10) return fail('invalid_phone');

    // Sanitização (P0.2).
    const customerNameClean = _sanitizeText(customer_name, 100);
    const customerEmailClean = _sanitizeText(customer_email, 200);
    const notesClean = _sanitizeText(notes, 500);
    if (!customerNameClean) return fail('customer_name_required');

    // ─── RATE LIMIT (P0.2) ──────────────────────────────────────────────
    // WHY: cliente malicioso pode tentar criar bookings/PaymentIntents em massa.
    // Aplicado ANTES de chamar Stripe (caro) e antes de criar Appointment.
    const rl = await _checkBookingRateLimit(sdk, phoneNorm);
    if (!rl.allowed) {
      console.warn('[createBookingPaymentIntent] RATE_LIMITED', { phone: phoneNorm, count: rl.count, limit: rl.limit });
      return Response.json({
        error: 'rate_limited',
        message: `Limite de ${rl.limit} agendamentos por hora atingido. Tente novamente mais tarde.`,
      }, { status: 429 });
    }

    // ─── Carrega empresa e valida Connect ───────────────────────────────
    const companies = await sdk.entities.Company.filter({ id: company_id });
    if (!companies.length) return Response.json({ error: 'company_not_found' }, { status: 404 });
    const company = companies[0];
    if (!company.stripe_connect_account_id || !company.stripe_connect_charges_enabled) {
      return Response.json({
        error: 'connect_not_ready',
        message: 'Esta barbearia ainda não está aceitando pagamentos online.',
      }, { status: 400 });
    }
    if (payment_method === 'pix' && !company.stripe_connect_pix_enabled) {
      return Response.json({
        error: 'pix_not_enabled',
        message: 'Pix ainda não está ativo nesta barbearia. Por favor, escolha pagar com cartão.',
      }, { status: 400 });
    }

    // ─── VALIDAÇÃO AUTORITATIVA (P0.2) ─────────────────────────────────
    // Carrega Service e Professional do banco. Ignora payload do frontend.
    // WHY: cliente malicioso pode mandar:
    //  - service_id de outra barbearia → cobramos errado
    //  - price=0.01 → pagamos só centavos
    //  - service_name fake → exibe nome errado no receipt
    //  - professional_id que não atende esse serviço → fura regra de negócio
    let service, professional;
    try {
      service = await sdk.entities.Service.get(service_id);
    } catch { service = null; }
    if (!service || service.company_id !== company_id) {
      console.warn('[createBookingPaymentIntent] cross-tenant or missing service', { company_id, service_id });
      return Response.json({ error: 'service_not_found' }, { status: 404 });
    }
    if (service.active === false) {
      return Response.json({ error: 'service_inactive' }, { status: 400 });
    }

    try {
      professional = await sdk.entities.Professional.get(professional_id);
    } catch { professional = null; }
    if (!professional || professional.company_id !== company_id) {
      console.warn('[createBookingPaymentIntent] cross-tenant or missing professional', { company_id, professional_id });
      return Response.json({ error: 'professional_not_found' }, { status: 404 });
    }
    if (professional.active === false) {
      return Response.json({ error: 'professional_inactive' }, { status: 400 });
    }
    if (professional.service_ids?.length && !professional.service_ids.includes(service_id)) {
      return Response.json({ error: 'service_not_offered_by_professional' }, { status: 400 });
    }
    if (unit_id && professional.unit_ids?.length && !professional.unit_ids.includes(unit_id)) {
      return Response.json({ error: 'professional_not_in_unit' }, { status: 400 });
    }

    // Dados autoritativos — usados daqui pra frente. Payload original IGNORADO.
    const realPrice = Number(service.price) || 0;
    if (realPrice <= 0) {
      // Defesa: serviço grátis não passa por pagamento online. Frontend deve usar createPublicAppointment.
      return Response.json({ error: 'invalid_price', message: 'Serviço sem preço definido — pague no balcão.' }, { status: 400 });
    }
    const realServiceName = service.name;
    const realProfessionalName = professional.name;
    const realDuration = service.duration_minutes || 30;

    const scheduledAtISO = new Date(scheduled_at).toISOString();

    // ─── VALIDAÇÃO DE BLOQUEIOS (P0.2) ─────────────────────────────────
    try {
      const blocks = await sdk.entities.BlockedTime.filter({ company_id }, '-created_date', 200);
      if (_blockedConflict({ professionalId: professional_id, dateTime: scheduledAtISO, durationMin: realDuration, blocks })) {
        return Response.json({ error: 'time_blocked', message: 'Horário indisponível.' }, { status: 409 });
      }
    } catch (err) {
      console.warn('[createBookingPaymentIntent] block validation skipped:', err.message);
    }

    // ─── LOCK ATÔMICO (P0.1) ────────────────────────────────────────────
    // Primeira camada de defesa: SlotReservation com TTL curto.
    // Reduz drasticamente a janela de race entre 2 clientes simultâneos.
    // WHY: o filter+create antigo tinha ~300ms de race window.
    const lockResult = await acquireSlotLock(sdk, {
      company_id,
      unit_id,
      professional_id,
      scheduled_at: scheduledAtISO,
      owner_phone: phoneNorm,
      source: payment_method === 'pix' ? 'public_booking_pix' : 'public_booking_card',
    });
    if (!lockResult.success) {
      return Response.json({
        error: 'slot_taken',
        message: 'Este horário acabou de ser reservado por outra pessoa. Escolha outro.',
      }, { status: 409 });
    }
    const slotReservation = lockResult.reservation;

    // ─── Segunda camada de defesa: filter Appointment ──────────────────
    // Mantida intencionalmente. Cobre o caso de Appointment já confirmado
    // (não-pagamento) e race residual entre acquire e create.
    const sameSlot = await sdk.entities.Appointment.filter({
      company_id,
      professional_id,
      scheduled_at: scheduledAtISO,
    });
    const blockingStatuses = ['aguardando_pagamento', 'agendado', 'confirmado', 'em_atendimento'];
    const phoneNormForMatch = phoneNorm;
    const ownPendingToReuse = []; // reservas do MESMO usuário que ainda estão "aguardando_pagamento"
    const conflict = sameSlot.find(a => {
      if (!blockingStatuses.includes(a.status)) return false;
      // se aguardando_pagamento e expirado, deixa passar (job vai limpar, mas seguramos aqui também)
      if (a.status === 'aguardando_pagamento' && a.payment_expires_at && new Date(a.payment_expires_at) < new Date()) {
        return false;
      }
      // Se é o MESMO cliente (mesmo telefone) e ainda está apenas aguardando pagamento,
      // isso é o usuário trocando de método (ex: cartão → pix). Não bloqueia: cancelamos
      // o anterior e criamos um novo.
      if (a.status === 'aguardando_pagamento' && a.customer_phone === phoneNormForMatch) {
        ownPendingToReuse.push(a);
        return false;
      }
      return true;
    });
    if (conflict) {
      // Libera o lock que acabamos de adquirir, já que não vamos seguir.
      await releaseSlotLock(sdk, slotReservation?.id);
      return Response.json({
        error: 'slot_taken',
        message: 'Este horário acabou de ser reservado por outra pessoa. Escolha outro.',
      }, { status: 409 });
    }
    // Cancela tentativas anteriores do MESMO usuário no mesmo slot (e seus PaymentIntents)
    for (const old of ownPendingToReuse) {
      try {
        if (old.payment_intent_id && company.stripe_connect_account_id) {
          await stripe.paymentIntents.cancel(old.payment_intent_id, {}, {
            stripeAccount: company.stripe_connect_account_id,
          }).catch(err => console.warn('[createBookingPaymentIntent] cancel old PI failed:', err.message));
        }
        await sdk.entities.Appointment.update(old.id, {
          status: 'cancelado',
          payment_status: 'canceled',
        });
      } catch (err) {
        console.warn('[createBookingPaymentIntent] failed to release old pending appointment:', err.message);
      }
    }

    // ─── Customer (lookup ou criação) ───────────────────────────────────
    const lookupFilter = scope_customer_by_unit && unit_id
      ? { company_id, phone: phoneNorm, unit_id }
      : { company_id, phone: phoneNorm };
    const matches = await sdk.entities.Customer.filter(lookupFilter, '-created_date', 1);
    let customer = matches?.[0] || null;
    if (!customer) {
      customer = await sdk.entities.Customer.create({
        company_id,
        unit_id: scope_customer_by_unit ? unit_id : undefined,
        name: customerNameClean,
        phone: phoneNorm,
        email: customerEmailClean || undefined,
        status: 'active',
      });
    } else if (customerEmailClean && !customer.email) {
      try { await sdk.entities.Customer.update(customer.id, { email: customerEmailClean }); } catch {}
    }

    // ─── Idempotency key determinística ─────────────────────────────────
    // Mesmo cliente + mesmo serviço + mesmo horário + mesmo método = mesmo PaymentIntent.
    // Inclui payment_method para evitar colisão quando o cliente troca pix↔card.
    const idempotencyKey = `bk_${company_id}_${customer.id}_${service_id}_${professional_id}_${scheduledAtISO}_${payment_method}`.slice(0, 200);

    // ─── Cria Appointment como aguardando_pagamento ─────────────────────
    // WHY (P0.2): TODOS os campos canônicos vêm de realPrice/realServiceName/realProfessionalName.
    const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60 * 1000).toISOString();
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
      scheduled_at: scheduledAtISO,
      notes: notesClean || undefined,
      status: 'aguardando_pagamento',
      price: realPrice,
      custom_duration_minutes: realDuration,
      source: 'online',
      payment_method,
      payment_status: 'pending',
      payment_expires_at: expiresAt,
      payment_idempotency_key: idempotencyKey,
      payer_tax_id: cpfNorm,
      paid_online: false,
      confirm_token,
      review_token,
      confirm_token_expires_at,
      review_token_expires_at,
    });

    // ─── Cria PaymentIntent na conta CONNECT ───────────────────────────
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(realPrice * 100),
        currency: 'brl',
        payment_method_types: payment_method === 'pix' ? ['pix'] : ['card'],
        // application_fee_amount: 0, // preparado para futura monetização por transação
        metadata: {
          base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
          appointment_id: appointment.id,
          company_id,
          customer_id: customer.id,
          payment_kind: 'booking',
        },
        description: `Agendamento ${realServiceName} — ${company.name}`,
        receipt_email: customerEmailClean || undefined,
      }, {
        stripeAccount: company.stripe_connect_account_id,
        idempotencyKey,
      });
    } catch (err) {
      // Rollback: marca o appointment como cancelado para liberar o slot
      console.error('[createBookingPaymentIntent] stripe error:', err.message);
      await sdk.entities.Appointment.update(appointment.id, {
        status: 'cancelado',
        payment_status: 'failed',
      }).catch(() => {});
      // Libera o lock também — outro cliente pode tentar este horário.
      await releaseSlotLock(sdk, slotReservation?.id);
      return Response.json({ error: 'stripe_error', message: err.message }, { status: 500 });
    }

    // Salva o payment_intent_id no appointment
    await sdk.entities.Appointment.update(appointment.id, {
      payment_intent_id: paymentIntent.id,
    });

    // ─── Consume slot lock (sucesso) ────────────────────────────────────
    // Marca a reservation como consumed. Reservations consumed não bloqueiam
    // novas reservas (mas o Appointment com status=aguardando_pagamento sim).
    await consumeSlotLock(sdk, slotReservation?.id, appointment.id);

    // Para Pix, devolve o QR code já no primeiro request (next_action.pix_display_qr_code)
    let pixQrCode = null;
    let pixCopyPaste = null;
    if (payment_method === 'pix') {
      // O PaymentIntent inicial não vem com Pix details — precisamos confirmar antes.
      // Vamos confirmar imediatamente para gerar o QR.
      try {
        const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
          payment_method_data: {
            type: 'pix',
            billing_details: {
              name: customerNameClean,
              email: customerEmailClean || undefined,
            },
          },
        }, {
          stripeAccount: company.stripe_connect_account_id,
        });
        const pixAction = confirmed.next_action?.pix_display_qr_code;
        if (pixAction) {
          pixQrCode = pixAction.image_url_png || pixAction.image_url_svg || null;
          pixCopyPaste = pixAction.data || null;
        }
      } catch (err) {
        console.error('[createBookingPaymentIntent] pix confirm error:', err.message);
        // Não falha — o frontend pode fazer fallback ou orientar o cliente.
      }
    }

    return Response.json({
      success: true,
      appointment_id: appointment.id,
      customer_id: customer.id,
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      stripe_account: company.stripe_connect_account_id,
      expires_at: expiresAt,
      pix: pixQrCode || pixCopyPaste ? {
        qr_code_url: pixQrCode,
        copy_paste: pixCopyPaste,
      } : null,
    });
  } catch (error) {
    console.error('[createBookingPaymentIntent] error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});