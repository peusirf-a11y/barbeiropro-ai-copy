// Automação de entidade: dispara quando Appointment muda para status=concluido.
// Trigger conditions na automação garantem que só roda 1x (changed_fields contém "status").
// Multi-unidade: propaga appt.unit_id para FinancialEntry e WhatsAppMessage.
//
// Faz, de forma IDEMPOTENTE:
//   1) Cria FinancialEntry (entrada no caixa) — flag financial_created via reference_appointment_id
//   2) Envia link de avaliação imediatamente via WhatsApp (se houver phone + review_token)
//
// Comissão é tratada por outra automação (registerCommission).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('[onAppointmentConcluded] start');
  try {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));

    let appt = payload?.data;
    const apptId = payload?.event?.entity_id || appt?.id;
    if ((!appt || payload?.payload_too_large) && apptId) {
      try {
        appt = await sdk.entities.Appointment.get(apptId);
      } catch (_e) {
        return Response.json({ skipped: 'appointment_not_found' });
      }
    }
    if (!appt) return Response.json({ skipped: 'no_appointment' });
    if (appt.status !== 'concluido') return Response.json({ skipped: 'not_concluded' });

    const companyId = appt.company_id;
    const baseUrl = req.headers.get('origin')
      || `https://${req.headers.get('host') || 'barbertrimly.base44.app'}`;

    // Garante review_token (atendimentos antigos podem não ter).
    if (!appt.review_token) {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      const token = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
      const exp = new Date(new Date(appt.scheduled_at || Date.now()).getTime() + 72 * 60 * 60 * 1000).toISOString();
      await sdk.entities.Appointment.update(appt.id, {
        review_token: token,
        review_token_expires_at: exp,
      });
      appt.review_token = token;
      appt.review_token_expires_at = exp;
    }

    const result = { financial: null, review: null, review_link: `${baseUrl}/avaliar/${appt.review_token}` };

    // ── 1) Entrada financeira (idempotente por reference_appointment_id) ──
    try {
      const price = Number(appt.price) || 0;
      if (price > 0) {
        const existing = await sdk.entities.FinancialEntry.filter({
          company_id: companyId,
          reference_appointment_id: appt.id,
          type: 'entrada',
        }, '-created_date', 1);

        if (existing && existing.length > 0) {
          result.financial = { skipped: 'already_exists', id: existing[0].id };
        } else {
          // Amarra ao caixa aberto da unidade (Fase 1). Se não houver caixa aberto, segue sem cash_register_id.
          let cashRegisterId;
          try {
            const openCashList = await sdk.entities.CashRegister.filter(
              { company_id: companyId, status: 'aberto' }, '-opened_at', 10
            );
            const matched = openCashList?.find(r =>
              !r.unit_id || !appt.unit_id ? true : r.unit_id === appt.unit_id
            );
            cashRegisterId = matched?.id;
          } catch (e) {
            console.warn('[onAppointmentConcluded] open cash lookup failed:', e.message);
          }

          // payment_method derivado do appointment quando possível (pix/card → carteira correspondente).
          let paymentMethod;
          if (appt.payment_method === 'pix') paymentMethod = 'pix';
          else if (appt.payment_method === 'card') paymentMethod = 'cartao_credito';
          else if (appt.payment_method === 'subscription') paymentMethod = undefined; // não entra no caixa em dinheiro
          // 'avulso' / não informado → null (frontend pode editar depois)

          const entry = await sdk.entities.FinancialEntry.create({
            company_id: companyId,
            unit_id: appt.unit_id || undefined,
            cash_register_id: cashRegisterId,
            professional_id: appt.professional_id || undefined,
            type: 'entrada',
            entry_kind: 'entrada',
            origin: 'agendamento',
            payment_method: paymentMethod,
            category: 'Atendimento',
            description: `${appt.service_name || 'Serviço'} — ${appt.customer_name || 'Cliente'}`,
            amount: price,
            date: (appt.completed_at || new Date().toISOString()).slice(0, 10),
            status: 'confirmado',
            reference_appointment_id: appt.id,
          });
          result.financial = { created: true, id: entry.id, amount: price, cash_register_id: cashRegisterId || null };
        }
      } else {
        result.financial = { skipped: 'no_price' };
      }
    } catch (e) {
      console.error('[onAppointmentConcluded] financial error:', e.message);
      result.financial = { error: e.message };
    }

    // ── 2) Link de avaliação imediato via WhatsApp (idempotente via WhatsAppMessage) ──
    try {
      if (!appt.customer_phone) {
        result.review = { skipped: 'no_phone' };
      } else if (!appt.review_token) {
        result.review = { skipped: 'no_review_token' };
      } else {
        const company = await sdk.entities.Company.get(companyId);
        const s = company?.whatsapp_settings || {};
        if (s.enabled === false || s.send_post_appointment === false) {
          result.review = { skipped: 'disabled' };
        } else {
          // Idempotência: já enviado para esse appointment?
          const prev = await sdk.entities.WhatsAppMessage.filter({
            appointment_id: appt.id,
            type: 'pos_atendimento',
          }, '-sent_at', 1);
          const alreadySent = prev?.find(p => p.status !== 'erro');
          if (alreadySent) {
            result.review = { skipped: 'already_sent', id: alreadySent.id };
          } else {
            const reviewLink = `${baseUrl}/avaliar/${appt.review_token}`;
            const tpl = s.msg_post_appointment
              || 'Valeu por colar na {barbearia}, {nome}! 🔥 Se puder, deixa sua avaliação: {link_avaliacao}';
            const message = tpl.replace(/\{(\w+)\}/g, (_, k) => ({
              nome: appt.customer_name || 'cliente',
              barbearia: company?.name || 'barbearia',
              link_avaliacao: reviewLink,
            }[k] ?? `{${k}}`));

            const send = await sdk.functions.invoke('sendWhatsAppMessage', {
              phone: appt.customer_phone,
              message,
              type: 'pos_atendimento',
              company_id: companyId,
              unit_id: appt.unit_id || undefined,
              customer_id: appt.customer_id,
              customer_name: appt.customer_name,
              appointment_id: appt.id,
            });
            result.review = { sent: true, send_result: send?.data || send };
          }
        }
      }
    } catch (e) {
      console.error('[onAppointmentConcluded] review error:', e.message);
      result.review = { error: e.message };
    }

    // ── 3) Recalcula lifecycle_status do cliente (CRM) ──
    // Atualiza last_completed_at + total_appointments + lifecycle_status do cliente
    // de forma idempotente. Se o appointment não tiver customer_id (atendimento sem
    // cliente cadastrado), pula.
    try {
      if (appt.customer_id) {
        await sdk.functions.invoke('recomputeCustomerLifecycle', { customer_id: appt.customer_id });
        result.lifecycle = { recomputed: true };
      } else {
        result.lifecycle = { skipped: 'no_customer_id' };
      }
    } catch (e) {
      console.error('[onAppointmentConcluded] lifecycle error:', e.message);
      result.lifecycle = { error: e.message };
    }

    console.log('[onAppointmentConcluded] ok', { appointment_id: appt.id, result });
    return Response.json({ success: true, result });
  } catch (error) {
    console.error('[onAppointmentConcluded] error:', error.message, error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});