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

// TEST MODE: força uso exclusivo de chaves de teste do Stripe.
function getTestStripeKey() {
  const key = Deno.env.get('STRIPE_TEST_SECRET_KEY') || '';
  if (!key) throw new Error('TEST_MODE: STRIPE_TEST_SECRET_KEY ausente nos secrets.');
  if (key.startsWith('sk_live_')) throw new Error('TEST_MODE: chave LIVE detectada — apenas sk_test_ é permitida.');
  if (!key.startsWith('sk_test_')) throw new Error('TEST_MODE: chave Stripe inválida — deve começar com sk_test_.');
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
    const stripe = new Stripe(getTestStripeKey());
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
      customer_cpf,
      scheduled_at,
      notes,
      price,
      payment_method, // 'pix' ou 'card'
      scope_customer_by_unit,
      confirm_token,
      review_token,
      confirm_token_expires_at,
      review_token_expires_at,
    } = body;

    // ─── Validações ─────────────────────────────────────────────────────
    if (!company_id) return Response.json({ error: 'company_id_required' }, { status: 400 });
    if (!service_id) return Response.json({ error: 'service_id_required' }, { status: 400 });
    if (!professional_id) return Response.json({ error: 'professional_id_required' }, { status: 400 });
    if (!scheduled_at) return Response.json({ error: 'scheduled_at_required' }, { status: 400 });
    if (!customer_name?.trim()) return Response.json({ error: 'customer_name_required' }, { status: 400 });
    if (!customer_phone?.trim()) return Response.json({ error: 'customer_phone_required' }, { status: 400 });
    if (!price || price <= 0) return Response.json({ error: 'invalid_price' }, { status: 400 });
    if (!['pix', 'card'].includes(payment_method)) {
      return Response.json({ error: 'invalid_payment_method' }, { status: 400 });
    }
    const cpfNorm = normalizeCpf(customer_cpf);
    if (cpfNorm.length !== 11) {
      return Response.json({ error: 'cpf_required', message: 'CPF é obrigatório (11 dígitos)' }, { status: 400 });
    }
    const phoneNorm = normalizePhone(customer_phone);
    if (phoneNorm.length < 10) {
      return Response.json({ error: 'invalid_phone' }, { status: 400 });
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

    const scheduledAtISO = new Date(scheduled_at).toISOString();

    // ─── LOCK do slot (regra crítica: bloquear se já tem reserva ativa) ─
    const sameSlot = await sdk.entities.Appointment.filter({
      company_id,
      professional_id,
      scheduled_at: scheduledAtISO,
    });
    const blockingStatuses = ['aguardando_pagamento', 'agendado', 'confirmado', 'em_atendimento'];
    const conflict = sameSlot.find(a => {
      if (!blockingStatuses.includes(a.status)) return false;
      // se aguardando_pagamento e expirado, deixa passar (job vai limpar, mas seguramos aqui também)
      if (a.status === 'aguardando_pagamento' && a.payment_expires_at && new Date(a.payment_expires_at) < new Date()) {
        return false;
      }
      return true;
    });
    if (conflict) {
      return Response.json({
        error: 'slot_taken',
        message: 'Este horário acabou de ser reservado por outra pessoa. Escolha outro.',
      }, { status: 409 });
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
        name: customer_name.trim(),
        phone: phoneNorm,
        email: customer_email?.trim() || undefined,
        status: 'active',
      });
    } else if (customer_email?.trim() && !customer.email) {
      try { await sdk.entities.Customer.update(customer.id, { email: customer_email.trim() }); } catch {}
    }

    // ─── Idempotency key determinística ─────────────────────────────────
    // Mesmo cliente + mesmo serviço + mesmo horário = mesmo PaymentIntent.
    const idempotencyKey = `bk_${company_id}_${customer.id}_${service_id}_${professional_id}_${scheduledAtISO}`.slice(0, 200);

    // ─── Cria Appointment como aguardando_pagamento ─────────────────────
    const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60 * 1000).toISOString();
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
      scheduled_at: scheduledAtISO,
      notes,
      status: 'aguardando_pagamento',
      price,
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
        amount: Math.round(price * 100),
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
        description: `Agendamento ${service_name} — ${company.name}`,
        receipt_email: customer_email?.trim() || undefined,
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
      return Response.json({ error: 'stripe_error', message: err.message }, { status: 500 });
    }

    // Salva o payment_intent_id no appointment
    await sdk.entities.Appointment.update(appointment.id, {
      payment_intent_id: paymentIntent.id,
    });

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
              name: customer_name.trim(),
              email: customer_email?.trim() || undefined,
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