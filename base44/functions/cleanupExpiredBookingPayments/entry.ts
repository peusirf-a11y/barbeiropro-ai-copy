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

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY missing');
    }
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
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

    // ─── P0.1 — Expire stale SlotReservations ────────────────────────────
    // WHY: reservations órfãs (cliente abandonou checkout, crash entre acquire
    // e consume) precisam ser marcadas expired para liberar o slot logicamente.
    // Reservations expiradas (expires_at < now) já são ignoradas em acquire,
    // mas atualizar o status mantém a tabela limpa para auditoria.
    let slotsExpired = 0;
    try {
      const activeRes = await sdk.entities.SlotReservation.filter({ status: 'active' }, '-created_date', 300);
      const staleRes = activeRes.filter(r => r.expires_at && r.expires_at < nowISO);
      for (const r of staleRes) {
        try {
          await sdk.entities.SlotReservation.update(r.id, { status: 'expired' });
          slotsExpired++;
        } catch (err) {
          console.warn('[cleanup] slot expire failed for', r.id, err.message);
        }
      }
      if (staleRes.length > 0) {
        console.log(`[cleanupExpiredBookingPayments] expired ${slotsExpired}/${staleRes.length} stale slot reservations`);
      }
    } catch (err) {
      // Não derruba o cleanup principal se SlotReservation ainda não existir.
      console.warn('[cleanup] SlotReservation sweep skipped:', err.message);
    }

    return Response.json({
      checked: pending.length,
      expired: expired.length,
      canceled: canceledCount,
      slots_expired: slotsExpired,
    });
  } catch (error) {
    console.error('[cleanupExpiredBookingPayments] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});