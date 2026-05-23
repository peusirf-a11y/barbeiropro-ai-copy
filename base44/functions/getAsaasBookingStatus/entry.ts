// getAsaasBookingStatus — endpoint PÚBLICO consultado por polling do PublicBooking (Asaas).
// Substitui getBookingPaymentStatus para o fluxo Asaas.
//
// O webhook continua sendo a fonte da verdade — quando chega PAYMENT_CONFIRMED,
// move o Appointment para 'agendado'. Esta função apenas LÊ o estado local,
// mas pode "force_check" buscando no Asaas se ainda pending (acelera UX).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getAsaasConfig() {
  const apiKey = Deno.env.get('ASAAS_API_KEY');
  const environment = Deno.env.get('ASAAS_ENVIRONMENT') || 'sandbox';
  const baseUrl = Deno.env.get('ASAAS_BASE_URL')
    || (environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
  return { apiKey, baseUrl, isConfigured: !!apiKey };
}

async function asaasGet(path) {
  const cfg = getAsaasConfig();
  if (!cfg.isConfigured) return null;
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    headers: { 'access_token': cfg.apiKey, 'Accept': 'application/json' },
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

function formatStatus(appt) {
  const expired = appt.payment_expires_at
    && new Date(appt.payment_expires_at) < new Date()
    && appt.payment_status === 'pending';
  return {
    appointment_id: appt.id,
    status: appt.status,
    payment_status: expired ? 'expired' : (appt.payment_status || 'pending'),
    paid_online: !!appt.paid_online,
    expires_at: appt.payment_expires_at || null,
  };
}

// Status Asaas que indicam pagamento aprovado.
const ASAAS_PAID_STATUSES = new Set(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { appointment_id, force_check } = body;
    if (!appointment_id) return Response.json({ error: 'appointment_id_required' }, { status: 400 });

    const appts = await sdk.entities.Appointment.filter({ id: appointment_id }).catch(() => []);
    if (!appts?.length) return Response.json({ error: 'appointment_not_found' }, { status: 404 });
    let appt = appts[0];

    // force_check: clica em "Já paguei" → pergunta direto pro Asaas
    if (force_check && appt.payment_intent_id && appt.payment_status === 'pending') {
      try {
        const payment = await asaasGet(`/payments/${appt.payment_intent_id}`);
        if (payment && ASAAS_PAID_STATUSES.has(payment.status)) {
          await sdk.entities.Appointment.update(appt.id, {
            status: 'agendado',
            payment_status: 'succeeded',
            paid_online: true,
          });
          const reloaded = await sdk.entities.Appointment.filter({ id: appointment_id });
          if (reloaded?.[0]) appt = reloaded[0];
        }
      } catch (err) {
        console.warn('[getAsaasBookingStatus] force_check warn:', err.message);
      }
    }

    return Response.json(formatStatus(appt));
  } catch (error) {
    console.error('[getAsaasBookingStatus] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});