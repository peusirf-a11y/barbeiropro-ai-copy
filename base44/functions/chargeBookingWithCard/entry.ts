// chargeBookingWithCard — endpoint PÚBLICO (sem auth) chamado pelo BookingPaymentStep
// quando o cliente escolhe cartão. Substitui o redirecionamento para invoiceUrl do Asaas
// por uma tokenização nativa: o formulário do app envia os dados → backend chama
// /creditCard/tokenize no Asaas → cria Payment com creditCardToken (cobra imediatamente).
//
// Fluxo:
//   1. Reaproveita createAsaasBookingPayment para criar o Appointment + Asaas Payment.
//      (Mantemos a lógica de slot lock, rate limit, validações).
//   2. Tokeniza o cartão no Asaas.
//   3. Reativa o Payment com creditCardToken (POST /payments/{id}/payWithCreditCard).
//   4. Devolve status final.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getAsaasConfig() {
  const apiKey = Deno.env.get('ASAAS_API_KEY');
  const environment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
  const baseUrl = Deno.env.get('ASAAS_BASE_URL')
    || (environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
  return { apiKey, baseUrl, isConfigured: !!apiKey };
}

async function asaasFetch(method, path, { body, idempotencyKey } = {}) {
  const cfg = getAsaasConfig();
  if (!cfg.isConfigured) {
    const e = new Error('ASAAS_API_KEY not configured');
    e.code = 'asaas_not_configured'; e.status = 503; throw e;
  }
  const url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'access_token': cfg.apiKey,
    'User-Agent': 'OCorte-SaaS/1.0 (+booking-card-native)',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
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
    if (err.name === 'AbortError') { const e = new Error('Tempo esgotado ao contatar o Asaas. Tente novamente.'); e.code = 'asaas_timeout'; e.status = 504; throw e; }
    const e = new Error(err.message || 'network'); e.code = 'asaas_network'; e.status = 502; throw e;
  }
}

function extractErr(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.slice(0, 200);
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.map(e => e?.description || e?.code).filter(Boolean).join('; ');
  }
  return data?.message || data?.error || null;
}

function digitsOnly(v) { return String(v || '').replace(/\D+/g, ''); }

Deno.serve(async (req) => {
  const rid = crypto.randomUUID().split('-')[0];
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const body = await req.json().catch(() => ({}));

    const {
      // Dados do agendamento (mesmos campos aceitos por createAsaasBookingPayment)
      booking,
      // Dados do cartão
      card,
    } = body;

    if (!booking || !card) {
      return Response.json({ error: 'missing_params', message: 'Dados de agendamento ou cartão ausentes.' }, { status: 400 });
    }
    if (!card.number || !card.holderName || !card.expiryMonth || !card.expiryYear || !card.ccv) {
      return Response.json({ error: 'invalid_card', message: 'Dados do cartão incompletos.' }, { status: 400 });
    }
    if (!card.cpfCnpj || !card.postalCode || !card.addressNumber) {
      return Response.json({ error: 'invalid_holder', message: 'Informe CPF, CEP e número do endereço do titular.' }, { status: 400 });
    }

    // ─── 1. Criar Appointment + Payment via createAsaasBookingPayment ──
    // Reusa toda a validação/slot lock/idempotency da função existente.
    // O Payment criado aceitará a cobrança via cartão (billingType=CREDIT_CARD).
    const bookingRes = await sdk.functions.invoke('createAsaasBookingPayment', {
      ...booking,
      payment_method: 'card',
      customer_cpf: digitsOnly(card.cpfCnpj),
    });
    const bookingData = bookingRes?.data;
    if (!bookingData || bookingData.error) {
      return Response.json({
        error: bookingData?.error || 'booking_failed',
        message: bookingData?.message || 'Não foi possível reservar o horário.',
      }, { status: bookingData?.error === 'slot_taken' ? 409 : 400 });
    }

    const appointmentId = bookingData.appointment_id;
    const paymentId = bookingData.asaas_payment_id;

    if (!paymentId) {
      return Response.json({
        error: 'no_payment_id',
        message: 'Reserva criada, mas a cobrança não foi gerada. Tente novamente.',
      }, { status: 502 });
    }

    // ─── 2. Cobrar o Payment com o cartão (cobrança imediata + tokenização) ──
    // Asaas endpoint: POST /payments/{id}/payWithCreditCard
    // Não precisa criar token separadamente — esse endpoint tokeniza + cobra.
    let chargeResult;
    try {
      chargeResult = await asaasFetch('POST', `/payments/${paymentId}/payWithCreditCard`, {
        idempotencyKey: `bk_charge:${appointmentId}`,
        body: {
          creditCard: {
            holderName: card.holderName,
            number: digitsOnly(card.number),
            expiryMonth: String(card.expiryMonth).padStart(2, '0'),
            expiryYear: String(card.expiryYear),
            ccv: String(card.ccv),
          },
          creditCardHolderInfo: {
            name: card.holderName,
            email: card.email || booking.customer_email || 'cliente@semcadastro.com',
            cpfCnpj: digitsOnly(card.cpfCnpj),
            postalCode: digitsOnly(card.postalCode),
            addressNumber: String(card.addressNumber),
            phone: card.phone ? digitsOnly(card.phone) : undefined,
          },
          remoteIp: ip,
        },
      });
    } catch (err) {
      // Cobrança falhou: marca appointment como cancelado.
      await sdk.entities.Appointment.update(appointmentId, {
        status: 'cancelado',
        payment_status: 'failed',
      }).catch(() => {});
      console.warn(`[chargeBookingWithCard ${rid}] charge failed:`, err.message, err.details);
      return Response.json({
        error: err.code || 'card_declined',
        message: err.message || 'Cartão recusado. Verifique os dados ou tente outro cartão.',
      }, { status: 402 });
    }

    // ─── 3. Confirmação imediata ──
    // Cartão pago à vista → status do Payment vira CONFIRMED ou RECEIVED.
    const status = String(chargeResult?.status || '').toUpperCase();
    const isPaid = status === 'CONFIRMED' || status === 'RECEIVED';

    if (isPaid) {
      await sdk.entities.Appointment.update(appointmentId, {
        status: 'agendado',
        payment_status: 'succeeded',
        paid_online: true,
        paid: true,
        paid_at: new Date().toISOString(),
      }).catch(() => {});
    }

    return Response.json({
      success: true,
      appointment_id: appointmentId,
      payment_id: paymentId,
      status: isPaid ? 'paid' : 'pending',
      asaas_status: status,
    });
  } catch (err) {
    console.error(`[chargeBookingWithCard ${rid}] INTERNAL:`, err?.message, err?.stack);
    return Response.json({ error: 'INTERNAL_ERROR', message: err?.message }, { status: 500 });
  }
});