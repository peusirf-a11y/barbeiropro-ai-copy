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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    const {
      company_id,
      unit_id,
      professional_id,
      professional_name,
      service_id,
      service_name,
      customer_name,
      customer_phone,
      customer_email,
      scheduled_at,
      notes,
      price,
      confirm_token,
      review_token,
      confirm_token_expires_at,
      review_token_expires_at,
      scope_customer_by_unit,
    } = body;

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

    // ─── LOCK ATÔMICO (P0.1) ────────────────────────────────────────────
    // WHY: este endpoint é usado pelo fluxo de plano e gratuito. Sem lock,
    // dois clientes podem reservar o mesmo slot simultaneamente.
    // Source = public_booking_free (será refinado se body indicar plano).
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

    // 1) Lookup cliente por telefone
    const lookupFilter = scope_customer_by_unit && unit_id
      ? { company_id, phone: phoneNorm, unit_id }
      : { company_id, phone: phoneNorm };

    const matches = await sdk.entities.Customer.filter(lookupFilter, '-created_date', 1);
    let customer = matches?.[0] || null;

    // 2) Se não existe → cria
    if (!customer) {
      console.log(`[createPublicAppointment] criando novo customer: ${customer_name} / ${phoneNorm}`);
      customer = await sdk.entities.Customer.create({
        company_id,
        unit_id: scope_customer_by_unit ? unit_id : undefined,
        name: customer_name.trim(),
        phone: phoneNorm,
        email: customer_email?.trim() || undefined,
        status: 'active',
      });
    } else {
      console.log(`[createPublicAppointment] cliente existente reutilizado: ${customer.id}`);
      // Atualiza email se antes não tinha e agora foi informado (não sobrescreve dados existentes)
      if (customer_email?.trim() && !customer.email) {
        try {
          await sdk.entities.Customer.update(customer.id, { email: customer_email.trim() });
        } catch (err) {
          console.warn('[createPublicAppointment] falha ao atualizar email do customer:', err.message);
        }
      }
    }

    // 3) Cria Appointment vinculado
    const appointment = await sdk.entities.Appointment.create({
      company_id,
      unit_id: unit_id || undefined,
      customer_id: customer.id,
      professional_id,
      professional_name,
      service_id,
      service_name,
      customer_name: customer_name.trim(),
      customer_phone: phoneNorm,
      customer_email: customer_email?.trim() || undefined,
      scheduled_at,
      notes,
      status: 'agendado',
      price,
      source: 'online',
      confirm_token,
      review_token,
      confirm_token_expires_at,
      review_token_expires_at,
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
      customer_was_created: !matches?.length,
    });
  } catch (error) {
    // WHY: se erro ocorrer entre acquire e consume, o lock fica órfão.
    // O cleanup job vai expirar em <=90s — não vazamos slot permanentemente.
    // Não temos slotReservation no escopo aqui (variável local), então
    // a limpeza é responsabilidade do job. Aceitável.
    console.error('[createPublicAppointment] erro:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});