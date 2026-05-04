// getBookingPaymentStatus — endpoint PÚBLICO consultado por polling do PublicBooking.
//
// Retorna o estado atual do pagamento e do Appointment vinculado.
// O webhook é a fonte da verdade — esse endpoint apenas LÊ.
//
// Útil para:
//  - Detectar Pix pago (frontend faz polling a cada 3-5s).
//  - Botão "Já paguei" → o frontend chama este endpoint.
//  - Detectar expiração (status='canceled' + payment_status='expired').

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

// TEST MODE: força uso exclusivo de chaves de teste do Stripe.
function getTestStripeKey() {
  const key = Deno.env.get('STRIPE_TEST_SECRET_KEY') || '';
  if (!key) throw new Error('TEST_MODE: STRIPE_TEST_SECRET_KEY ausente nos secrets.');
  if (key.startsWith('sk_live_')) throw new Error('TEST_MODE: chave LIVE detectada — apenas sk_test_ é permitida.');
  if (!key.startsWith('sk_test_')) throw new Error('TEST_MODE: chave Stripe inválida — deve começar com sk_test_.');
  return key;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const stripe = new Stripe(getTestStripeKey());
    const body = await req.json().catch(() => ({}));
    const { appointment_id, force_check } = body;
    if (!appointment_id) return Response.json({ error: 'appointment_id_required' }, { status: 400 });

    const appts = await sdk.entities.Appointment.filter({ id: appointment_id });
    if (!appts.length) return Response.json({ error: 'appointment_not_found' }, { status: 404 });
    const appt = appts[0];

    // Se o usuário clicou em "Já paguei", consultamos o Stripe diretamente
    // para acelerar a confirmação (em vez de esperar o webhook chegar).
    if (force_check && appt.payment_intent_id && appt.payment_status === 'pending') {
      try {
        const companies = await sdk.entities.Company.filter({ id: appt.company_id });
        const company = companies[0];
        if (company?.stripe_connect_account_id) {
          const pi = await stripe.paymentIntents.retrieve(appt.payment_intent_id, {
            stripeAccount: company.stripe_connect_account_id,
          });
          if (pi.status === 'succeeded' && appt.payment_status !== 'succeeded') {
            // Antecipa o que o webhook faria (idempotente): marca como pago.
            await sdk.entities.Appointment.update(appt.id, {
              status: 'agendado',
              payment_status: 'succeeded',
              paid_online: true,
            });
            // Recarrega
            const updated = await sdk.entities.Appointment.filter({ id: appointment_id });
            return Response.json(formatStatus(updated[0]));
          }
        }
      } catch (err) {
        console.warn('[getBookingPaymentStatus] force_check failed:', err.message);
      }
    }

    return Response.json(formatStatus(appt));
  } catch (error) {
    console.error('[getBookingPaymentStatus] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function formatStatus(appt) {
  const expired = appt.payment_expires_at && new Date(appt.payment_expires_at) < new Date()
    && appt.payment_status === 'pending';
  return {
    appointment_id: appt.id,
    status: appt.status,
    payment_status: expired ? 'expired' : (appt.payment_status || 'pending'),
    paid_online: !!appt.paid_online,
    expires_at: appt.payment_expires_at || null,
  };
}