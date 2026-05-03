// cleanupExpiredBookingPayments — job scheduled a cada 5min.
// Cancela Appointments com status='aguardando_pagamento' e payment_expires_at < now.
// Libera o slot para outros clientes.
//
// Também tenta cancelar o PaymentIntent no Stripe (idempotente — se já foi pago,
// o webhook trata e nunca chegamos aqui).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    // Permite execução pelo scheduler (sem user) ou por admin manual.
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const nowISO = new Date().toISOString();

    // Filtra todos os pendentes (paginação simples)
    const pending = await sdk.entities.Appointment.filter({
      status: 'aguardando_pagamento',
    }, '-created_date', 200);

    const expired = pending.filter(a => a.payment_expires_at && a.payment_expires_at < nowISO);
    let canceledCount = 0;

    for (const appt of expired) {
      try {
        // Cancela no Stripe se ainda existir um PaymentIntent ativo
        if (appt.payment_intent_id) {
          try {
            const companies = await sdk.entities.Company.filter({ id: appt.company_id });
            const acc = companies[0]?.stripe_connect_account_id;
            if (acc) {
              await stripe.paymentIntents.cancel(appt.payment_intent_id, {}, { stripeAccount: acc })
                .catch(err => console.warn('[cleanup] cancel intent failed (já pode ter sido pago):', err.message));
            }
          } catch (e) {
            console.warn('[cleanup] stripe cancel error:', e.message);
          }
        }
        await sdk.entities.Appointment.update(appt.id, {
          status: 'cancelado',
          payment_status: 'expired',
        });
        canceledCount++;
      } catch (err) {
        console.error('[cleanup] failed appointment', appt.id, err.message);
      }
    }

    console.log(`[cleanupExpiredBookingPayments] canceled ${canceledCount} expired bookings`);
    return Response.json({ checked: pending.length, expired: expired.length, canceled: canceledCount });
  } catch (error) {
    console.error('[cleanupExpiredBookingPayments] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});