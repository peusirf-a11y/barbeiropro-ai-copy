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
    const fail = (code, status = 400, extra = {}) => {
      console.warn(`[createBookingPaymentIntent] validation failed: ${code}`, {
        company_id, service_id, professional_id, scheduled_at,
        has_name: !!customer_name, has_phone: !!customer_phone,
        price, payment_method, has_cpf: !!customer_cpf,
      });
      return Response.json({ error: code, ...extra }, { status });
    };
    if (!company_id) return fail('company_id_required');
    if (!service_id) return fail('service_id_required');
    if (!professional_id) return fail('professional_id_required');
    if (!scheduled_at) return fail('scheduled_at_required');
    if (!customer_name?.trim()) return fail('customer_name_required');
    if (!customer_phone?.trim()) return fail('customer_phone_required');
    if (!price || price <= 0) return fail('invalid_price');
    if (!['pix', 'card'].includes(payment_method)) return fail('invalid_payment_method');
    const cpfNorm = normalizeCpf(customer_cpf);
    if (cpfNorm.length !== 11) return fail('cpf_required', 400, { message: 'CPF é obrigatório (11 dígitos)' });
    const phoneNorm = normalizePhone(customer_phone);
    if (phoneNorm.length < 10) return fail('invalid_phone');

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

    const scheduledAtISO = new Date(scheduled_at).toISOString();

    // ─── LOCK do slot (regra crítica: bloquear se já tem reserva ativa) ─
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
        name: customer_name.trim(),
        phone: phoneNorm,
        email: customer_email?.trim() || undefined,
        status: 'active',
      });
    } else if (customer_email?.trim() && !customer.email) {
      try { await sdk.entities.Customer.update(customer.id, { email: customer_email.trim() }); } catch {}
    }

    // ─── Idempotency key determinística ─────────────────────────────────
    // Mesmo cliente + mesmo serviço + mesmo horário + mesmo método = mesmo PaymentIntent.
    // Inclui payment_method para evitar colisão quando o cliente troca pix↔card.
    const idempotencyKey = `bk_${company_id}_${customer.id}_${service_id}_${professional_id}_${scheduledAtISO}_${payment_method}`.slice(0, 200);

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